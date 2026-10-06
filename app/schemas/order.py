from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.order import OrderStatus


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    menu_item_id: int
    item_name: str
    price_at_order: float
    quantity: int


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    vendor_id: int
    vendor_name: str | None = None
    status: OrderStatus
    total_amount: float
    payment_method: str = "pay_at_counter"
    pickup_slot_id: int | None = None
    slot_time: str | None = None
    pickup_token: str
    rejection_reason: str | None = None
    cutlery_needed: bool = True
    reusable_container: bool = False
    container_discount: float = 0.0
    created_at: datetime
    updated_at: datetime
    picked_up_at: datetime | None = None
    picked_up_confirmed_by: int | None = None


class OrderWithItemsOut(OrderOut):
    items: list[OrderItemOut] = Field(default_factory=list)


class OrderCreateItem(BaseModel):
    menu_item_id: int
    quantity: int = Field(gt=0)


class OrderCreate(BaseModel):
    vendor_id: int
    items: list[OrderCreateItem] = Field(min_length=1)
    payment_method: str = "pay_at_counter"
    pickup_slot_id: int | None = None
    cutlery_needed: bool = True
    reusable_container: bool = False


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
    rejection_reason: str | None = None


class PickupVerifyIn(BaseModel):
    """
    Accepts a scanned QR ({order_id, pickup_token}) or a hand-typed code
    ({pickup_token}). An order_id on its own is also accepted so a vendor can
    confirm straight from the ready-orders list without the student reciting
    a code; ownership is still enforced server-side.
    """

    order_id: int | None = None
    pickup_token: str | None = Field(default=None, pattern=r"^\d{6}$")

    @model_validator(mode="after")
    def _require_identifier(self):
        if self.order_id is None and self.pickup_token is None:
            raise ValueError("Provide either order_id or pickup_token.")
        return self


class ReadyOrderOut(BaseModel):
    """Ready-orders list entry. The full code is withheld on purpose."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    student_name: str
    item_summary: str
    item_count: int
    total_amount: float
    pickup_token_last4: str
    created_at: datetime


class PickupVerifyOut(BaseModel):
    """Result of a successful handover, used to render the receipt state."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    student_name: str
    vendor_id: int
    status: OrderStatus
    pickup_token: str
    picked_up_at: datetime | None = None
    picked_up_confirmed_by: int | None = None


class SustainabilityStatsOut(BaseModel):
    total_orders: int
    cutlery_saved_count: int
    containers_reused_count: int
    total_eco_saved_amount: float
    plastic_saved_grams: float

