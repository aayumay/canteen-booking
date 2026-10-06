from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.vendor_settlement import SettlementStatus


class VendorSettlementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    vendor_id: int
    order_id: int
    amount: float
    status: SettlementStatus
    settled_at: datetime | None = None
    settled_by: int | None = None
    voided_at: datetime | None = None
    created_at: datetime


class VendorSettlementDetailOut(VendorSettlementOut):
    """A settlement row plus just enough order context to make the ledger
    readable without a second round trip: the pickup token students quote at
    the counter, and the order's current status."""

    order_status: str
    pickup_token: str


class VendorSettlementSummaryOut(BaseModel):
    """Vendor-scoped totals. `pending_amount` is the number a vendor actually
    cares about, so it is surfaced first and on its own."""

    pending_amount: float
    pending_count: int
    settled_amount: float
    settled_count: int
    voided_amount: float
    voided_count: int


class AdminSettlementSummaryOut(BaseModel):
    """Platform-wide float. `pending_amount` is real money the platform owes
    out to vendors and has not yet been settled."""

    pending_amount: float
    pending_count: int
    settled_amount: float
    settled_count: int
    voided_amount: float
    voided_count: int
    vendor_count: int


class AdminVendorBalanceOut(BaseModel):
    """One row of the per-vendor breakdown on the admin settlements screen."""

    vendor_id: int
    vendor_name: str
    shop_name: str | None = None
    pending_amount: float
    pending_count: int
    settled_amount: float


class SettlementListOut(BaseModel):
    """One pagination envelope for both the vendor and admin ledgers, so the
    two screens read rows and totals the same way."""

    items: list[VendorSettlementDetailOut]
    total: int
    limit: int
    offset: int


class AdminSettlementListOut(SettlementListOut):
    pass


class BulkSettleRequest(BaseModel):
    vendor_id: int = Field(..., gt=0)
