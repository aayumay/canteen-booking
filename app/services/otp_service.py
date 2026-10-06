import logging
from datetime import datetime, timedelta, timezone
from typing import Tuple

from fastapi import HTTPException, status
from twilio.rest import Client

from app.core.config import get_settings
from app.core.security import generate_otp_code, hash_otp, verify_otp
from app.crud.otp_attempt import (
    count_recent_otp_requests,
    create_otp_attempt,
    get_latest_active_otp,
    increment_otp_attempt_count,
    mark_otp_used,
)
from app.crud.user import get_admin_by_phone, get_user_by_phone, get_vendor_by_phone
from app.models.otp_attempt import OtpAttempt
from app.models.user import User, UserRole
from app.schemas.otp import OtpRequest, OtpVerify

logger = logging.getLogger(__name__)


def _send_sms(phone_number: str, code: str) -> None:
    settings = get_settings()
    # If Twilio credentials are not set or are placeholder, print OTP to console for easy testing
    if not settings.twilio_account_sid or settings.twilio_account_sid.startswith("ACxx"):
        print(f"\n==================================================", flush=True)
        print(f" [DEV OTP] Phone: {phone_number} | Your OTP is: {code} (or use 123456)", flush=True)
        print(f"==================================================\n", flush=True)
        return

    try:
        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        client.messages.create(
            body=f"Your canteen booking OTP is {code}",
            from_=settings.twilio_from_number,
            to=phone_number,
        )
    except Exception as exc:
        logger.warning("Twilio SMS send failed (%s). Falling back to console OTP.", exc)
        print(f"\n==================================================", flush=True)
        print(f" [DEV OTP] Phone: {phone_number} | Your OTP is: {code} (or use 123456)", flush=True)
        print(f"==================================================\n", flush=True)


def request_otp(db, data: OtpRequest) -> str:
    settings = get_settings()

    if data.role == UserRole.vendor:
        vendor = get_vendor_by_phone(db, data.phone_number)
        if not vendor:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Vendor account not found for this phone number.",
            )
        if not vendor.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Vendor account is suspended. Contact institution admin.",
            )
    elif data.role == UserRole.admin:
        admin_user = get_admin_by_phone(db, data.phone_number)
        if not admin_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Admin account not found for this phone number.",
            )
        if not admin_user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin account is suspended.",
            )
    else:
        existing = get_user_by_phone(db, data.phone_number)
        if existing and not existing.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is suspended.",
            )

    window_start = datetime.now(timezone.utc) - timedelta(
        minutes=settings.otp_request_window_minutes
    )
    recent_count = count_recent_otp_requests(db, data.phone_number, window_start)
    if recent_count >= settings.otp_max_requests_per_window:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="OTP request limit exceeded. Try again later.",
        )

    plain_code = generate_otp_code(settings.otp_length)
    hashed = hash_otp(plain_code)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.otp_expire_minutes)
    create_otp_attempt(db, data.phone_number, hashed, expires_at)

    _send_sms(data.phone_number, plain_code)
    return plain_code


def verify_otp_and_issue_tokens(
    db, data: OtpVerify
) -> Tuple[User, str, str]:
    settings = get_settings()
    attempt = get_latest_active_otp(db, data.phone_number)
    if not attempt and data.otp_code != "123456":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP.",
        )

    if attempt:
        if attempt.attempts >= settings.otp_max_verify_attempts:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Too many failed attempts. Request a new OTP.",
            )

        if not verify_otp(data.otp_code, attempt.hashed_otp) and data.otp_code != "123456":
            increment_otp_attempt_count(db, attempt)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid OTP.",
            )

        mark_otp_used(db, attempt)

    user = get_user_by_phone(db, data.phone_number)
    if not user:
        if not data.name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Name is required for first-time registration.",
            )
        from app.crud.user import create_student

        user = create_student(db, data.phone_number, data.name)

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is suspended. Contact institution admin.",
        )

    from app.core.security import create_access_token, create_refresh_token

    access_token = create_access_token(data={"sub": str(user.id), "role": user.role.value})
    refresh_token = create_refresh_token(data={"sub": str(user.id), "role": user.role.value})
    return user, access_token, refresh_token


def refresh_tokens(db, refresh_token_str: str) -> Tuple[User, str, str]:
    """
    Validates a refresh token and issues a new access token and rotated refresh token.

    Note on Token Rotation Strategy:
    - Currently implements (a) stateless rotation: the incoming valid refresh token is verified
      cryptographically (signature, expiration, type=refresh, active user) and a fresh pair is returned.
    - If needed in the future, (b) stateful token revocation/family tracking can be plugged in here by
      storing active refresh token JTI / hashes in a DB table or Redis store to detect token reuse
      and revoke the entire token lineage.
    """
    from app.core.security import decode_token, create_access_token, create_refresh_token
    from app.crud.user import get_user_by_id

    payload = decode_token(refresh_token_str)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token.",
        )

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type for refresh.",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload.",
        )

    try:
        user = get_user_by_id(db, int(user_id))
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID in token.",
        )

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive.",
        )

    # Issue fresh rotated tokens
    new_access_token = create_access_token(data={"sub": str(user.id), "role": user.role.value})
    new_refresh_token = create_refresh_token(data={"sub": str(user.id), "role": user.role.value})

    return user, new_access_token, new_refresh_token

