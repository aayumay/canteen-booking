"""Vendor settlement ledger.

Answers one question: *for wallet-paid orders, what does this vendor still
owe, and has an admin recorded that they were paid?*

Deliberate non-goals
--------------------
* This module never moves money. There is no payment processor in this
  system, so ``mark_settled`` and ``bulk_settle`` only *record* that an admin
  settled up outside the app. The functions are named accordingly and the API
  copy says "record", never "pay".
* Nothing here touches ``WalletTransaction``. That table is the student's
  side of the same coin (what their balance did); this is the vendor's side
  (what they are owed). They are separate concerns and are never merged.
* Amounts are snapshots of ``Order.total_amount`` taken at order time. They
  are never recomputed from current menu prices.

Transaction discipline
----------------------
``create_settlement_for_order`` and ``void_settlement_for_order`` are called
from inside ``order_service`` and deliberately do **not** commit. The caller
owns the single commit, so order creation + wallet deduction + settlement
creation either all land or none do. Anything that commits here would break
that atomicity.
"""

from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.order import Order
from app.models.user import User, UserRole
from app.models.vendor_settlement import SettlementStatus, VendorSettlement
from app.schemas.settlement import VendorSettlementDetailOut

ZERO = Decimal("0.00")

#: Scalar columns copied verbatim onto the detail schema. Listed explicitly so
#: adding a column to the model cannot silently leak it into a public payload.
SETTLEMENT_DETAIL_FIELDS = (
    "id",
    "vendor_id",
    "order_id",
    "status",
    "settled_at",
    "settled_by",
    "voided_at",
    "created_at",
)


def _to_float(value) -> float:
    """Numeric columns come back as Decimal; normalise to float for JSON.

    Quantising to 2dp keeps the aggregate and the detail rows summing to the
    same number, which is what the platform-total reconciliation test asserts.
    """
    if value is None:
        return 0.0
    return float(Decimal(str(value)).quantize(Decimal("0.01")))


def _now() -> datetime:
    return datetime.now(timezone.utc)


def to_settlement_detail(row: VendorSettlement) -> VendorSettlementDetailOut:
    """Serialise a settlement row for the API, with just enough order context
    to make a ledger line readable on its own (the pickup token students quote
    at the counter, and the order's current status).

    Shared by the vendor and admin endpoints so both screens render a row
    identically.
    """
    return VendorSettlementDetailOut(
        **{
            **{f: getattr(row, f) for f in SETTLEMENT_DETAIL_FIELDS},
            "amount": _to_float(row.amount),
            "order_status": row.order.status.value if row.order else "unknown",
            "pickup_token": row.order.pickup_token if row.order else "",
        }
    )


# ---------------------------------------------------------------------------
# Writes driven by the order lifecycle
# ---------------------------------------------------------------------------


def create_settlement_for_order(db: Session, order: Order) -> VendorSettlement | None:
    """Record what ``order``'s vendor is owed. Returns None for non-wallet orders.

    Called from ``place_order`` before its single commit. Pay-at-counter and
    meal-plan orders deliberately produce no row: the first is settled face to
    face at the counter, and the second is covered by the meal-plan
    subscription rather than by a per-order payout.
    """
    if order.payment_method != "wallet":
        return None

    settlement = VendorSettlement(
        vendor_id=order.vendor_id,
        order_id=order.id,
        # Snapshot of the server-computed order total, not a recalculation.
        amount=float(Decimal(str(order.total_amount)).quantize(Decimal("0.01"))),
        status=SettlementStatus.pending,
    )
    db.add(settlement)
    return settlement


def void_settlement_for_order(db: Session, order: Order) -> VendorSettlement | None:
    """Void the settlement backing a rejected/cancelled order.

    Called from ``transition_order_status`` before its single commit, so the
    student's refund and this void land together. Without it the vendor would
    carry a pending amount for an order nobody is going to collect.

    Only ``pending`` rows are voided. If an admin already recorded this
    settlement as paid and the order is then rejected, the row stays
    ``settled`` on purpose: that admin is on record as having paid for it, and
    silently flipping it to voided would erase the only evidence that money
    left the platform. That case needs human reconciliation, not an automatic
    rewrite.
    """
    if order.payment_method != "wallet":
        return None

    settlement = (
        db.query(VendorSettlement)
        .filter(VendorSettlement.order_id == order.id)
        .first()
    )
    if settlement is None or settlement.status != SettlementStatus.pending:
        return None

    settlement.status = SettlementStatus.voided
    settlement.voided_at = _now()
    return settlement


# ---------------------------------------------------------------------------
# Vendor-scoped reads
# ---------------------------------------------------------------------------


def get_vendor_summary(db: Session, vendor_id: int) -> dict:
    """Aggregate one vendor's ledger. Always scoped to a single vendor id."""
    rows = (
        db.query(
            VendorSettlement.status,
            func.coalesce(func.sum(VendorSettlement.amount), 0).label("total"),
            func.count(VendorSettlement.id).label("n"),
        )
        .filter(VendorSettlement.vendor_id == vendor_id)
        .group_by(VendorSettlement.status)
        .all()
    )

    by_status = {row.status: (row.total, row.n) for row in rows}
    pending_total, pending_n = by_status.get(SettlementStatus.pending, (ZERO, 0))
    settled_total, settled_n = by_status.get(SettlementStatus.settled, (ZERO, 0))
    voided_total, voided_n = by_status.get(SettlementStatus.voided, (ZERO, 0))

    return {
        "pending_amount": _to_float(pending_total),
        "pending_count": int(pending_n),
        "settled_amount": _to_float(settled_total),
        "settled_count": int(settled_n),
        "voided_amount": _to_float(voided_total),
        "voided_count": int(voided_n),
    }


def list_vendor_settlements(
    db: Session,
    vendor_id: int,
    status_filter: SettlementStatus | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[VendorSettlement], int]:
    """Paginated settlements for exactly one vendor, newest first."""
    query = db.query(VendorSettlement).filter(VendorSettlement.vendor_id == vendor_id)
    count_query = query.with_entities(func.count(VendorSettlement.id))

    if status_filter is not None:
        query = query.filter(VendorSettlement.status == status_filter)
        count_query = count_query.filter(VendorSettlement.status == status_filter)

    total = int(count_query.scalar() or 0)
    rows = (
        query.options(joinedload(VendorSettlement.order))
        .order_by(VendorSettlement.created_at.desc(), VendorSettlement.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return rows, total


# ---------------------------------------------------------------------------
# Admin reads
# ---------------------------------------------------------------------------


def get_admin_summary(db: Session) -> dict:
    """Platform-wide settlement totals.

    ``pending_amount`` is the platform's outstanding wallet-float liability:
    money taken from students that the platform still owes vendors.
    """
    rows = (
        db.query(
            VendorSettlement.status,
            func.coalesce(func.sum(VendorSettlement.amount), 0).label("total"),
            func.count(VendorSettlement.id).label("n"),
        )
        .group_by(VendorSettlement.status)
        .all()
    )

    by_status = {row.status: (row.total, row.n) for row in rows}
    pending_total, pending_n = by_status.get(SettlementStatus.pending, (ZERO, 0))
    settled_total, settled_n = by_status.get(SettlementStatus.settled, (ZERO, 0))
    voided_total, voided_n = by_status.get(SettlementStatus.voided, (ZERO, 0))

    vendor_count = int(
        db.query(func.count(func.distinct(VendorSettlement.vendor_id))).scalar() or 0
    )

    return {
        "pending_amount": _to_float(pending_total),
        "pending_count": int(pending_n),
        "settled_amount": _to_float(settled_total),
        "settled_count": int(settled_n),
        "voided_amount": _to_float(voided_total),
        "voided_count": int(voided_n),
        "vendor_count": vendor_count,
    }


def get_vendor_balances(db: Session) -> list[dict]:
    """Per-vendor pending/settled breakdown, largest outstanding first.

    Built from a single grouped query joined to users rather than N queries,
    so the admin breakdown and the platform total are derived from the same
    rows and cannot drift apart.
    """
    rows = (
        db.query(
            VendorSettlement.vendor_id,
            User.name,
            User.shop_name,
            VendorSettlement.status,
            func.coalesce(func.sum(VendorSettlement.amount), 0).label("total"),
            func.count(VendorSettlement.id).label("n"),
        )
        .join(User, User.id == VendorSettlement.vendor_id)
        .group_by(VendorSettlement.vendor_id, User.name, User.shop_name, VendorSettlement.status)
        .all()
    )

    by_vendor: dict[int, dict] = {}
    for row in rows:
        entry = by_vendor.setdefault(
            row.vendor_id,
            {
                "vendor_id": row.vendor_id,
                "vendor_name": row.name,
                "shop_name": row.shop_name,
                "pending_amount": 0.0,
                "pending_count": 0,
                "settled_amount": 0.0,
            },
        )
        if row.status == SettlementStatus.pending:
            entry["pending_amount"] = _to_float(row.total)
            entry["pending_count"] = int(row.n)
        elif row.status == SettlementStatus.settled:
            entry["settled_amount"] = _to_float(row.total)

    balances = list(by_vendor.values())
    # Vendors with nothing pending are still listed (settled history matters),
    # but the ones an admin actually needs to act on float to the top.
    balances.sort(key=lambda b: (-b["pending_amount"], b["vendor_name"] or ""))
    return balances


def list_admin_settlements(
    db: Session,
    vendor_id: int | None = None,
    status_filter: SettlementStatus | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[VendorSettlement], int]:
    """Platform-wide settlement list, optionally narrowed by vendor/status."""
    query = db.query(VendorSettlement)
    count_query = query.with_entities(func.count(VendorSettlement.id))

    if vendor_id is not None:
        query = query.filter(VendorSettlement.vendor_id == vendor_id)
        count_query = count_query.filter(VendorSettlement.vendor_id == vendor_id)
    if status_filter is not None:
        query = query.filter(VendorSettlement.status == status_filter)
        count_query = count_query.filter(VendorSettlement.status == status_filter)

    total = int(count_query.scalar() or 0)
    rows = (
        query.options(joinedload(VendorSettlement.order))
        .order_by(VendorSettlement.created_at.desc(), VendorSettlement.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return rows, total


# ---------------------------------------------------------------------------
# Admin writes
# ---------------------------------------------------------------------------


def get_settlement_or_404(db: Session, settlement_id: int) -> VendorSettlement:
    settlement = db.query(VendorSettlement).filter(VendorSettlement.id == settlement_id).first()
    if not settlement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Settlement not found.",
        )
    return settlement


def mark_settled(
    db: Session, settlement: VendorSettlement, admin: User
) -> VendorSettlement:
    """Record that an admin has settled this amount with the vendor.

    This does not move money. The bank transfer (or cash handover) happens
    outside the app; this only writes down that it happened, along with who
    did it and when.

    The write is a conditional UPDATE guarded on ``status = pending`` rather
    than a Python "check then set". Two admins clicking at the same moment both
    read ``pending``, but the database only lets the first UPDATE match, so the
    second gets a clean 400 instead of silently overwriting a colleague's audit
    trail. Row locking would be the other option, but SQLite - the test and
    dev database - ignores ``SELECT ... FOR UPDATE``, so a guard in the WHERE
    clause is the portable way to get the same guarantee.
    """
    stamp = _now()
    updated = (
        db.query(VendorSettlement)
        .filter(
            VendorSettlement.id == settlement.id,
            VendorSettlement.status == SettlementStatus.pending,
        )
        .update(
            {
                VendorSettlement.status: SettlementStatus.settled,
                VendorSettlement.settled_at: stamp,
                VendorSettlement.settled_by: admin.id,
            },
            synchronize_session="fetch",
        )
    )

    if not updated:
        # Re-read so the message names the status that actually blocked us.
        db.refresh(settlement)
        if settlement.status == SettlementStatus.settled:
            detail = "This settlement is already marked as settled."
        elif settlement.status == SettlementStatus.voided:
            detail = "This settlement was voided and cannot be settled."
        else:
            detail = "This settlement's status changed; nothing was recorded."
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)

    return settlement


def bulk_settle_vendor(db: Session, vendor_id: int, admin: User) -> list[VendorSettlement]:
    """Settle every pending row for one vendor under a single audit stamp.

    Scoped by both vendor_id and status=pending, so other vendors' rows and
    this vendor's already-settled history are both left untouched. One
    settled_at/settled_by for the whole batch, which is what actually happens
    when an admin pays a vendor their full balance at once.

    The batch is one guarded UPDATE: a row another admin settled in the
    meantime simply fails to match and is skipped rather than being double-paid.
    """
    vendor = db.query(User).filter(User.id == vendor_id, User.role == UserRole.vendor).first()
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found.",
        )

    stamp = _now()
    updated = (
        db.query(VendorSettlement)
        .filter(
            VendorSettlement.vendor_id == vendor_id,
            VendorSettlement.status == SettlementStatus.pending,
        )
        .update(
            {
                VendorSettlement.status: SettlementStatus.settled,
                VendorSettlement.settled_at: stamp,
                VendorSettlement.settled_by: admin.id,
            },
            synchronize_session="fetch",
        )
    )

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{vendor.shop_name or vendor.name} has no pending settlements to settle.",
        )

    # Re-select the rows this batch stamped so the response echoes them back.
    return (
        db.query(VendorSettlement)
        .filter(
            VendorSettlement.vendor_id == vendor_id,
            VendorSettlement.settled_at == stamp,
            VendorSettlement.settled_by == admin.id,
        )
        .order_by(VendorSettlement.id.asc())
        .all()
    )
