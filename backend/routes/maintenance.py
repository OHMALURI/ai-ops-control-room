from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# Handle relative vs absolute imports functionally dependent on execution directory
try:
    from database import get_db
    from models import Maintenance, AuditLog, Incident
    from auth import get_optional_user
except ImportError:
    from ..database import get_db
    from ..models import Maintenance, AuditLog, Incident
    from ..auth import get_optional_user

def _uid(user): return user.id if user else None
def _uname(user): return user.username if user else "system"

# Initialize router endpoint prefix and tags
router = APIRouter(prefix="/maintenance", tags=["Maintenance"])


# --- Pydantic Schemas ---

class MaintenanceCreate(BaseModel):
    incident_id: int
    risk_level: str
    rollback_plan: str
    validation_steps: str
    approved: bool = False

class MaintenanceOut(BaseModel):
    id: int
    incident_id: int
    risk_level: str
    rollback_plan: str
    validation_steps: str
    approved: bool
    next_eval_date: Optional[datetime] = None

    model_config = {"from_attributes": True}

class ScheduleUpdate(BaseModel):
    next_eval_date: str

class MaintenanceUpdate(BaseModel):
    risk_level: Optional[str] = None
    rollback_plan: Optional[str] = None
    validation_steps: Optional[str] = None
    approved: Optional[bool] = None
    next_eval_date: Optional[str] = None


# --- Routes ---

@router.post("", response_model=MaintenanceOut)
@router.post("/", response_model=MaintenanceOut)
def create_maintenance_plan(plan_data: MaintenanceCreate, db: Session = Depends(get_db), current_user=Depends(get_optional_user)):
    """Create a maintenance plan, save to DB, and return it."""
    # Instantiate ORM model from parsed Pydantic data
    new_plan = Maintenance(
        incident_id=plan_data.incident_id,
        risk_level=plan_data.risk_level,
        rollback_plan=plan_data.rollback_plan,
        validation_steps=plan_data.validation_steps,
        approved=plan_data.approved
    )

    db.add(new_plan)
    db.commit()
    db.refresh(new_plan)

    # Fetch incident and service info for audit log
    incident = db.query(Incident).filter(Incident.id == plan_data.incident_id).first()
    service_name = incident.service.name if incident and incident.service else "Unknown"
    service_env = incident.service.environment if incident and incident.service else "Unknown"

    audit = AuditLog(
        user_id=_uid(current_user),
        action="maintenance.create",
        resource=f"maintenance/{new_plan.id}",
        details=(
            f"Maintenance plan #{new_plan.id} created by {_uname(current_user)} | "
            f"Incident: #{new_plan.incident_id} | "
            f"Service: {service_name} ({service_env}) | "
            f"Risk: {new_plan.risk_level.upper()} | "
            f"Rollback: {new_plan.rollback_plan[:100]}{'...' if len(new_plan.rollback_plan) > 100 else ''} | "
            f"Validation: {new_plan.validation_steps[:100]}{'...' if len(new_plan.validation_steps) > 100 else ''}"
        ),
        timestamp=datetime.utcnow()
    )
    db.add(audit)
    db.commit()
    return new_plan


@router.get("")
@router.get("/")
def get_all_maintenance_plans(db: Session = Depends(get_db)):
    """Return all maintenance plans ordered by id desc."""
    return db.query(Maintenance).order_by(Maintenance.id.desc()).all()


@router.get("/{plan_id}")
def get_maintenance_plan(plan_id: int, db: Session = Depends(get_db)):
    """Return single plan or 404."""
    plan = db.query(Maintenance).filter(Maintenance.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Maintenance plan not found")
    return plan


@router.put("/{plan_id}/schedule")
def update_maintenance_schedule(plan_id: int, schedule: ScheduleUpdate, db: Session = Depends(get_db), current_user=Depends(get_optional_user)):
    """Parse next_eval_date string to datetime, save to next_eval_date column, return updated plan."""
    plan = db.query(Maintenance).filter(Maintenance.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Maintenance plan not found")

    # Safely digest string to python datetime format supporting ISO 8601 formatting
    try:
        # Patch JS standard 'Z' format representing +00:00 UTC timezone identifier for Python stdlib ISO parsing
        clean_date_str = schedule.next_eval_date.replace("Z", "+00:00")
        parsed_datetime = datetime.fromisoformat(clean_date_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Ensure using valid ISO 8601 strings")

    plan.next_eval_date = parsed_datetime

    db.commit()
    db.refresh(plan)

    # Fetch incident and service info for audit log
    incident = db.query(Incident).filter(Incident.id == plan.incident_id).first()
    service_name = incident.service.name if incident and incident.service else "Unknown"
    service_env = incident.service.environment if incident and incident.service else "Unknown"

    audit = AuditLog(
        user_id=_uid(current_user),
        action="maintenance.schedule_update",
        resource=f"maintenance/{plan_id}",
        details=(
            f"Maintenance plan #{plan_id} schedule set by {_uname(current_user)} | "
            f"Service: {service_name} ({service_env}) | "
            f"Next evaluation: {parsed_datetime.strftime('%Y-%m-%d %H:%M UTC')}"
        ),
        timestamp=datetime.utcnow()
    )
    db.add(audit)
    db.commit()
    return plan


@router.put("/{plan_id}/approve")
def approve_maintenance_plan(plan_id: int, db: Session = Depends(get_db), current_user=Depends(get_optional_user)):
    """Set approved=True, return updated plan."""
    plan = db.query(Maintenance).filter(Maintenance.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Maintenance plan not found")

    plan.approved = True

    db.commit()
    db.refresh(plan)

    # Fetch incident and service info for audit log
    incident = db.query(Incident).filter(Incident.id == plan.incident_id).first()
    service_name = incident.service.name if incident and incident.service else "Unknown"
    service_env = incident.service.environment if incident and incident.service else "Unknown"

    audit = AuditLog(
        user_id=_uid(current_user),
        action="maintenance.approved",
        resource=f"maintenance/{plan_id}",
        details=(
            f"Maintenance plan #{plan_id} approved by {_uname(current_user)} | "
            f"Service: {service_name} ({service_env}) | "
            f"Risk: {plan.risk_level.upper()}"
        ),
        timestamp=datetime.utcnow()
    )
    db.add(audit)
    db.commit()
    return plan


@router.put("/{plan_id}")
def update_maintenance_plan(plan_id: int, updates: MaintenanceUpdate, db: Session = Depends(get_db), current_user=Depends(get_optional_user)):
    """Universal update for maintenance plan fields."""
    plan = db.query(Maintenance).filter(Maintenance.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Maintenance plan not found")

    if updates.risk_level is not None:
        plan.risk_level = updates.risk_level
    if updates.rollback_plan is not None:
        plan.rollback_plan = updates.rollback_plan
    if updates.validation_steps is not None:
        plan.validation_steps = updates.validation_steps
    if updates.approved is not None:
        plan.approved = updates.approved

    if updates.next_eval_date is not None:
        try:
            clean_date_str = updates.next_eval_date.replace("Z", "+00:00")
            plan.next_eval_date = datetime.fromisoformat(clean_date_str)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format")

    db.commit()
    db.refresh(plan)

    # Fetch incident and service info for audit log
    incident = db.query(Incident).filter(Incident.id == plan.incident_id).first()
    service_name = incident.service.name if incident and incident.service else "Unknown"
    service_env = incident.service.environment if incident and incident.service else "Unknown"

    audit = AuditLog(
        user_id=_uid(current_user),
        action="maintenance.update",
        resource=f"maintenance/{plan_id}",
        details=f"Maintenance plan #{plan_id} updated by {_uname(current_user)} | Service: {service_name} ({service_env})",
        timestamp=datetime.utcnow()
    )
    db.add(audit)
    db.commit()
    return plan
