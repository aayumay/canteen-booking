from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5, description="Rating from 1 to 5 stars")
    comment: str | None = Field(default=None, max_length=1000)
    photo_url: str | None = Field(default=None, max_length=500)


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_id: int
    vendor_id: int
    reviewer_name: str
    rating: int
    comment: str | None = None
    photo_url: str | None = None
    created_at: datetime


class ReviewListOut(BaseModel):
    items: list[ReviewOut]
    total: int
    average_rating: float | None = None
    review_count: int = 0
