from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class MealPlan(Base):
    __tablename__ = "meal_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    total_meals: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    validity_days: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    vendor: Mapped["User"] = relationship("User", foreign_keys=[vendor_id])
    subscriptions: Mapped[list["MealPlanSubscription"]] = relationship(
        "MealPlanSubscription", back_populates="meal_plan", cascade="all, delete-orphan"
    )


class MealPlanSubscription(Base):
    __tablename__ = "meal_plan_subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    meal_plan_id: Mapped[int] = mapped_column(ForeignKey("meal_plans.id"), nullable=False, index=True)
    meals_remaining: Mapped[int] = mapped_column(Integer, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    student: Mapped["User"] = relationship("User", foreign_keys=[student_id])
    meal_plan: Mapped["MealPlan"] = relationship("MealPlan", back_populates="subscriptions")
