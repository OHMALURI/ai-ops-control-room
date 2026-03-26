import json

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from database import get_db
from models import AuditLog, Evaluation, Incident, Maintenance, User
from auth import get_current_user

router = APIRouter(prefix="/governance", tags=["Governance"])


# ---------------------------------------------------------------------------
# Helper: convert a SQLAlchemy row to a plain dict
# ---------------------------------------------------------------------------

def _row_to_dict(obj) -> dict:
    """Return a dict of all mapped column values for a SQLAlchemy ORM instance."""
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/audit-log")
def get_audit_log(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all audit log entries ordered by timestamp descending."""
    rows = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).all()
    return rows


@router.get("/export")
def export_compliance(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export all governance data as a downloadable JSON file."""
    payload = {
        "evaluation_summaries": [_row_to_dict(r) for r in db.query(Evaluation).all()],
        "incident_list":        [_row_to_dict(r) for r in db.query(Incident).all()],
        "maintenance_actions":  [_row_to_dict(r) for r in db.query(Maintenance).all()],
        "audit_log_entries":    [_row_to_dict(r) for r in db.query(AuditLog).order_by(AuditLog.timestamp.desc()).all()],
    }

    return JSONResponse(
        content=json.loads(json.dumps(payload, default=str)),  # coerce datetimes → strings
        headers={"Content-Disposition": "attachment; filename=compliance_export.json"},
    )
