import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class WalletTransactionType(str, enum.Enum):
    topup = "topup"
    order_payment = "order_payment"
    refund = "refund"
    admin_adjustment = "admin_adjustment"
    meal_plan_purchase = "meal_plan_purchase"


class WalletTransaction(Base):
    __tablename__ = "wallet_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    type: Mapped[WalletTransactionType] = mapped_column(
        Enum(WalletTransactionType, name="wallettransactiontype"), nullable=False
    )
    related_order_id: Mapped[int | None] = mapped_column(ForeignKey("orders.id"), nullable=True, index=True)
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    balance_after: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    student: Mapped["User"] = relationship("User", foreign_keys=[student_id])
    related_order: Mapped["Order"] = relationship("Order", foreign_keys=[related_order_id])
