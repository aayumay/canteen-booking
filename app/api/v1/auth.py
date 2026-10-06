from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.deps import get_current_user
from app.crud.user import create_admin, create_vendor, get_user_by_phone
from app.db.session import get_db
from app.models.user import UserRole
from app.schemas.auth import RefreshTokenRequest, TokenResponse
from app.schemas.otp import OtpRequest, OtpVerify
from app.schemas.user import AdminRegisterRequest, UserOut, VendorRegisterRequest
from app.services.otp_service import (
    refresh_tokens,
    request_otp,
    verify_otp_and_issue_tokens,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register-vendor", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register_vendor(
    data: VendorRegisterRequest,
    db: Annotated[Session, Depends(get_db)],
):
    existing_user = get_user_by_phone(db, data.phone_number)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this phone number is already registered.",
        )

    vendor = create_vendor(
        db,
        phone_number=data.phone_number,
        name=data.name,
        shop_name=data.shop_name,
        is_shop_open=False,
        is_approved=False,
        stall_photo_url=data.stall_photo_url,
    )
    # Send OTP for phone verification
    try:
        request_otp(db, OtpRequest(phone_number=data.phone_number, role=UserRole.vendor))
    except Exception:
        pass
    return vendor


@router.post("/register-admin", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register_admin(
    data: AdminRegisterRequest,
    db: Annotated[Session, Depends(get_db)],
):
    existing_user = get_user_by_phone(db, data.phone_number)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this phone number is already registered.",
        )

    admin = create_admin(
        db,
        phone_number=data.phone_number,
        name=data.name,
    )
    # Send OTP for phone verification
    try:
        request_otp(db, OtpRequest(phone_number=data.phone_number, role=UserRole.admin))
    except Exception:
        pass
    return admin


@router.post("/request-otp", status_code=status.HTTP_202_ACCEPTED)
def request_otp_endpoint(
    data: OtpRequest,
    db: Annotated[Session, Depends(get_db)],
):
    request_otp(db, data)
    return {"detail": "OTP sent."}


@router.post("/verify-otp", response_model=TokenResponse)
def verify_otp_endpoint(
    data: OtpVerify,
    db: Annotated[Session, Depends(get_db)],
):
    _, access_token, refresh_token = verify_otp_and_issue_tokens(db, data)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
def refresh_endpoint(
    data: RefreshTokenRequest,
    db: Annotated[Session, Depends(get_db)],
):
    _, access_token, refresh_token = refresh_tokens(db, data.refresh_token)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.get("/me", response_model=UserOut)
def me(current_user=Depends(get_current_user)):
    return current_user

