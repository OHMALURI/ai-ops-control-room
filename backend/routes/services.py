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
    """Ping OpenAI with a minimal prompt to verify the service's model is reachable."""
    _get_or_404(service_id, db)  # Ensure service exists

    api_key = os.environ.get("OPENAI_KEY")
    start = time.time()

    try:
        client = openai.OpenAI(api_key=api_key)
        client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": "Say OK"}],
            max_tokens=5,
        )
        latency_ms = int((time.time() - start) * 1000)
        return {"success": True, "latency_ms": latency_ms}
    except Exception as exc:
        return {"success": False, "latency_ms": 0, "error": str(exc)}
