from pydantic import BaseModel, ConfigDict

from app.models.user import UserRole


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    phone_number: str
    role: UserRole
    name: str | None
    shop_name: str | None
    is_shop_open: bool
    is_approved: bool = True
    stall_photo_url: str | None = None
    allergen_filters: str | None = None


class AllergenPreferencesUpdate(BaseModel):
    allergens: list[str]


class VendorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    phone_number: str | None = None
    name: str | None = None
    shop_name: str
    is_shop_open: bool
    is_approved: bool = True
    stall_photo_url: str | None = None
    average_rating: float | None = None
    review_count: int = 0
    current_queue_depth: int = 0
    estimated_wait_minutes: int = 0


class VendorProvisionCreate(BaseModel):
    phone_number: str
    name: str
    shop_name: str
    is_shop_open: bool = False
    stall_photo_url: str | None = None


class VendorRegisterRequest(BaseModel):
    phone_number: str
    name: str
    shop_name: str
    stall_photo_url: str | None = None


class VendorProfileUpdate(BaseModel):
    name: str | None = None
    shop_name: str | None = None
    stall_photo_url: str | None = None


class AdminRegisterRequest(BaseModel):
    phone_number: str
    name: str

