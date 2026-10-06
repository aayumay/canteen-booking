from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from app.models.order import OrderStatus
from app.models.user import UserRole


class AdminProvisionCreate(BaseModel):
    phone_number: str = Field(..., min_length=5, max_length=20)
    name: str = Field(..., min_length=1, max_length=255)


class StudentProvisionCreate(BaseModel):
    phone_number: str = Field(..., min_length=5, max_length=20)
    name: str = Field(..., min_length=1, max_length=255)


class AdminVendorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    phone_number: str
    name: str | None
    shop_name: str
    is_shop_open: bool
    is_approved: bool = True
    stall_photo_url: str | None = None
    is_active: bool
    item_count: int = 0
    total_order_count: int = 0
    total_revenue: float = 0.0
    average_rating: float | None = None
    review_count: int = 0


class HourlyOrderStat(BaseModel):
    hour: int
    order_count: int


class AdminAnalyticsSummary(BaseModel):
    total_orders: int
    total_revenue: float
    active_vendors_count: int
    active_students_count: int
    orders_today: int
    revenue_today: float
    orders_yesterday: int
    revenue_yesterday: float
    peak_hours: list[HourlyOrderStat] = []
