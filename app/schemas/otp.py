from pydantic import BaseModel, Field

from app.models.user import UserRole


class OtpRequest(BaseModel):
    phone_number: str = Field(..., min_length=5, max_length=20)
    role: UserRole


class OtpVerify(BaseModel):
    phone_number: str = Field(..., min_length=5, max_length=20)
    otp_code: str = Field(..., min_length=4, max_length=10)
    name: str | None = Field(default=None, max_length=255)
