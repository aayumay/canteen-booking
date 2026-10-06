import enum
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class UserRole(str, enum.Enum):
    student = "student"
    vendor = "vendor"
    admin = "admin"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    phone_number: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, name="userrole"), nullable=False)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Student fields
    wallet_balance: Mapped[float] = mapped_column(Numeric(10, 2), default=0.00, nullable=False)
    low_balance_threshold: Mapped[float] = mapped_column(Numeric(10, 2), default=50.00, nullable=False)
    allergen_filters: Mapped[str | None] = mapped_column(String(500), nullable=True)
    hostel_block: Mapped[str | None] = mapped_column(String(100), nullable=True)
    department: Mapped[str | None] = mapped_column(String(100), nullable=True)
    leaderboard_opt_in: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Vendor-only fields
    shop_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_shop_open: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    stall_photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    menu_items: Mapped[list["MenuItem"]] = relationship("MenuItem", back_populates="vendor")
    vendor_orders: Mapped[list["Order"]] = relationship(
        "Order", foreign_keys="Order.vendor_id", back_populates="vendor"
    )
    student_orders: Mapped[list["Order"]] = relationship(
        "Order", foreign_keys="Order.student_id", back_populates="student"
    )
