import secrets
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import decode_token
from app.crud.user import get_user_by_id
from app.db.session import get_db
from app.models.user import User, UserRole

security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)
admin_key_header = APIKeyHeader(name="X-Admin-Key", auto_error=False)


def verify_admin_key(
    key: Annotated[str | None, Depends(admin_key_header)],
) -> str:
    settings = get_settings()
    if not key or not settings.admin_api_key or not secrets.compare_digest(key, settings.admin_api_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing Admin API Key",
        )
    return key



def get_current_user(
    db: Annotated[Session, Depends(get_db)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
):
    token = credentials.credentials
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )
    user_id = payload.get("sub")
    role = payload.get("role")
    if user_id is None or role is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )
    user = get_user_by_id(db, int(user_id))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


def get_current_student(
    user: Annotated[User, Depends(get_current_user)],
):
    if user.role != UserRole.student:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student access required",
        )
    return user


def get_current_vendor(
    user: Annotated[User, Depends(get_current_user)],
):
    if user.role != UserRole.vendor:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vendor access required",
        )
    return user


def get_current_admin(
    user: Annotated[User, Depends(get_current_user)],
):
    if user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user


def get_optional_current_user(
    db: Annotated[Session, Depends(get_db)],
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(optional_security)],
):
    """
    Resolve the caller from a bearer token without demanding one.

    Returns None for a missing, malformed, expired or unknown-subject token
    instead of raising, so this can gate endpoints that also accept an
    out-of-band credential. An invalid token is deliberately indistinguishable
    from no token here: this dependency decides *whether* a caller is
    authorised, it is not the place to report why a token was rejected.
    """
    if not credentials:
        return None
    try:
        return get_current_user(db, credentials)
    except HTTPException:
        return None


def require_admin_provisioner(
    key: Annotated[str | None, Depends(admin_key_header)],
    user: Annotated[User | None, Depends(get_optional_current_user)],
):
    """
    Gate user-provisioning endpoints on EITHER the shared bootstrap key OR a
    logged-in admin session.

    Provisioning used to require ADMIN_API_KEY alone, which meant the admin
    dashboard had no way to create an account: the browser holds an admin JWT
    and cannot be given the shared key without leaking a credential that mints
    admins. Accepting either credential keeps the key working as the bootstrap
    path for the very first admin, and lets an already-authenticated admin
    provision accounts without the key ever leaving the server.
    """
    if user is not None and user.role == UserRole.admin and user.is_active:
        return user

    settings = get_settings()
    if key and settings.admin_api_key and secrets.compare_digest(key, settings.admin_api_key):
        return None

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Provisioning requires an authenticated admin session or a valid Admin API Key.",
    )
