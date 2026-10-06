from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class MealPlanCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    price: float = Field(..., gt=0)
    total_meals: int = Field(default=10, ge=1, le=100)
    validity_days: int = Field(default=30, ge=1, le=365)


class MealPlanUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    description: str | None = None
    price: float | None = Field(default=None, gt=0)
    is_active: bool | None = None


class MealPlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    vendor_id: int
    name: str
    description: str | None = None
    price: float
    total_meals: int
    validity_days: int
    is_active: bool
    created_at: datetime
    vendor_shop_name: str | None = None


class MealPlanSubscriptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    meal_plan_id: int
    meals_remaining: int
    expires_at: datetime
    is_active: bool
    created_at: datetime
    meal_plan: MealPlanOut | None = None
