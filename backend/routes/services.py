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
def create_service(payload: ServiceCreate, db: Session = Depends(get_db)):
    """Create and persist a new service."""
    service = Service(**payload.model_dump())
    db.add(service)
    db.commit()
    db.refresh(service)
    audit = AuditLog(
        user_id=None,
        action="service.create",
        resource=f"services/{service.id}",
        details=f"Service {service.name} created",
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
    """Fetch available models from OpenAI and test their responsiveness."""
    import concurrent.futures
    api_key = os.environ.get("OPENAI_KEY")

    FALLBACK_MODELS = [
        "gpt-3.5-turbo",
        "gpt-4",
        "gpt-4-turbo",
        "gpt-4o",
        "gpt-4o-mini",
        "o1-mini",
        "o1-preview"
    ]

    if not api_key:
        return [{"id": m, "responsive": False, "reason": "no_key"} for m in FALLBACK_MODELS]

    client = openai.OpenAI(api_key=api_key)

    # Step 1: Try listing models — if this fails with auth error, key is bad
    try:
        models_response = client.models.list()
        chat_models = sorted([
            m.id for m in models_response.data
            if ("gpt" in m.id or m.id.startswith("o1") or m.id.startswith("o3"))
            and "vision" not in m.id and "audio" not in m.id and "realtime" not in m.id
        ])[:15]
    except openai.AuthenticationError:
        # Key is invalid — return fallback list with key_invalid reason, no pinging
        return [{"id": m, "responsive": False, "reason": "invalid_key"} for m in FALLBACK_MODELS]
    except Exception as e:
        print("Model list error:", e)
        chat_models = FALLBACK_MODELS

    # Step 2: Ping each model concurrently
    def test_model(model_id):
        try:
            client.chat.completions.create(
                model=model_id,
                messages=[{"role": "user", "content": "1"}],
                max_tokens=1,
                timeout=5.0
            )
            return {"id": model_id, "responsive": True}
        except openai.AuthenticationError:
            return {"id": model_id, "responsive": False, "reason": "invalid_key"}
        except Exception as e:
            return {"id": model_id, "responsive": False, "reason": "unresponsive", "error": str(e)}

    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        for future in concurrent.futures.as_completed(
            {executor.submit(test_model, mid): mid for mid in chat_models}
        ):
            results.append(future.result())

    results.sort(key=lambda x: x["id"])
    return results

@router.get("/{service_id}")
def get_service(service_id: int, db: Session = Depends(get_db)):
    """Return a single service by ID."""
    return _get_or_404(service_id, db)


@router.put("/{service_id}")
def update_service(
    service_id: int,
    payload: ServiceCreate,
    db: Session = Depends(get_db),
):
    """Update an existing service's fields."""
    service = _get_or_404(service_id, db)
    for field, value in payload.model_dump().items():
        setattr(service, field, value)
    db.commit()
    db.refresh(service)
    audit = AuditLog(
        user_id=None,
        action="service.update",
        resource=f"services/{service_id}",
        details=f"Service {service.id} updated",
        timestamp=datetime.utcnow()
    )
    db.add(audit)
    db.commit()
    return service


@router.delete("/{service_id}")
def delete_service(service_id: int, db: Session = Depends(get_db)):
    """Delete a service by ID."""
    service = _get_or_404(service_id, db)
    db.delete(service)
    db.commit()
    audit = AuditLog(
        user_id=None,
        action="service.delete",
        resource=f"services/{service_id}",
        details=f"Service {service_id} deleted",
        timestamp=datetime.utcnow()
    )
    db.add(audit)
    db.commit()
    return {"message": "Service deleted"}


@router.post("/{service_id}/test")
def test_service(service_id: int, db: Session = Depends(get_db)):
    """Ping the service's model to verify it is reachable."""
    service = _get_or_404(service_id, db)

    api_key = os.environ.get("OPENAI_KEY")
    start = time.time()

    try:
        # Use service's base_url if provided, else default to OpenAI
        client = openai.OpenAI(
            api_key=api_key,
            base_url=service.base_url if service.base_url else None
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



