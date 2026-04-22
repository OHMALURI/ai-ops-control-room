import os
from datetime import datetime, timedelta

from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from database import get_db
from models import User, TempAdminGrant

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

SECRET_KEY = os.environ.get("JWT_SECRET", "fallback-secret")
ALGORITHM = "HS256"

# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Return sha256_crypt hash of plain-text password."""
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if plain matches hashed password."""
    return pwd_context.verify(plain, hashed)


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def create_access_token(data: dict) -> str:
    """Create a signed JWT with a 24-hour expiry and return the token string."""
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(hours=24)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


# ---------------------------------------------------------------------------
# Dependency
# ---------------------------------------------------------------------------

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Decode JWT, look up the user in the DB, and return the User object.

    Raises HTTP 401 if the token is invalid or the user no longer exists.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    return user


def get_effective_role(user_id: int, db) -> str:
    """Returns 'admin' if user has an active temp grant, otherwise their real role."""
    from datetime import datetime as _dt
    grant = db.query(TempAdminGrant).filter(
        TempAdminGrant.user_id == user_id,
        TempAdminGrant.status == "approved",
        TempAdminGrant.expires_at > _dt.utcnow(),
    ).first()
    if grant:
        return "admin"
    user = db.query(User).filter(User.id == user_id).first()
    return user.role if user else "user"


def is_temp_admin(user_id: int, db) -> bool:
    """True if the user's admin status comes from a temp grant, not their real role."""
    from datetime import datetime as _dt
    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.role == "admin":
        return False
    return db.query(TempAdminGrant).filter(
        TempAdminGrant.user_id == user_id,
        TempAdminGrant.status == "approved",
        TempAdminGrant.expires_at > _dt.utcnow(),
    ).first() is not None


def get_optional_user(
    token: str = Depends(oauth2_scheme_optional),
    db: Session = Depends(get_db),
) -> User | None:
    """Like get_current_user but returns None instead of raising if no/bad token."""
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            return None
        return db.query(User).filter(User.id == int(user_id)).first()
    except JWTError:
        return None
