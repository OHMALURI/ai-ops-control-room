from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Literal

from database import get_db
from models import User, AuditLog
from auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["Auth"])


# ---------------------------------------------------------------------------
# Pydantic schemas
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


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/register", status_code=201)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    """Register a new user. Returns user object (without password_hash)."""
    existing = db.query(User).filter(User.username == payload.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")

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
        details=(
            f"New user registered | Username: {user.username} | "
            f"Email: {user.email} | Role: {user.role}"
        ),
        timestamp=datetime.utcnow(),
    ))
    db.commit()

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
    }


@router.post("/login")
def login(payload: UserLogin, db: Session = Depends(get_db)):
    """Authenticate user and return a signed JWT access token."""
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")

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
        "username": user.username,
    }


@router.get("/users")
def list_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all users. Admin role required."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return db.query(User).all()


@router.put("/users/{username}/role")
def update_role(
    username: str,
    payload: RoleUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a user's role. Admin role required."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old_role = user.role
    user.role = payload.role
    db.commit()
    db.refresh(user)

    db.add(AuditLog(
        user_id=current_user.id,
        action="auth.role_updated",
        resource=f"auth/users/{user.id}",
        details=(
            f"Role changed for {user.username} | "
            f"{old_role} → {payload.role} | "
            f"Changed by: {current_user.username}"
        ),
        timestamp=datetime.utcnow(),
    ))
    db.commit()

    return user
