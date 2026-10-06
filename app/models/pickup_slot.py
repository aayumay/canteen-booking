from datetime import time
from sqlalchemy import Boolean, ForeignKey, Integer, String, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class PickupSlot(Base):
    __tablename__ = "pickup_slots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    max_orders: Mapped[int] = mapped_column(Integer, default=20, nullable=False)
    current_order_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    vendor: Mapped["User"] = relationship("User", foreign_keys=[vendor_id])
    orders: Mapped[list["Order"]] = relationship("Order", back_populates="pickup_slot")
