import os
import json
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session, joinedload
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

class IncidentUpdate(BaseModel):
    symptoms: str
    timeline: str

class OpenTicketData(BaseModel):
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
    """Return all incidents with their maintenance records, ordered by created_at desc."""
    incidents = (
        db.query(Incident)
        .options(joinedload(Incident.maintenance_records))
        .order_by(Incident.created_at.desc())
        .all()
    )
    return incidents


@router.get("/{incident_id}")
def get_incident(incident_id: int, db: Session = Depends(get_db)):
    """Return single incident with maintenance records or 404."""
    incident = (
        db.query(Incident)
        .options(joinedload(Incident.maintenance_records))
        .filter(Incident.id == incident_id)
        .first()
    )
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
    incident = (
        db.query(Incident)
        .options(joinedload(Incident.maintenance_records))
        .filter(Incident.id == incident_id)
        .first()
    )
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
        
    if incident.status == "pending":
        prompt = (
            "Write a short internal incident summary (2-3 sentences) for an operations team. "
            "Restate the incident based on the symptoms and timeline — what is happening and what are the possible causes to investigate. "
            "Do NOT draw conclusions, do NOT say what was fixed, do NOT suggest future measures. The incident is still open and unresolved.\n\n"
            f"Severity: {incident.severity}\n"
            f"Observed symptoms: {incident.symptoms}\n"
            f"Timeline: {incident.timeline}\n"
            f"Checklist flags: {incident.checklist_json or 'none'}\n\n"
            "Return ONLY plain text sentences. No markdown, no headings, no sign-off."
        )
    else:
        plans = incident.maintenance_records or []
        plans_text = ""
        for i, p in enumerate(plans, 1):
            plans_text += (
                f"\nPlan {i}:"
                f"\n  Risk level: {p.risk_level}"
                f"\n  Rollback actions: {p.rollback_plan}"
                f"\n  Validation steps: {p.validation_steps}"
            )
        if not plans_text:
            plans_text = "No maintenance plans recorded."

        prompt = (
            "You are writing a full post-mortem conclusion report for an operations team. "
            "Using ALL the data below, write a cohesive paragraph (4-6 sentences) that covers:\n"
            "1. What happened — the nature of the incident, symptoms observed, and how it unfolded.\n"
            "2. What was done to fix it — the rollback actions and validation steps taken.\n"
            "3. What measures are now in place to prevent it from recurring.\n"
            "Write in past tense. Be specific and use the actual details provided. Do not add generic filler.\n\n"
            f"Severity: {incident.severity}\n"
            f"Symptoms: {incident.symptoms}\n"
            f"Timeline: {incident.timeline}\n"
            f"Diagnosis flags: {incident.checklist_json or 'none'}\n"
            f"Incident summary: {incident.llm_summary or 'not recorded'}\n"
            f"Maintenance plans:{plans_text}\n\n"
            "Return ONLY the plain text paragraph. No markdown, no bullet points, no headings, no sign-off."
        )
    
    try:
        client = openai.OpenAI(api_key=os.environ.get("OPENAI_KEY"))
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}]
        )
        draft = response.choices[0].message.content.strip()
        return draft
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI Generation Error: {str(e)}")


@router.put("/{incident_id}/approve-summary")
def approve_summary(incident_id: int, summary: SummaryApprove, db: Session = Depends(get_db)):
    """Save summary_text to llm_summary column, set approved=True, return updated incident."""
    incident = (
        db.query(Incident)
        .options(joinedload(Incident.maintenance_records))
        .filter(Incident.id == incident_id)
        .first()
    )
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    # Requirement: ALL maintenance plans must be approved to formally close this incident ticket
    if not incident.maintenance_records:
        raise HTTPException(
            status_code=400,
            detail="A maintenance plan is required to formally close this incident ticket."
        )

    approved_plans = [p for p in incident.maintenance_records if p.approved]
    if len(approved_plans) != len(incident.maintenance_records):
        raise HTTPException(
            status_code=400,
            detail="All maintenance plans must be approved to formally close this incident ticket."
        )

    incident.post_mortem = summary.summary_text
    incident.approved = True
    incident.status = "closed"
    
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


@router.put("/{incident_id}/open-ticket")
def open_ticket(incident_id: int, data: OpenTicketData, db: Session = Depends(get_db)):
    """Save AI summary and transition a pending incident to open status."""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    if incident.status != "pending":
        raise HTTPException(status_code=400, detail="Incident is not in pending state")

    incident.llm_summary = data.summary_text
    incident.status = "open"
    db.commit()
    db.refresh(incident)

    audit = AuditLog(
        user_id=None,
        action="incident.ticket_opened",
        resource=f"incidents/{incident_id}",
        details=(
            f"Incident #{incident_id} confirmed and opened as active ticket | "
            f"Summary: {data.summary_text[:150]}{'...' if len(data.summary_text) > 150 else ''}"
        ),
        timestamp=datetime.utcnow()
    )
    db.add(audit)
    db.commit()
    return incident


@router.put("/{incident_id}/reopen")
def reopen_incident(incident_id: int, db: Session = Depends(get_db)):
    """Reopen a closed incident, resetting it to open status."""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    if incident.status != "closed":
        raise HTTPException(status_code=400, detail="Incident is not closed")

    incident.status = "open"
    incident.approved = False

    db.commit()
    db.refresh(incident)

    audit = AuditLog(
        user_id=None,
        action="incident.reopened",
        resource=f"incidents/{incident_id}",
        details=f"Incident #{incident_id} reopened for further investigation.",
        timestamp=datetime.utcnow()
    )
    db.add(audit)
    db.commit()
    return incident


@router.put("/{incident_id}/details")
def update_incident_details(incident_id: int, updates: IncidentUpdate, db: Session = Depends(get_db)):
    """Update symptoms and timeline during active investigation."""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    if incident.status == "closed":
        raise HTTPException(status_code=400, detail="Cannot update details of a closed incident")
        
    # Standard Operational Procedure: Updating details on a pending ticket moves it to Active Investigation (Open)
    if incident.status == "pending":
        incident.status = "open"

    incident.symptoms = updates.symptoms
    incident.timeline = updates.timeline
    
    db.commit()
    db.refresh(incident)
    
    audit = AuditLog(
        user_id=None,
        action="incident.details_updated",
        resource=f"incidents/{incident_id}",
        details=f"Technical details (symptoms/timeline) updated for Incident #{incident_id} during investigation.",
        timestamp=datetime.utcnow()
    )
    db.add(audit)
    db.commit()
    return incident
