from datetime import time
from pydantic import BaseModel, ConfigDict, Field


class PickupSlotCreate(BaseModel):
    start_time: str = Field(..., description="HH:MM format, e.g. 13:00")
    end_time: str = Field(..., description="HH:MM format, e.g. 13:15")
    max_orders: int = Field(default=20, ge=1, le=100)


class PickupSlotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    vendor_id: int
    start_time: str
    end_time: str
    max_orders: int
    current_order_count: int
    available_capacity: int
    is_active: bool
