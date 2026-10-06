import enum
import random
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Index, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class OrderStatus(str, enum.Enum):
    placed = "placed"
    accepted = "accepted"
    preparing = "preparing"
    ready = "ready"
    picked_up = "picked_up"
    rejected = "rejected"
    cancelled = "cancelled"


def _generate_pickup_token() -> str:
    return str(random.randint(100000, 999999))


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, name="orderstatus"), default=OrderStatus.placed, nullable=False
    )
    total_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    payment_method: Mapped[str] = mapped_column(String(50), default="pay_at_counter", nullable=False)
    pickup_slot_id: Mapped[int | None] = mapped_column(ForeignKey("pickup_slots.id"), nullable=True, index=True)
    pickup_token: Mapped[str] = mapped_column(
        String(6), default=_generate_pickup_token, nullable=False, index=True
    )
    rejection_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    cutlery_needed: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    reusable_container: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    container_discount: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    picked_up_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    picked_up_confirmed_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )

    student: Mapped["User"] = relationship(
        "User", foreign_keys=[student_id], back_populates="student_orders"
    )
    vendor: Mapped["User"] = relationship(
        "User", foreign_keys=[vendor_id], back_populates="vendor_orders"
    )
    picked_up_confirmer: Mapped["User | None"] = relationship(
        "User", foreign_keys=[picked_up_confirmed_by]
    )
    items: Mapped[list["OrderItem"]] = relationship("OrderItem", back_populates="order")
    pickup_slot: Mapped["PickupSlot"] = relationship("PickupSlot", back_populates="orders")

    __table_args__ = (
        Index(
            "ix_orders_vendor_token_status",
            "vendor_id",
            "pickup_token",
            "status",
        ),
    )
