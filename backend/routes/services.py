import os
import time
from typing import Optional
from datetime import datetime

import openai
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Service, AuditLog
from auth import get_optional_user

def _uid(user): return user.id if user else None
def _uname(user): return user.username if user else "system"

load_dotenv()

router = APIRouter(prefix="/services", tags=["Services"])


# ---------------------------------------------------------------------------
# Pydantic schema
# ---------------------------------------------------------------------------

class ServiceCreate(BaseModel):
    name: str
    owner: str
    environment: str
    model_name: str
    base_url: Optional[str] = None
    system_prompt: Optional[str] = None
    api_key_ref: Optional[str] = None
    data_sensitivity: str


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _get_or_404(service_id: int, db: Session) -> Service:
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    return service


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/", status_code=201)
def create_service(payload: ServiceCreate, db: Session = Depends(get_db), current_user=Depends(get_optional_user)):
    """Create and persist a new service."""
    service = Service(**payload.model_dump())
    db.add(service)
    db.commit()
    db.refresh(service)
    audit = AuditLog(
        user_id=_uid(current_user),
        action="service.create",
        resource=f"services/{service.id}",
        details=(
            f"Service created by {_uname(current_user)} | Name: {service.name} | Owner: {service.owner} | "
            f"Environment: {service.environment} | Model: {service.model_name} | "
            f"Sensitivity: {service.data_sensitivity}"
        ),
        timestamp=datetime.utcnow()
    )
    db.add(audit)
    db.commit()
    return service


@router.get("/")
def list_services(db: Session = Depends(get_db)):
    """Return all services."""
    return db.query(Service).all()



@router.get("/available-models")
def get_available_models(db: Session = Depends(get_db)):
    """Fetch available OpenAI chat models and test their responsiveness."""
    import concurrent.futures

    FALLBACK_MODELS = [
        "gpt-3.5-turbo", "gpt-4", "gpt-4-turbo",
        "gpt-4o", "gpt-4o-mini", "o1-mini", "o1-preview",
    ]

    api_key = os.environ.get("OPENAI_KEY") or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return [{"id": m, "responsive": False, "reason": "no_key"} for m in FALLBACK_MODELS]

    client = openai.OpenAI(api_key=api_key)

    try:
        models_response = client.models.list()
        chat_models = sorted([
            m.id for m in models_response.data
            if ("gpt" in m.id or m.id.startswith("o1") or m.id.startswith("o3"))
            and "vision" not in m.id and "audio" not in m.id and "realtime" not in m.id
        ])[:15]
    except openai.AuthenticationError:
        return [{"id": m, "responsive": False, "reason": "invalid_key"} for m in FALLBACK_MODELS]
    except Exception as e:
        print(f"[services] OpenAI model list error: {e}")
        chat_models = FALLBACK_MODELS

    def ping_model(model_id):
        try:
            client.chat.completions.create(
                model=model_id,
                messages=[{"role": "user", "content": "1"}],
                max_tokens=1,
                timeout=5.0,
            )
            return {"id": model_id, "responsive": True}
        except openai.AuthenticationError:
            return {"id": model_id, "responsive": False, "reason": "invalid_key"}
        except Exception:
            return {"id": model_id, "responsive": False, "reason": "unresponsive"}

    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        for future in concurrent.futures.as_completed(
            {executor.submit(ping_model, mid): mid for mid in chat_models}
        ):
            results.append(future.result())

    results.sort(key=lambda x: x["id"])
    return results

@router.get("/test-gemini")
def test_gemini_connection():
    """
    Ping the Gemini API with a minimal prompt and return connection status,
    latency, the active model name, and a snippet of the response.
    """
    import os as _os
    api_key = _os.getenv("GEMINI_API_KEY")
    if not api_key:
        return {
            "success": False,
            "latency_ms": 0,
            "model": None,
            "response_snippet": None,
            "error": "GEMINI_API_KEY is not set in .env",
        }

    try:
        import google.generativeai as genai
    except ImportError:
        return {
            "success": False,
            "latency_ms": 0,
            "model": None,
            "response_snippet": None,
            "error": "google-generativeai package not installed (pip install google-generativeai)",
        }

    model_name = _os.getenv("GEMINI_JUDGE_MODEL", "gemini-2.5-flash")
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(model_name)

    start = time.time()
    try:
        resp = model.generate_content("Reply with exactly two words: API OK")
        latency_ms = int((time.time() - start) * 1000)
        snippet = resp.text.strip()[:120] if resp.text else "(empty response)"
        return {
            "success": True,
            "latency_ms": latency_ms,
            "model": model_name,
            "response_snippet": snippet,
            "error": None,
        }
    except Exception as exc:
        latency_ms = int((time.time() - start) * 1000)
        return {
            "success": False,
            "latency_ms": latency_ms,
            "model": model_name,
            "response_snippet": None,
            "error": str(exc),
        }


@router.get("/{service_id}")
def get_service(service_id: int, db: Session = Depends(get_db)):
    """Return a single service by ID."""
    return _get_or_404(service_id, db)


@router.put("/{service_id}")
def update_service(
    service_id: int,
    payload: ServiceCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_optional_user),
):
    """Update an existing service's fields."""
    service = _get_or_404(service_id, db)
    for field, value in payload.model_dump().items():
        setattr(service, field, value)
    db.commit()
    db.refresh(service)
    audit = AuditLog(
        user_id=_uid(current_user),
        action="service.update",
        resource=f"services/{service_id}",
        details=(
            f"Service updated by {_uname(current_user)} | Name: {service.name} | Owner: {service.owner} | "
            f"Environment: {service.environment} | Model: {service.model_name} | "
            f"Sensitivity: {service.data_sensitivity}"
        ),
        timestamp=datetime.utcnow()
    )
    db.add(audit)
    db.commit()
    return service


@router.delete("/{service_id}")
def delete_service(service_id: int, db: Session = Depends(get_db), current_user=Depends(get_optional_user)):
    """Delete a service by ID."""
    service = _get_or_404(service_id, db)
    db.delete(service)
    db.commit()
    audit = AuditLog(
        user_id=_uid(current_user),
        action="service.delete",
        resource=f"services/{service_id}",
        details=(
            f"Service permanently deleted by {_uname(current_user)} | Name: {service.name} | "
            f"Owner: {service.owner} | Environment: {service.environment} | "
            f"Model: {service.model_name}"
        ),
        timestamp=datetime.utcnow()
    )
    db.add(audit)
    db.commit()
    return {"message": "Service deleted"}


@router.post("/{service_id}/test")
def test_service(service_id: int, db: Session = Depends(get_db)):
    """Ping the service's model to verify it is reachable."""
    service = _get_or_404(service_id, db)

    api_key = os.environ.get("OPENAI_KEY") or os.environ.get("OPENAI_API_KEY")
    start = time.time()

    try:
        client = openai.OpenAI(
            api_key=api_key,
            base_url=service.base_url if service.base_url else None,
        )
        client.chat.completions.create(
            model=service.model_name,
            messages=[{"role": "user", "content": "Say OK"}],
            max_tokens=5,
        )
        latency_ms = int((time.time() - start) * 1000)
        return {"success": True, "latency_ms": latency_ms}
    except Exception as exc:
        return {"success": False, "latency_ms": 0, "error": str(exc)}



