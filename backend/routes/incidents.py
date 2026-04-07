import os
import json
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
import openai
from dotenv import load_dotenv

# Compatibility handle for local testing execution paths vs module path
try:
    from database import get_db
    from models import Service, Incident, AuditLog
except ImportError:
    from ..database import get_db
    from ..models import Service, Incident, AuditLog

# Load environment variables (such as OPENAI_KEY from .env)
load_dotenv()

router = APIRouter(
    prefix="/incidents",
    tags=["Incidents"]
)


# --- Pydantic Models ---
class IncidentCreate(BaseModel):
    service_id: int
    severity: str
    symptoms: str
    timeline: str

class ChecklistUpdate(BaseModel):
    data_issue: bool
    prompt_change: bool
    model_update: bool
    infrastructure: bool
    safety_failure: bool

class SummaryApprove(BaseModel):
    summary_text: str


# --- Routes ---

@router.post("")
@router.post("/")
def create_incident(data: IncidentCreate, db: Session = Depends(get_db)):
    """Create incident, save to DB, return it."""
    # Validate the associated service exists
    service = db.query(Service).filter(Service.id == data.service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
        
    new_incident = Incident(
        service_id=data.service_id,
        severity=data.severity,
        symptoms=data.symptoms,
        timeline=data.timeline
    )
    db.add(new_incident)
    db.commit()
    db.refresh(new_incident)
    audit = AuditLog(
        user_id=None,
        action="incident.create",
        resource=f"incidents/{new_incident.id}",
        details=(
            f"Incident #{new_incident.id} created | "
            f"Service: {service.name} ({service.environment}) | "
            f"Severity: {new_incident.severity.upper()} | "
            f"Symptoms: {new_incident.symptoms[:120]}{'...' if len(new_incident.symptoms) > 120 else ''} | "
            f"Timeline: {new_incident.timeline[:80]}{'...' if len(new_incident.timeline) > 80 else ''}"
        ),
        timestamp=datetime.utcnow()
    )
    db.add(audit)
    db.commit()
    return new_incident


@router.get("")
@router.get("/")
def get_incidents(db: Session = Depends(get_db)):
    """Return all incidents ordered by created_at desc."""
    incidents = db.query(Incident).order_by(Incident.created_at.desc()).all()
    return incidents


@router.get("/{incident_id}")
def get_incident(incident_id: int, db: Session = Depends(get_db)):
    """Return single incident or 404."""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


@router.put("/{incident_id}/checklist")
def update_checklist(incident_id: int, checklist: ChecklistUpdate, db: Session = Depends(get_db)):
    """Save ChecklistUpdate as JSON to checklist_json column, return updated incident."""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    # Dump Pydantic model representation recursively into a valid JSON strong
    incident.checklist_json = json.dumps(checklist.model_dump())
    db.commit()
    db.refresh(incident)
    checked_items = [k for k, v in checklist.model_dump().items() if v]
    audit = AuditLog(
        user_id=None,
        action="incident.checklist_update",
        resource=f"incidents/{incident_id}",
        details=(
            f"Incident #{incident_id} checklist updated | "
            f"Checked items: {', '.join(checked_items) if checked_items else 'none'}"
        ),
        timestamp=datetime.utcnow()
    )
    db.add(audit)
    db.commit()
    return incident


@router.post("/{incident_id}/generate-summary")
def generate_summary(incident_id: int, db: Session = Depends(get_db)):
    """Build prompt from incident fields, call OpenAI gpt-4o-mini, return ONLY the draft text."""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
        
    prompt = (
        "Generate a clear, professional post-mortem summary narrative based entirely on the following operational incident data:\n"
        f"Severity: {incident.severity}\n"
        f"Symptoms: {incident.symptoms}\n"
        f"Timeline: {incident.timeline}\n"
        f"Findings Checklist (JSON): {incident.checklist_json or 'None recorded'}\n\n"
        "Return ONLY the plain text paragraph. Do not return Markdown wrappers or chat pleasantries."
    )
    
    try:
        client = openai.OpenAI(api_key=os.environ.get("OPENAI_KEY"))
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}]
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI Generation Error: {str(e)}")


@router.put("/{incident_id}/approve-summary")
def approve_summary(incident_id: int, summary: SummaryApprove, db: Session = Depends(get_db)):
    """Save summary_text to llm_summary column, set approved=True, return updated incident."""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
        
    incident.llm_summary = summary.summary_text
    incident.approved = True
    
    db.commit()
    db.refresh(incident)
    audit = AuditLog(
        user_id=None,
        action="incident.summary_approved",
        resource=f"incidents/{incident_id}",
        details=(
            f"Incident #{incident_id} post-mortem approved | "
            f"Summary: {summary.summary_text[:150]}{'...' if len(summary.summary_text) > 150 else ''}"
        ),
        timestamp=datetime.utcnow()
    )
    db.add(audit)
    db.commit()
    return incident
