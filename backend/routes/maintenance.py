from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from datetime import datetime

# Handle relative vs absolute imports functionally dependent on execution directory
try:
    from database import get_db
    from models import Maintenance, AuditLog
except ImportError:
    from ..database import get_db
    from ..models import Maintenance, AuditLog

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

    class Config:
        orm_mode = True

class ScheduleUpdate(BaseModel):
    next_eval_date: str


# --- Routes ---

@router.post("", response_model=MaintenanceOut)
@router.post("/", response_model=MaintenanceOut)
def create_maintenance_plan(plan_data: MaintenanceCreate, db: Session = Depends(get_db)):
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
    audit = AuditLog(
        user_id=None,
        action="maintenance.create",
        resource=f"maintenance/{new_plan.id}",
        details=f"Maintenance plan created with risk level {new_plan.risk_level}",
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
def update_maintenance_schedule(plan_id: int, schedule: ScheduleUpdate, db: Session = Depends(get_db)):
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
    audit = AuditLog(
        user_id=None,
        action="maintenance.schedule_update",
        resource=f"maintenance/{plan_id}",
        details=f"Schedule updated for maintenance plan {plan_id}",
        timestamp=datetime.utcnow()
    )
    db.add(audit)
    db.commit()
    return plan


@router.put("/{plan_id}/approve")
def approve_maintenance_plan(plan_id: int, db: Session = Depends(get_db)):
    """Set approved=True, return updated plan."""
    plan = db.query(Maintenance).filter(Maintenance.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Maintenance plan not found")
        
    plan.approved = True
    
    db.commit()
    db.refresh(plan)
    audit = AuditLog(
        user_id=None,
        action="maintenance.approved",
        resource=f"maintenance/{plan_id}",
        details=f"Maintenance plan {plan_id} approved",
        timestamp=datetime.utcnow()
    )
    db.add(audit)
    db.commit()
    return plan
