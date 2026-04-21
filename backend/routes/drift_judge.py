import os
import json
import re
from datetime import datetime
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import DriftJudgeResult, Service

load_dotenv()

router = APIRouter(prefix="/drift-judge", tags=["Drift Judge"])

SUPPORTED_JUDGES = {
    "gemini": "gemini-2.0-flash",
    "gpt5":   "gpt-4o",         # Latest capable OpenAI model (GPT-5 when released)
    "claude": "claude-sonnet-4-5",
}


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class DriftJudgeRequest(BaseModel):
    service_id: int
    baseline_samples: str          # comma-separated
    live_samples: str              # comma-separated
    selected_tools: List[str]
    llm_judge: str                 # "gemini" | "gpt5" | "claude"


class DriftJudgeResponse(BaseModel):
    id: int
    service_id: int
    timestamp: datetime
    judge_model: str
    tools_used: List[str]
    drift_detected: str
    shift_type: str
    top_new_keyword: Optional[str]
    severity_score: int
    short_reason: Optional[str]
    raw_response: Optional[str]


# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------

DRIFT_PROMPT = """You are a specialized Drift Detection Judge.

Compare the Baseline vs Live query samples below and return ONLY valid JSON.

Analyze for:
1. Data Drift — intent shift, new topics, products, or user goals not present in baseline
2. Concept Drift — syntax shift, changes in length, technicality, or formatting patterns
3. Security/Noise — gibberish, prompt injections, or bot-like patterns

Validation tools applied: {selected_tools}
(Supported: Evidently AI | Deepchecks | Alibi Detect | Frouros | Popmon | NannyML | Great Expectations)

Baseline samples (comma-separated):
{baseline_samples}

Live samples (comma-separated):
{live_samples}

Respond ONLY with this JSON, no preamble, no markdown:
{"drift_detected":"Major"|"Minor"|"None","shift_type":"Data Drift"|"Concept Drift"|"Noise"|"NA","top_new_keyword":"single_word","severity_score":0-10,"short_reason":"max 15 words","judge_model":"{llm_judge}","tools_used":["{selected_tools}"]}"""


def build_prompt(baseline: str, live: str, tools: List[str], judge: str) -> str:
    tools_str = ", ".join(tools) if tools else "None"
    return DRIFT_PROMPT.format(
        selected_tools=tools_str,
        baseline_samples=baseline,
        live_samples=live,
        llm_judge=judge,
    )


def extract_json(text: str) -> dict:
    """Strip markdown fences and parse the first JSON object found."""
    # Remove ```json ... ``` fences
    text = re.sub(r"```(?:json)?", "", text).replace("```", "").strip()
    # Find first {...}
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise ValueError("No JSON object found in response")
    return json.loads(match.group())


# ---------------------------------------------------------------------------
# LLM callers
# ---------------------------------------------------------------------------

def call_openai(prompt: str) -> str:
    import openai as _openai
    api_key = os.environ.get("OPENAI_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="OPENAI_KEY not set in .env")
    client = _openai.OpenAI(api_key=api_key)
    resp = client.chat.completions.create(
        model=SUPPORTED_JUDGES["gpt5"],
        messages=[{"role": "user", "content": prompt}],
        max_tokens=300,
        temperature=0,
    )
    return resp.choices[0].message.content.strip()


def call_gemini(prompt: str) -> str:
    try:
        import google.generativeai as genai
    except ImportError:
        raise HTTPException(status_code=500, detail="google-generativeai not installed. Run: pip install google-generativeai")
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="GEMINI_API_KEY not set in .env")
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(SUPPORTED_JUDGES["gemini"])
    resp = model.generate_content(prompt)
    return resp.text.strip()


def call_claude(prompt: str) -> str:
    try:
        import anthropic
    except ImportError:
        raise HTTPException(status_code=500, detail="anthropic not installed. Run: pip install anthropic")
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="ANTHROPIC_API_KEY not set in .env")
    client = anthropic.Anthropic(api_key=api_key)
    msg = client.messages.create(
        model=SUPPORTED_JUDGES["claude"],
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text.strip()


CALLERS = {
    "gemini": call_gemini,
    "gpt5":   call_openai,
    "claude": call_claude,
}


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/run", response_model=DriftJudgeResponse)
def run_drift_judge(payload: DriftJudgeRequest, db: Session = Depends(get_db)):
    """Run the LLM drift judge and store the result."""
    judge_key = payload.llm_judge.lower()
    if judge_key not in CALLERS:
        raise HTTPException(status_code=400, detail=f"Unknown judge '{judge_key}'. Use: gemini, gpt5, claude")

    # Verify service exists
    service = db.query(Service).filter(Service.id == payload.service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    prompt = build_prompt(
        payload.baseline_samples,
        payload.live_samples,
        payload.selected_tools,
        SUPPORTED_JUDGES[judge_key],
    )

    raw = CALLERS[judge_key](prompt)

    try:
        parsed = extract_json(raw)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM returned invalid JSON: {e}. Raw: {raw[:300]}")

    record = DriftJudgeResult(
        service_id      = payload.service_id,
        judge_model     = parsed.get("judge_model", SUPPORTED_JUDGES[judge_key]),
        tools_used      = json.dumps(payload.selected_tools),
        baseline_samples= payload.baseline_samples,
        live_samples    = payload.live_samples,
        drift_detected  = parsed.get("drift_detected", "None"),
        shift_type      = parsed.get("shift_type", "NA"),
        top_new_keyword = parsed.get("top_new_keyword"),
        severity_score  = int(parsed.get("severity_score", 0)),
        short_reason    = parsed.get("short_reason"),
        raw_response    = raw,
        timestamp       = datetime.utcnow(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return DriftJudgeResponse(
        id              = record.id,
        service_id      = record.service_id,
        timestamp       = record.timestamp,
        judge_model     = record.judge_model,
        tools_used      = json.loads(record.tools_used),
        drift_detected  = record.drift_detected,
        shift_type      = record.shift_type,
        top_new_keyword = record.top_new_keyword,
        severity_score  = record.severity_score,
        short_reason    = record.short_reason,
        raw_response    = record.raw_response,
    )


@router.get("/{service_id}", response_model=List[DriftJudgeResponse])
def get_drift_judge_history(service_id: int, db: Session = Depends(get_db)):
    """Return all drift judge results for a service, newest first."""
    rows = (
        db.query(DriftJudgeResult)
        .filter(DriftJudgeResult.service_id == service_id)
        .order_by(DriftJudgeResult.timestamp.desc())
        .all()
    )
    return [
        DriftJudgeResponse(
            id              = r.id,
            service_id      = r.service_id,
            timestamp       = r.timestamp,
            judge_model     = r.judge_model,
            tools_used      = json.loads(r.tools_used),
            drift_detected  = r.drift_detected,
            shift_type      = r.shift_type,
            top_new_keyword = r.top_new_keyword,
            severity_score  = r.severity_score,
            short_reason    = r.short_reason,
            raw_response    = r.raw_response,
        )
        for r in rows
    ]
