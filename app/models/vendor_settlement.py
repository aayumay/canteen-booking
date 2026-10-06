import enum
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class SettlementStatus(str, enum.Enum):
    pending = "pending"
    settled = "settled"
    voided = "voided"


class VendorSettlement(Base):
    """What a vendor is owed for orders a student paid for with their wallet.

    This is deliberately a separate concern from ``WalletTransaction``, which
    records what a *student's* balance did. Nothing here is a payment: the
    money is moved outside the app (bank transfer, cash) and an admin only
    *records* that it happened. See ``app/services/settlement_service.py``.

    ``amount`` is a snapshot of ``Order.total_amount`` taken when the order was
    placed. It is never recomputed, because menu prices may change afterwards
    and a ledger that silently revalued itself would not be a ledger.
    """

    __tablename__ = "vendor_settlements"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    # One settlement per order, ever. A voided row is kept (not deleted) so the
    # order's financial history stays auditable, which is why the uniqueness
    # holds across all three statuses rather than only for pending ones.
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id"), nullable=False, unique=True, index=True
    )

    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    status: Mapped[SettlementStatus] = mapped_column(
        Enum(SettlementStatus, name="settlementstatus"),
        default=SettlementStatus.pending,
        nullable=False,
        index=True,
    )

    # Audit fields. Both are set together by mark_settled and are never edited
    # afterwards, so "who acknowledged this payout and when" is always answerable.
    settled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    settled_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )

    # Set when the underlying order is rejected/cancelled and the student's
    # wallet is refunded. The row is retained with this status instead of being
    # deleted so the void itself is auditable.
    voided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    vendor: Mapped["User"] = relationship("User", foreign_keys=[vendor_id])
    order: Mapped["Order"] = relationship("Order", foreign_keys=[order_id])
    settler: Mapped["User | None"] = relationship("User", foreign_keys=[settled_by])

    __table_args__ = (
        # Every vendor summary query filters on vendor_id + status and sums
        # amount, so this is the index that keeps those aggregates cheap.
        Index("ix_vendor_settlements_vendor_status", "vendor_id", "status"),
    )

    @property
    def amount_decimal(self) -> Decimal:
        return Decimal(str(self.amount))
