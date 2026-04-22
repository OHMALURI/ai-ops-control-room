import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from database import get_db
from models import AuditLog, Evaluation, Incident, Maintenance, User
from auth import get_current_user, get_effective_role

router = APIRouter(prefix="/governance", tags=["Governance"])


def _row_to_dict(obj) -> dict:
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}


def _build_query(db, from_date=None, to_date=None, action=None, user_id=None):
    q = db.query(AuditLog)
    if from_date:
        q = q.filter(AuditLog.timestamp >= from_date)
    if to_date:
        q = q.filter(AuditLog.timestamp <= to_date)
    if action:
        q = q.filter(AuditLog.action == action)
    if user_id is not None:
        q = q.filter(AuditLog.user_id == user_id)
    return q.order_by(AuditLog.timestamp.desc())


def _enrich_rows(rows, db):
    """Attach username to each audit log row."""
    user_ids = {r.user_id for r in rows if r.user_id is not None}
    username_map = {}
    if user_ids:
        for u in db.query(User).filter(User.id.in_(user_ids)).all():
            username_map[u.id] = u.username

    result = []
    for r in rows:
        d = _row_to_dict(r)
        d["username"] = username_map.get(r.user_id) if r.user_id else "system"
        result.append(d)
    return result


def _parse_date(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    return datetime.fromisoformat(s.replace("Z", "").replace("z", ""))


def _require_admin(user: User, db: Session):
    """Check if the user has admin or effective admin privileges."""
    eff = get_effective_role(user.id, db)
    if eff != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/audit-log")
def get_audit_log(
    from_date: Optional[str] = Query(None),
    to_date:   Optional[str] = Query(None),
    action:    Optional[str] = Query(None),
    user_id:   Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return audit log entries with optional filters. Admin only."""
    _require_admin(current_user, db)

    rows = _build_query(
        db,
        _parse_date(from_date),
        _parse_date(to_date),
        action or None,
        user_id,
    ).all()

    return _enrich_rows(rows, db)


@router.get("/audit-log/actions")
def get_distinct_actions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all distinct action strings for the filter dropdown. Admin only."""
    _require_admin(current_user, db)
    rows = db.query(AuditLog.action).distinct().all()
    return sorted(r[0] for r in rows)


@router.get("/audit-log/users")
def get_audit_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all users that appear in audit log (for filter dropdown). Admin only."""
    _require_admin(current_user, db)
    user_ids = (
        db.query(AuditLog.user_id)
        .filter(AuditLog.user_id.isnot(None))
        .distinct()
        .all()
    )
    ids = [r[0] for r in user_ids]
    if not ids:
        return []
    users = db.query(User).filter(User.id.in_(ids)).all()
    return [{"id": u.id, "username": u.username, "role": u.role} for u in users]


@router.get("/audit-log/download")
def download_audit_log(
    from_date: Optional[str] = Query(None),
    to_date:   Optional[str] = Query(None),
    action:    Optional[str] = Query(None),
    user_id:   Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download filtered audit log as a JSON file. Admin only."""
    _require_admin(current_user, db)

    rows = _build_query(
        db,
        _parse_date(from_date),
        _parse_date(to_date),
        action or None,
        user_id,
    ).all()

    enriched = _enrich_rows(rows, db)

    filter_parts = []
    if action:   filter_parts.append(f"action={action}")
    if user_id:  filter_parts.append(f"user_id={user_id}")
    if from_date: filter_parts.append(f"from={from_date}")
    if to_date:   filter_parts.append(f"to={to_date}")
    filter_str = ", ".join(filter_parts) if filter_parts else "none"

    db.add(AuditLog(
        user_id=current_user.id,
        action="governance.audit_log_downloaded",
        resource="governance/audit-log/download",
        details=(
            f"Audit log downloaded by {current_user.username} | "
            f"{len(enriched)} entries exported | Filters: {filter_str}"
        ),
        timestamp=datetime.utcnow(),
    ))
    db.commit()

    filename = f"audit_log_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
    return JSONResponse(
        content=json.loads(json.dumps(enriched, default=str)),
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/export")
def export_compliance(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export full compliance snapshot as JSON. Admin only."""
    _require_admin(current_user, db)

    all_audit = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).all()
    payload = {
        "exported_at":          datetime.utcnow().isoformat(),
        "exported_by":          current_user.username,
        "evaluation_summaries": [_row_to_dict(r) for r in db.query(Evaluation).all()],
        "incident_list":        [_row_to_dict(r) for r in db.query(Incident).all()],
        "maintenance_actions":  [_row_to_dict(r) for r in db.query(Maintenance).all()],
        "audit_log_entries":    _enrich_rows(all_audit, db),
    }

    db.add(AuditLog(
        user_id=current_user.id,
        action="governance.compliance_exported",
        resource="governance/export",
        details=f"Full compliance export downloaded by {current_user.username}",
        timestamp=datetime.utcnow(),
    ))
    db.commit()

    return JSONResponse(
        content=json.loads(json.dumps(payload, default=str)),
        headers={"Content-Disposition": "attachment; filename=compliance_export.json"},
    )
