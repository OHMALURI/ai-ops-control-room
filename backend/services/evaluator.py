"""
evaluator.py — DeepEval-based LLM evaluation engine.

Uses DeepEval metrics with LM Studio (google/gemma-4-e4b) as the judge model.

Single-Turn metrics (dataset_type="single_turn"):
  AnswerRelevancy, Faithfulness, GEval (Accuracy), Toxicity, GEval (Instruction Following)

Multi-Turn metrics (dataset_type="multi_turn"):
  ConversationCompleteness, TurnRelevancy, KnowledgeRetention, RoleAdherence, ConversationalGEval
"""

import os, json, time, statistics, re, threading, random
import concurrent.futures as _cf
from openai import OpenAI
from sqlalchemy import desc
from sqlalchemy.orm import Session
from models import Evaluation, Service

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# ─────────────────────────────────────────────────────────────────────────────
# STOP FLAG REGISTRY  (per service_id)
# ─────────────────────────────────────────────────────────────────────────────
_stop_flags: dict = {}
_stop_flags_lock = threading.Lock()


def _get_stop_flag(service_id: int) -> threading.Event:
    with _stop_flags_lock:
        if service_id not in _stop_flags:
            _stop_flags[service_id] = threading.Event()
        return _stop_flags[service_id]


def request_stop(service_id: int):
    with _stop_flags_lock:
        _stop_flags[service_id] = threading.Event()
        _stop_flags[service_id].set()


def _reset_stop_flag(service_id: int):
    with _stop_flags_lock:
        _stop_flags[service_id] = threading.Event()


class EvaluationStopped(Exception):
    pass


# ─────────────────────────────────────────────────────────────────────────────
# LM STUDIO CUSTOM JUDGE FOR DEEPEVAL
# ─────────────────────────────────────────────────────────────────────────────
from deepeval.models.base_model import DeepEvalBaseLLM


class LMStudioGemma(DeepEvalBaseLLM):
    """DeepEval judge backed by LM Studio (no-auth, raw HTTP)."""

    def __init__(self):
        self._base_url = os.getenv("LMSTUDIO_BASE_URL", "http://10.5.0.2:1234/v1")
        self._model = os.getenv("LMSTUDIO_MODEL", "google/gemma-4-e4b")

    def load_model(self):
        return self

    def _call(self, prompt: str) -> str:
        import httpx
        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0,
            "max_tokens": 1024,
            "stream": False,
        }
        resp = httpx.post(
            f"{self._base_url}/chat/completions",
            headers={"Content-Type": "application/json"},
            json=payload,
            timeout=90.0,
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()

    def generate(self, prompt: str, schema=None):
        if schema is not None:
            prompt = (
                prompt
                + "\n\nIMPORTANT: Reply with a valid JSON object ONLY. "
                "No markdown, no code fences, no explanation — just raw JSON."
            )

        try:
            content = self._call(prompt)
        except Exception as e:
            print(f"[LMStudio] HTTP error: {e}")
            if schema is not None:
                try:
                    return schema()
                except Exception:
                    pass
            raise

        if schema is not None:
            try:
                cleaned = re.sub(r"```(?:json)?", "", content).strip("`").strip()
                match = re.search(r"\{.*\}", cleaned, re.DOTALL)
                raw = match.group() if match else cleaned
                return schema(**json.loads(raw))
            except Exception as e:
                print(f"[LMStudio] Schema parse error: {e} | raw: {content[:200]}")
                try:
                    return schema()
                except Exception:
                    return content

        return content

    async def a_generate(self, prompt: str, schema=None):
        import asyncio
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, lambda: self.generate(prompt, schema))

    def get_model_name(self) -> str:
        return self._model


_judge_instance = None


def _get_judge() -> LMStudioGemma:
    global _judge_instance
    if _judge_instance is None:
        _judge_instance = LMStudioGemma()
    return _judge_instance


# ─────────────────────────────────────────────────────────────────────────────
# METRIC TIMEOUT HELPER
# ─────────────────────────────────────────────────────────────────────────────
_METRIC_TIMEOUT = 120  # seconds per metric call


def _measure(metric, test_case):
    """
    Call metric.measure(test_case) with a hard timeout.
    Returns metric.score on success, raises TimeoutError if it exceeds _METRIC_TIMEOUT.
    """
    with _cf.ThreadPoolExecutor(max_workers=1) as ex:
        fut = ex.submit(metric.measure, test_case)
        try:
            fut.result(timeout=_METRIC_TIMEOUT)
        except _cf.TimeoutError:
            raise TimeoutError(
                f"{metric.__class__.__name__} timed out after {_METRIC_TIMEOUT}s"
            )
    return metric.score


# ─────────────────────────────────────────────────────────────────────────────
# PROGRESS HELPER
# ─────────────────────────────────────────────────────────────────────────────
def _emit(on_progress, step: str, label: str, status: str, section: str = "",
          duration_ms: int = None, score: float = None):
    if on_progress is None:
        return
    event = {"step": step, "label": label, "status": status, "section": section}
    if duration_ms is not None:
        event["duration_ms"] = duration_ms
    if score is not None:
        event["score"] = round(score, 1)
    on_progress(event)


# ─────────────────────────────────────────────────────────────────────────────
# GOLDEN TEST CASES
# ─────────────────────────────────────────────────────────────────────────────
SINGLE_TURN_SAMPLES = [
    {
        "input": "What is the capital of France?",
        "expected_output": "Paris is the capital of France.",
        "context": [
            "France is a country in Western Europe. Its capital and largest city is Paris, "
            "known for landmarks such as the Eiffel Tower and the Louvre."
        ],
    },
    {
        "input": "Explain what a REST API is in one sentence.",
        "expected_output": "A REST API is an architectural style for web services that uses HTTP methods to interact with resources.",
        "context": [
            "REST (Representational State Transfer) is an architectural style for distributed hypermedia systems. "
            "A REST API uses HTTP requests to perform GET, POST, PUT, and DELETE operations on resources."
        ],
    },
    {
        "input": "What is 15% of 200?",
        "expected_output": "15% of 200 is 30.",
        "context": [
            "Percentage calculation: multiply the base number by the percentage divided by 100. "
            "15% of 200 = 200 × 0.15 = 30."
        ],
    },
    {
        "input": "What are the three primary colors?",
        "expected_output": "The three primary colors are red, blue, and yellow.",
        "context": [
            "In traditional color theory the three primary colors are red, yellow, and blue. "
            "These colors cannot be created by mixing other colors together."
        ],
    },
    {
        "input": "Define machine learning in simple terms.",
        "expected_output": "Machine learning is a type of AI that enables computers to learn from data and improve without being explicitly programmed.",
        "context": [
            "Machine learning is a subset of artificial intelligence that allows systems to learn and improve "
            "from experience without being explicitly programmed by analyzing patterns in data."
        ],
    },
]

MULTI_TURN_SCENARIOS = [
    {
        "chatbot_role": "a helpful customer support assistant for a software company",
        "turns": [
            {"role": "user", "content": "Hi, I'm having trouble logging into my account."},
            {"role": "user", "content": "I already tried resetting my password but it still doesn't work."},
            {"role": "user", "content": "My email is user@example.com. Can you check my account status?"},
        ],
    },
    {
        "chatbot_role": "a knowledgeable technical assistant specialising in Python",
        "turns": [
            {"role": "user", "content": "My name is Alex and I work as a Python developer."},
            {"role": "user", "content": "Can you help me write a list comprehension that squares even numbers from 1 to 10?"},
            {"role": "user", "content": "What's my name again, and what language am I using?"},
        ],
    },
]

DATASET_LABELS = {
    "single_turn": "Single-Turn",
    "multi_turn":  "Multi-Turn",
}

GOLDEN_DATASETS = {
    "single_turn": SINGLE_TURN_SAMPLES,
    "multi_turn":  MULTI_TURN_SCENARIOS,
}


# ─────────────────────────────────────────────────────────────────────────────
# MODEL RESPONSE HELPER
# ─────────────────────────────────────────────────────────────────────────────
def _get_model_response(
    prompt: str,
    model_id: str,
    system_prompt: str = None,
    history: list = None,
) -> str:
    """Call the service's OpenAI model and return its response."""
    try:
        client = OpenAI(
            api_key=os.getenv("OPENAI_KEY") or os.getenv("OPENAI_API_KEY"),
        )
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": prompt})

        resp = client.chat.completions.create(
            model=model_id,
            messages=messages,
            temperature=0.2,
            max_tokens=512,
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        print(f"[evaluator] OpenAI model response error ({model_id}): {e}")
        return ""


# ─────────────────────────────────────────────────────────────────────────────
# SINGLE-TURN DEEPEVAL EVALUATION
# ─────────────────────────────────────────────────────────────────────────────
def _run_single_turn_eval(service: Service, on_progress=None, stop_flag: threading.Event = None) -> tuple:
    from deepeval.test_case import LLMTestCase, LLMTestCaseParams
    from deepeval.metrics import (
        AnswerRelevancyMetric,
        FaithfulnessMetric,
        HallucinationMetric,
        GEval,
        ToxicityMetric,
    )

    sec = "single_turn"
    judge = _get_judge()

    answer_relevancy  = AnswerRelevancyMetric(model=judge, threshold=0.5, include_reason=True)
    faithfulness      = FaithfulnessMetric(model=judge, threshold=0.5, include_reason=True)
    hallucination     = HallucinationMetric(model=judge, threshold=0.5, include_reason=True)
    accuracy_geval    = GEval(
        name="Accuracy",
        criteria="Determine whether the actual output is factually accurate and correctly answers the input question based on the expected output.",
        evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT, LLMTestCaseParams.EXPECTED_OUTPUT],
        model=judge, threshold=0.5,
    )
    instruction_geval = GEval(
        name="Instruction Following",
        criteria="Determine whether the actual output follows the instructions and format requested in the input question.",
        evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT],
        model=judge, threshold=0.5,
    )
    toxicity = ToxicityMetric(model=judge, threshold=0.5, include_reason=True)

    per_sample = []

    selected_samples = random.sample(SINGLE_TURN_SAMPLES, 1)
    for i, sample in enumerate(selected_samples, start=1):
        if stop_flag and stop_flag.is_set():
            raise EvaluationStopped()

        # ── Model Response ────────────────────────────────────────────────────
        _emit(on_progress, f"model_{i}", f"Sample {i} — Model Response ({service.model_name} via OpenAI)", "running", sec)
        t = time.time()
        actual = _get_model_response(sample["input"], service.model_name, service.system_prompt)
        _emit(on_progress, f"model_{i}", f"Sample {i} — Model Response ({service.model_name} via OpenAI)", "done", sec, int((time.time()-t)*1000))

        test_case = LLMTestCase(
            input=sample["input"],
            actual_output=actual,
            expected_output=sample["expected_output"],
            retrieval_context=sample["context"],
            context=sample["context"],
        )
        scores = {}

        # ── Answer Relevancy ──────────────────────────────────────────────────
        if stop_flag and stop_flag.is_set():
            raise EvaluationStopped()
        _emit(on_progress, f"relevancy_{i}", f"Sample {i} — Answer Relevancy", "running", sec)
        t = time.time()
        try:
            scores["relevance_score"] = round(_measure(answer_relevancy, test_case) * 100, 2)
            _emit(on_progress, f"relevancy_{i}", f"Sample {i} — Answer Relevancy", "done", sec,
                  int((time.time()-t)*1000), scores["relevance_score"])
        except Exception as e:
            print(f"[deepeval] AnswerRelevancy error: {e}")
            scores["relevance_score"] = 0.0
            _emit(on_progress, f"relevancy_{i}", f"Sample {i} — Answer Relevancy", "error", sec, int((time.time()-t)*1000))

        # ── Faithfulness ──────────────────────────────────────────────────────
        if stop_flag and stop_flag.is_set():
            raise EvaluationStopped()
        _emit(on_progress, f"faithfulness_{i}", f"Sample {i} — Faithfulness", "running", sec)
        t = time.time()
        try:
            scores["factuality_score"] = round(_measure(faithfulness, test_case) * 100, 2)
            _emit(on_progress, f"faithfulness_{i}", f"Sample {i} — Faithfulness", "done", sec,
                  int((time.time()-t)*1000), scores["factuality_score"])
        except Exception as e:
            print(f"[deepeval] Faithfulness error: {e}")
            try:
                scores["factuality_score"] = round((1 - _measure(hallucination, test_case)) * 100, 2)
                _emit(on_progress, f"faithfulness_{i}", f"Sample {i} — Faithfulness", "done", sec,
                      int((time.time()-t)*1000), scores["factuality_score"])
            except Exception as e2:
                print(f"[deepeval] Hallucination fallback error: {e2}")
                scores["factuality_score"] = 0.0
                _emit(on_progress, f"faithfulness_{i}", f"Sample {i} — Faithfulness", "error", sec, int((time.time()-t)*1000))

        # ── GEval Accuracy ────────────────────────────────────────────────────
        if stop_flag and stop_flag.is_set():
            raise EvaluationStopped()
        _emit(on_progress, f"geval_accuracy_{i}", f"Sample {i} — GEval Accuracy", "running", sec)
        t = time.time()
        try:
            scores["accuracy"] = round(_measure(accuracy_geval, test_case) * 100, 2)
            _emit(on_progress, f"geval_accuracy_{i}", f"Sample {i} — GEval Accuracy", "done", sec,
                  int((time.time()-t)*1000), scores["accuracy"])
        except Exception as e:
            print(f"[deepeval] GEval Accuracy error: {e}")
            scores["accuracy"] = 0.0
            _emit(on_progress, f"geval_accuracy_{i}", f"Sample {i} — GEval Accuracy", "error", sec, int((time.time()-t)*1000))

        # ── GEval Instruction Following ───────────────────────────────────────
        if stop_flag and stop_flag.is_set():
            raise EvaluationStopped()
        _emit(on_progress, f"geval_instr_{i}", f"Sample {i} — Instruction Following", "running", sec)
        t = time.time()
        try:
            scores["instruction_following"] = round(_measure(instruction_geval, test_case) * 100, 2)
            _emit(on_progress, f"geval_instr_{i}", f"Sample {i} — Instruction Following", "done", sec,
                  int((time.time()-t)*1000), scores["instruction_following"])
        except Exception as e:
            print(f"[deepeval] GEval Instruction error: {e}")
            scores["instruction_following"] = 0.0
            _emit(on_progress, f"geval_instr_{i}", f"Sample {i} — Instruction Following", "error", sec, int((time.time()-t)*1000))

        # ── Toxicity ──────────────────────────────────────────────────────────
        if stop_flag and stop_flag.is_set():
            raise EvaluationStopped()
        _emit(on_progress, f"toxicity_{i}", f"Sample {i} — Toxicity", "running", sec)
        t = time.time()
        try:
            scores["toxicity_score"] = round((1 - _measure(toxicity, test_case)) * 100, 2)
            _emit(on_progress, f"toxicity_{i}", f"Sample {i} — Toxicity", "done", sec,
                  int((time.time()-t)*1000), scores["toxicity_score"])
        except Exception as e:
            print(f"[deepeval] Toxicity error: {e}")
            scores["toxicity_score"] = 100.0
            _emit(on_progress, f"toxicity_{i}", f"Sample {i} — Toxicity", "error", sec, int((time.time()-t)*1000))

        per_sample.append({
            "input": sample["input"],
            "expected_output": sample["expected_output"],
            "actual_output": actual,
            **scores,
        })

    def _avg(key):
        vals = [s[key] for s in per_sample if s.get(key) is not None]
        return statistics.mean(vals) if vals else 0.0

    avg_metrics = {
        "accuracy":              _avg("accuracy"),
        "relevance_score":       _avg("relevance_score"),
        "factuality_score":      _avg("factuality_score"),
        "toxicity_score":        _avg("toxicity_score"),
        "instruction_following": _avg("instruction_following"),
    }

    return per_sample, avg_metrics


# ─────────────────────────────────────────────────────────────────────────────
# MULTI-TURN DEEPEVAL EVALUATION
# ─────────────────────────────────────────────────────────────────────────────
def _run_multi_turn_eval(service: Service, on_progress=None, stop_flag: threading.Event = None) -> tuple:
    from deepeval.test_case import ConversationalTestCase, Turn
    from deepeval.metrics import (
        ConversationCompletenessMetric,
        KnowledgeRetentionMetric,
        RoleAdherenceMetric,
        TurnRelevancyMetric,
        ConversationalGEval,
    )

    sec = "multi_turn"
    judge = _get_judge()

    completeness_metric = ConversationCompletenessMetric(model=judge, threshold=0.5)
    turn_relevancy      = TurnRelevancyMetric(model=judge, threshold=0.5)
    knowledge_metric    = KnowledgeRetentionMetric(model=judge, threshold=0.5)
    role_metric         = RoleAdherenceMetric(model=judge, threshold=0.5)
    coherence_geval     = ConversationalGEval(
        name="Coherence",
        criteria="Determine whether each assistant response is coherent, logically consistent, and maintains the context of the conversation accurately.",
        model=judge, threshold=0.5,
    )

    all_scores = {k: [] for k in ["accuracy", "relevance_score", "factuality_score", "toxicity_score", "instruction_following"]}
    per_sample = []

    selected_scenarios = random.sample(MULTI_TURN_SCENARIOS, 1)
    for j, scenario in enumerate(selected_scenarios, start=1):
        if stop_flag and stop_flag.is_set():
            raise EvaluationStopped()

        # ── Build Conversation ────────────────────────────────────────────────
        _emit(on_progress, f"build_convo_{j}", f"Scenario {j} — Building conversation ({service.model_name} via OpenAI)", "running", sec)
        t = time.time()

        built_turns = []
        history = []

        for turn_def in scenario["turns"]:
            if turn_def["role"] != "user":
                continue
            built_turns.append(Turn(role="user", content=turn_def["content"]))
            history.append({"role": "user", "content": turn_def["content"]})
            assistant_content = _get_model_response(
                turn_def["content"],
                service.model_name,
                system_prompt=service.system_prompt,
                history=history[:-1],  # pass history before this user turn
            )
            built_turns.append(Turn(role="assistant", content=assistant_content))
            history.append({"role": "assistant", "content": assistant_content})

        _emit(on_progress, f"build_convo_{j}", f"Scenario {j} — Building conversation ({service.model_name} via OpenAI)",
              "done", sec, int((time.time()-t)*1000))

        test_case = ConversationalTestCase(
            turns=built_turns,
            chatbot_role=scenario.get("chatbot_role", "a helpful AI assistant"),
        )
        scores = {}

        # ── Conversation Completeness ─────────────────────────────────────────
        if stop_flag and stop_flag.is_set():
            raise EvaluationStopped()
        _emit(on_progress, f"completeness_{j}", f"Scenario {j} — Conversation Completeness", "running", sec)
        t = time.time()
        try:
            scores["accuracy"] = round(_measure(completeness_metric, test_case) * 100, 2)
            _emit(on_progress, f"completeness_{j}", f"Scenario {j} — Conversation Completeness", "done", sec,
                  int((time.time()-t)*1000), scores["accuracy"])
        except Exception as e:
            print(f"[deepeval] ConversationCompleteness error: {e}")
            scores["accuracy"] = 0.0
            _emit(on_progress, f"completeness_{j}", f"Scenario {j} — Conversation Completeness", "error", sec, int((time.time()-t)*1000))

        # ── Turn Relevancy ────────────────────────────────────────────────────
        if stop_flag and stop_flag.is_set():
            raise EvaluationStopped()
        _emit(on_progress, f"turn_relevancy_{j}", f"Scenario {j} — Turn Relevancy", "running", sec)
        t = time.time()
        try:
            scores["relevance_score"] = round(_measure(turn_relevancy, test_case) * 100, 2)
            _emit(on_progress, f"turn_relevancy_{j}", f"Scenario {j} — Turn Relevancy", "done", sec,
                  int((time.time()-t)*1000), scores["relevance_score"])
        except Exception as e:
            print(f"[deepeval] TurnRelevancy error: {e}")
            scores["relevance_score"] = 0.0
            _emit(on_progress, f"turn_relevancy_{j}", f"Scenario {j} — Turn Relevancy", "error", sec, int((time.time()-t)*1000))

        # ── Coherence (ConversationalGEval) ───────────────────────────────────
        if stop_flag and stop_flag.is_set():
            raise EvaluationStopped()
        _emit(on_progress, f"coherence_{j}", f"Scenario {j} — Coherence (GEval)", "running", sec)
        t = time.time()
        try:
            scores["factuality_score"] = round(_measure(coherence_geval, test_case) * 100, 2)
            _emit(on_progress, f"coherence_{j}", f"Scenario {j} — Coherence (GEval)", "done", sec,
                  int((time.time()-t)*1000), scores["factuality_score"])
        except Exception as e:
            print(f"[deepeval] ConversationalGEval Coherence error: {e}")
            scores["factuality_score"] = 0.0
            _emit(on_progress, f"coherence_{j}", f"Scenario {j} — Coherence (GEval)", "error", sec, int((time.time()-t)*1000))

        # ── Role Adherence ────────────────────────────────────────────────────
        if stop_flag and stop_flag.is_set():
            raise EvaluationStopped()
        _emit(on_progress, f"role_adherence_{j}", f"Scenario {j} — Role Adherence", "running", sec)
        t = time.time()
        try:
            scores["toxicity_score"] = round(_measure(role_metric, test_case) * 100, 2)
            _emit(on_progress, f"role_adherence_{j}", f"Scenario {j} — Role Adherence", "done", sec,
                  int((time.time()-t)*1000), scores["toxicity_score"])
        except Exception as e:
            print(f"[deepeval] RoleAdherence error: {e}")
            scores["toxicity_score"] = 0.0
            _emit(on_progress, f"role_adherence_{j}", f"Scenario {j} — Role Adherence", "error", sec, int((time.time()-t)*1000))

        # ── Knowledge Retention ───────────────────────────────────────────────
        if stop_flag and stop_flag.is_set():
            raise EvaluationStopped()
        _emit(on_progress, f"knowledge_{j}", f"Scenario {j} — Knowledge Retention", "running", sec)
        t = time.time()
        try:
            scores["instruction_following"] = round(_measure(knowledge_metric, test_case) * 100, 2)
            _emit(on_progress, f"knowledge_{j}", f"Scenario {j} — Knowledge Retention", "done", sec,
                  int((time.time()-t)*1000), scores["instruction_following"])
        except Exception as e:
            print(f"[deepeval] KnowledgeRetention error: {e}")
            scores["instruction_following"] = 0.0
            _emit(on_progress, f"knowledge_{j}", f"Scenario {j} — Knowledge Retention", "error", sec, int((time.time()-t)*1000))

        last_user      = next((t for t in reversed(built_turns) if t.role == "user"),      None)
        last_assistant = next((t for t in reversed(built_turns) if t.role == "assistant"), None)

        per_sample.append({
            "input": f"[{len(built_turns)//2} turns] {last_user.content if last_user else ''}",
            "expected_output": f"Role: {scenario.get('chatbot_role', 'assistant')}",
            "actual_output": last_assistant.content if last_assistant else "",
            **scores,
        })

        for k, v in scores.items():
            all_scores[k].append(v)

    def _avg(key):
        vals = all_scores[key]
        return statistics.mean(vals) if vals else 0.0

    avg_metrics = {
        "accuracy":              _avg("accuracy"),
        "relevance_score":       _avg("relevance_score"),
        "factuality_score":      _avg("factuality_score"),
        "toxicity_score":        _avg("toxicity_score"),
        "instruction_following": _avg("instruction_following"),
    }

    return per_sample, avg_metrics


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC API
# ─────────────────────────────────────────────────────────────────────────────
def run_evaluation(
    service_id: int,
    db: Session,
    dataset_type: str = "single_turn",
    on_progress=None,
) -> Evaluation:
    """Run DeepEval evaluation for a service and persist the result."""
    dataset_type = dataset_type.lower()
    if dataset_type not in GOLDEN_DATASETS:
        dataset_type = "single_turn"

    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise ValueError(f"Service {service_id} not found")

    stop_flag = _get_stop_flag(service_id)

    t_start = time.time()

    if dataset_type == "single_turn":
        per_sample_scores, avg_metrics = _run_single_turn_eval(service, on_progress=on_progress, stop_flag=stop_flag)
    else:
        per_sample_scores, avg_metrics = _run_multi_turn_eval(service, on_progress=on_progress, stop_flag=stop_flag)

    latency_ms = int((time.time() - t_start) * 1000)

    accuracy              = avg_metrics["accuracy"]
    relevance_score       = avg_metrics["relevance_score"]
    factuality_score      = avg_metrics["factuality_score"]
    toxicity_score        = avg_metrics["toxicity_score"]
    instruction_following = avg_metrics["instruction_following"]

    metric_vals   = [v for v in avg_metrics.values() if v is not None]
    quality_score = statistics.mean(metric_vals) if metric_vals else 0.0

    drift_triggered = False
    drift_type      = None
    drift_reason    = None

    last_eval = (
        db.query(Evaluation)
        .filter(Evaluation.service_id == service_id, Evaluation.dataset_type == dataset_type)
        .order_by(desc(Evaluation.timestamp))
        .first()
    )

    if last_eval:
        checks = [
            ("Accuracy",    accuracy,              last_eval.accuracy,              "Model Drift"),
            ("Safety",      toxicity_score,         last_eval.toxicity_score,        "Concept Drift"),
            ("Instruction", instruction_following,  last_eval.instruction_following, "Concept Drift"),
            ("Relevance",   relevance_score,        last_eval.relevance_score,       "Model Drift"),
            ("Factuality",  factuality_score,       last_eval.factuality_score,      "Model Drift"),
        ]
        for label, current_val, last_val, d_type in checks:
            if current_val is not None and last_val is not None:
                if (last_val - current_val) > 30.0:
                    drift_triggered = True
                    drift_type   = d_type
                    drift_reason = f"{label} dropped from {last_val:.1f} to {current_val:.1f}"
                    break

    if not drift_triggered and quality_score < 60.0:
        drift_triggered = True
        deficits = [
            ("Accuracy Deficit",    accuracy),
            ("Alignment Gap",       toxicity_score),
            ("Instruction Failure", instruction_following),
        ]
        deficits = [(n, v) for n, v in deficits if v is not None and v < 50]
        if deficits:
            deficits.sort(key=lambda x: x[1])
            drift_type, worst_val = deficits[0]
            drift_reason = f"Metric critically low ({worst_val:.1f}%). Performance failure."
        else:
            drift_type   = "Low Performance"
            drift_reason = f"Average score ({quality_score:.1f}%) below 60% threshold."

    check_results = json.dumps({
        "dataset_type":      dataset_type,
        "dataset_label":     DATASET_LABELS.get(dataset_type, dataset_type),
        "samples_evaluated": len(per_sample_scores),
        "per_sample_scores": per_sample_scores,
    })

    evaluation = Evaluation(
        service_id=service_id,
        quality_score=round(quality_score, 2),
        check_results=check_results,
        drift_triggered=drift_triggered,
        drift_type=drift_type,
        drift_reason=drift_reason,
        latency_ms=latency_ms,
        dataset_type=dataset_type,
        accuracy=round(accuracy, 2),
        relevance_score=round(relevance_score, 2),
        factuality_score=round(factuality_score, 2),
        toxicity_score=round(toxicity_score, 2),
        instruction_following=round(instruction_following, 2),
    )

    db.add(evaluation)
    db.commit()
    db.refresh(evaluation)
    return evaluation
