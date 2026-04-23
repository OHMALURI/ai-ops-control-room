from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Literal, Optional

from database import get_db
from models import User, AuditLog, TempAdminGrant
from auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, get_effective_role, is_temp_admin,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class UserRegister(BaseModel):
    username: str
    email: str
    password: str
    role: Literal["admin", "maintainer", "user"] = "user"

class UserLogin(BaseModel):
    username: str
    password: str

class RoleUpdate(BaseModel):
    role: Literal["admin", "maintainer", "user"]

class UserUpdate(BaseModel):
    role: Optional[Literal["admin", "maintainer", "user"]] = None
    email: Optional[str] = None
    password: Optional[str] = None

class TempAccessRequest(BaseModel):
    reason: str
    duration_hours: float  # supports fractional hours e.g. 0.083 = 5 min


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/register", status_code=201)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        username=payload.username,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    db.add(AuditLog(
        user_id=user.id,
        action="auth.user_registered",
        resource=f"auth/users/{user.id}",
        details=f"New user registered | Username: {user.username} | Email: {user.email} | Role: {user.role}",
        timestamp=datetime.utcnow(),
    ))
    db.commit()

    return {"id": user.id, "username": user.username, "email": user.email, "role": user.role}


@router.post("/login")
def login(payload: UserLogin, db: Session = Depends(get_db)):
    # Check both username and email for login
    user = db.query(User).filter(
        (User.username == payload.username) | (User.email == payload.username)
    ).first()
    
    if not user or not verify_password(payload.password, user.password_hash):
        print(f"Login failed for: {payload.username}")
        raise HTTPException(status_code=401, detail="Invalid username or password")

    effective = get_effective_role(user.id, db)
    token = create_access_token(
        data={"sub": str(user.id), "username": user.username, "role": user.role}
    )

    db.add(AuditLog(
        user_id=user.id,
        action="auth.login",
        resource=f"auth/users/{user.id}",
        details=f"User logged in | Username: {user.username} | Role: {user.role}",
        timestamp=datetime.utcnow(),
    ))
    db.commit()

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "effective_role": effective,
        "username": user.username,
    }


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Return current user with their effective role (may be elevated by temp grant)."""
    effective = get_effective_role(current_user.id, db)
    temp = is_temp_admin(current_user.id, db)

    grant = None
    if temp:
        from models import TempAdminGrant as TG
        grant = db.query(TG).filter(
            TG.user_id == current_user.id,
            TG.status == "approved",
        ).order_by(TG.expires_at.desc()).first()

    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role,
        "effective_role": effective,
        "is_temp_admin": temp,
        "temp_expires_at": grant.expires_at.isoformat() if grant else None,
    }


@router.get("/users")
def list_users(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    eff = get_effective_role(current_user.id, db)
    if eff != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    users = db.query(User).all()
    return [
        {"id": u.id, "username": u.username, "email": u.email, "role": u.role, "created_at": u.created_at}
        for u in users
    ]


@router.put("/users/{username}/update")
def update_user(
    username: str,
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    target = db.query(User).filter(User.username == username).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    # Check permissions
    eff = get_effective_role(current_user.id, db)
    is_admin = (eff == "admin")
    is_self = (target.id == current_user.id)

    if not is_admin and not is_self:
        raise HTTPException(status_code=403, detail="Admin access required to modify other users")

    details = []

    # 1. Update Role (Admin Only, never for self)
    if payload.role is not None:
        if not is_admin:
            raise HTTPException(status_code=403, detail="Only admins can update roles.")
        
        if is_self:
            raise HTTPException(status_code=400, detail="You cannot change your own role.")

        # Temp admins protection
        if is_temp_admin(current_user.id, db):
            if target.role == "admin" or payload.role == "admin":
                raise HTTPException(
                    status_code=403,
                    detail="Temporary admins cannot modify admin-role accounts or promote users to admin."
                )
        
        old_role = target.role
        target.role = payload.role
        details.append(f"Role: {old_role} → {payload.role}")

    # 2. Update Email (Admin or Self)
    if payload.email is not None:
        if payload.email != target.email:
            if db.query(User).filter(User.email == payload.email).first():
                raise HTTPException(status_code=400, detail="Email already taken")
            old_email = target.email
            target.email = payload.email
            details.append(f"Email: {old_email} → {payload.email}")

    # 3. Update Password (Admin or Self)
    if payload.password is not None and payload.password.strip():
        target.password_hash = hash_password(payload.password)
        details.append("Password updated")

    if not details:
        return {"id": target.id, "username": target.username, "email": target.email, "role": target.role}

    db.commit()
    db.refresh(target)

    action = "auth.user_updated" if is_admin else "auth.self_update"
    db.add(AuditLog(
        user_id=current_user.id,
        action=action,
        resource=f"auth/users/{target.id}",
        details=f"Updates for {target.username}: {', '.join(details)} | By: {current_user.username}",
        timestamp=datetime.utcnow(),
    ))
    db.commit()
    return {"id": target.id, "username": target.username, "email": target.email, "role": target.role}

# ---------------------------------------------------------------------------
# Temp admin access
# ---------------------------------------------------------------------------

@router.post("/temp-access/request", status_code=201)
def request_temp_access(
    payload: TempAccessRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "maintainer":
        raise HTTPException(status_code=403, detail="Only maintainers can request temporary admin access.")

    # Cancel any existing pending request first
    existing = db.query(TempAdminGrant).filter(
        TempAdminGrant.user_id == current_user.id,
        TempAdminGrant.status == "pending",
    ).first()
    if existing:
        existing.status = "cancelled"
        db.commit()

    grant = TempAdminGrant(
        user_id=current_user.id,
        reason=payload.reason,
        duration_hours=payload.duration_hours,
        status="pending",
    )
    db.add(grant)
    db.commit()
    db.refresh(grant)

    db.add(AuditLog(
        user_id=current_user.id,
        action="auth.temp_access_requested",
        resource=f"auth/temp-access/{grant.id}",
        details=f"{current_user.username} requested {payload.duration_hours}h temp admin | Reason: {payload.reason}",
        timestamp=datetime.utcnow(),
    ))
    db.commit()
    return grant


@router.get("/temp-access/requests")
def list_temp_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List temp access requests. Admins see all, others see only their own."""
    eff = get_effective_role(current_user.id, db)
    
    query = db.query(TempAdminGrant)
    
    # If not a full admin, only show own requests
    if current_user.role != "admin":
        query = query.filter(TempAdminGrant.user_id == current_user.id)
    # If a temp admin, they can see all (for auditing) or just their own?
    # Usually temp admins should be able to see the queue they might be helping with,
    # but the user said "maintainers should see their requestlogs".
    # Let's keep it strict: if base role is not admin, filter.
    
    grants = query.order_by(TempAdminGrant.created_at.desc()).all()
    result = []
    for g in grants:
        result.append({
            "id": g.id,
            "user_id": g.user_id,
            "username": g.requester.username if g.requester else "—",
            "reason": g.reason,
            "duration_hours": g.duration_hours,
            "status": g.status,
            "expires_at": g.expires_at.isoformat() if g.expires_at else None,
            "created_at": g.created_at.isoformat(),
            "granted_by": g.approver.username if g.approver else None,
        })
    return result


@router.get("/temp-access/my-request")
def my_temp_request(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns the latest temp access request for the current user."""
    grant = db.query(TempAdminGrant).filter(
        TempAdminGrant.user_id == current_user.id,
    ).order_by(TempAdminGrant.created_at.desc()).first()

    if not grant:
        return None

    return {
        "id": grant.id,
        "reason": grant.reason,
        "duration_hours": grant.duration_hours,
        "status": grant.status,
        "expires_at": grant.expires_at.isoformat() if grant.expires_at else None,
        "created_at": grant.created_at.isoformat(),
    }


@router.put("/temp-access/{grant_id}/approve")
def approve_temp_access(
    grant_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only real admins can approve temp access.")

    grant = db.query(TempAdminGrant).filter(TempAdminGrant.id == grant_id).first()
    if not grant:
        raise HTTPException(status_code=404, detail="Request not found")
    if grant.status != "pending":
        raise HTTPException(status_code=400, detail=f"Request is already {grant.status}")

    grant.status = "approved"
    grant.granted_by = current_user.id
    grant.expires_at = datetime.utcnow() + timedelta(hours=grant.duration_hours)
    db.commit()
    db.refresh(grant)

    db.add(AuditLog(
        user_id=current_user.id,
        action="auth.temp_access_approved",
        resource=f"auth/temp-access/{grant_id}",
        details=(
            f"Temp admin access approved for {grant.requester.username} | "
            f"Duration: {grant.duration_hours}h | Expires: {grant.expires_at.strftime('%Y-%m-%d %H:%M UTC')}"
        ),
        timestamp=datetime.utcnow(),
    ))
    db.commit()
    return {"message": "Approved", "expires_at": grant.expires_at.isoformat()}


@router.put("/temp-access/{grant_id}/reject")
def reject_temp_access(
    grant_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only real admins can reject temp access.")

    grant = db.query(TempAdminGrant).filter(TempAdminGrant.id == grant_id).first()
    if not grant:
        raise HTTPException(status_code=404, detail="Request not found")
    if grant.status != "pending":
        raise HTTPException(status_code=400, detail=f"Request is already {grant.status}")

    grant.status = "rejected"
    grant.granted_by = current_user.id
    db.commit()

    db.add(AuditLog(
        user_id=current_user.id,
        action="auth.temp_access_rejected",
        resource=f"auth/temp-access/{grant_id}",
        details=f"Temp admin request #{grant_id} rejected for {grant.requester.username} by {current_user.username}",
        timestamp=datetime.utcnow(),
    ))
    db.commit()
    return {"message": "Rejected"}
