from datetime import datetime, time, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, extract
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_admin, require_admin_provisioner
from app.crud.menu_item import list_menu_items_by_vendor
from app.crud.user import create_admin, create_student, create_vendor, get_user_by_id, get_user_by_phone
from app.db.session import get_db
from app.models.announcement import Announcement
from app.models.menu_item import MenuItem
from app.models.order import Order, OrderStatus
from app.models.user import User, UserRole
from app.models.vendor_settlement import SettlementStatus
from app.models.wallet_transaction import WalletTransaction, WalletTransactionType
from app.schemas.admin import (
    AdminAnalyticsSummary,
    AdminProvisionCreate,
    AdminVendorOut,
    HourlyOrderStat,
    StudentProvisionCreate,
)
from app.schemas.announcement import AnnouncementCreate, AnnouncementOut
from app.schemas.order import OrderWithItemsOut
from app.schemas.settlement import (
    AdminSettlementListOut,
    AdminSettlementSummaryOut,
    AdminVendorBalanceOut,
    BulkSettleRequest,
    VendorSettlementDetailOut,
)
from app.schemas.user import UserOut, VendorOut, VendorProvisionCreate
from app.schemas.wallet import WalletAdjustmentRequest, WalletTransactionOut
from app.services.review_service import get_vendor_rating_summary
from app.services.settlement_service import (
    bulk_settle_vendor,
    get_admin_summary,
    get_settlement_or_404,
    get_vendor_balances,
    list_admin_settlements,
    mark_settled,
    to_settlement_detail,
)
from app.services.wallet_service import adjust_wallet_balance

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post(
    "/users",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin_provisioner)],
)
def provision_admin(
    data: AdminProvisionCreate,
    db: Annotated[Session, Depends(get_db)],
):
    existing_user = get_user_by_phone(db, data.phone_number)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this phone number is already registered.",
        )

    admin_user = create_admin(
        db,
        phone_number=data.phone_number,
        name=data.name,
    )
    return admin_user


@router.post(
    "/vendors",
    response_model=VendorOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin_provisioner)],
)
def provision_vendor(
    data: VendorProvisionCreate,
    db: Annotated[Session, Depends(get_db)],
):
    existing_user = get_user_by_phone(db, data.phone_number)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this phone number is already registered.",
        )

    vendor = create_vendor(
        db,
        phone_number=data.phone_number,
        name=data.name,
        shop_name=data.shop_name,
        is_shop_open=data.is_shop_open,
    )
    return vendor


@router.post(
    "/students",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin_provisioner)],
)
def provision_student(
    data: StudentProvisionCreate,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Create a student account up front.

    Students could previously only come into existence as a side effect of
    first-time OTP verification, which meant an institution could not pre-load
    its roster or issue a wallet to a student who had never opened the app.
    create_student already existed in the CRUD layer with no API caller.
    """
    existing_user = get_user_by_phone(db, data.phone_number)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this phone number is already registered.",
        )

    student = create_student(
        db,
        phone_number=data.phone_number,
        name=data.name,
    )
    return student


def _build_admin_vendor_out(db: Session, v: User) -> AdminVendorOut:
    avg_rating, review_cnt = get_vendor_rating_summary(db, v.id)
    item_count = db.query(func.count(MenuItem.id)).filter(MenuItem.vendor_id == v.id).scalar() or 0
    total_order_count = db.query(func.count(Order.id)).filter(Order.vendor_id == v.id).scalar() or 0
    total_revenue = (
        db.query(func.sum(Order.total_amount))
        .filter(
            Order.vendor_id == v.id,
            Order.status.notin_([OrderStatus.cancelled, OrderStatus.rejected]),
        )
        .scalar()
        or 0.0
    )
    return AdminVendorOut(
        id=v.id,
        phone_number=v.phone_number,
        name=v.name,
        shop_name=v.shop_name or "Vendor",
        is_shop_open=v.is_shop_open,
        is_approved=v.is_approved,
        stall_photo_url=v.stall_photo_url,
        is_active=v.is_active,
        item_count=item_count,
        total_order_count=total_order_count,
        total_revenue=float(total_revenue),
        average_rating=avg_rating,
        review_count=review_cnt,
    )


@router.get(
    "/vendors",
    response_model=list[AdminVendorOut],
)
def list_admin_vendors(
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin)],
):
    vendors = db.query(User).filter(User.role == UserRole.vendor).order_by(User.id.asc()).all()
    return [_build_admin_vendor_out(db, v) for v in vendors]


@router.get(
    "/vendors/pending",
    response_model=list[AdminVendorOut],
)
def list_pending_vendors(
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin)],
):
    vendors = (
        db.query(User)
        .filter(User.role == UserRole.vendor, User.is_approved.is_(False))
        .order_by(User.id.desc())
        .all()
    )
    return [_build_admin_vendor_out(db, v) for v in vendors]


@router.patch(
    "/vendors/{vendor_id}/approve",
    response_model=AdminVendorOut,
)
def approve_vendor(
    vendor_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin)],
):
    vendor = get_user_by_id(db, vendor_id)
    if not vendor or vendor.role != UserRole.vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found.",
        )
    vendor.is_approved = True
    db.commit()
    db.refresh(vendor)
    return _build_admin_vendor_out(db, vendor)


@router.patch(
    "/vendors/{vendor_id}/suspend",
    response_model=AdminVendorOut,
)
def suspend_vendor(
    vendor_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin)],
):
    vendor = get_user_by_id(db, vendor_id)
    if not vendor or vendor.role != UserRole.vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found.",
        )
    vendor.is_active = False
    vendor.is_shop_open = False
    db.commit()
    db.refresh(vendor)
    return _build_admin_vendor_out(db, vendor)


@router.patch(
    "/vendors/{vendor_id}/reactivate",
    response_model=AdminVendorOut,
)
def reactivate_vendor(
    vendor_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin)],
):
    vendor = get_user_by_id(db, vendor_id)
    if not vendor or vendor.role != UserRole.vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found.",
        )
    vendor.is_active = True
    db.commit()
    db.refresh(vendor)
    return _build_admin_vendor_out(db, vendor)


@router.get(
    "/orders",
    response_model=list[OrderWithItemsOut],
)
def list_admin_orders(
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin)],
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    vendor_id: int | None = Query(None),
    student_id: int | None = Query(None),
    status: OrderStatus | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    query = db.query(Order).options(joinedload(Order.items))
    if start_date:
        query = query.filter(Order.created_at >= start_date)
    if end_date:
        query = query.filter(Order.created_at <= end_date)
    if vendor_id:
        query = query.filter(Order.vendor_id == vendor_id)
    if student_id:
        query = query.filter(Order.student_id == student_id)
    if status:
        query = query.filter(Order.status == status)

    return query.order_by(Order.created_at.desc()).offset(offset).limit(limit).all()


@router.get(
    "/analytics/summary",
    response_model=AdminAnalyticsSummary,
)
def get_analytics_summary(
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin)],
):
    now = datetime.now(timezone.utc)
    today_start = datetime.combine(now.date(), time.min, tzinfo=timezone.utc)
    yesterday_start = today_start - timedelta(days=1)

    total_orders = db.query(func.count(Order.id)).scalar() or 0
    total_revenue = (
        db.query(func.sum(Order.total_amount))
        .filter(Order.status.notin_([OrderStatus.cancelled, OrderStatus.rejected]))
        .scalar()
        or 0.0
    )
    active_vendors_count = (
        db.query(func.count(User.id))
        .filter(User.role == UserRole.vendor, User.is_active.is_(True))
        .scalar()
        or 0
    )
    active_students_count = (
        db.query(func.count(User.id))
        .filter(User.role == UserRole.student, User.is_active.is_(True))
        .scalar()
        or 0
    )

    orders_today = (
        db.query(func.count(Order.id))
        .filter(Order.created_at >= today_start)
        .scalar()
        or 0
    )
    revenue_today = (
        db.query(func.sum(Order.total_amount))
        .filter(
            Order.created_at >= today_start,
            Order.status.notin_([OrderStatus.cancelled, OrderStatus.rejected]),
        )
        .scalar()
        or 0.0
    )

    orders_yesterday = (
        db.query(func.count(Order.id))
        .filter(Order.created_at >= yesterday_start, Order.created_at < today_start)
        .scalar()
        or 0
    )
    revenue_yesterday = (
        db.query(func.sum(Order.total_amount))
        .filter(
            Order.created_at >= yesterday_start,
            Order.created_at < today_start,
            Order.status.notin_([OrderStatus.cancelled, OrderStatus.rejected]),
        )
        .scalar()
        or 0.0
    )

    # SQLite compatible peak hours grouping
    all_orders = db.query(Order.created_at).all()
    hour_counts = {h: 0 for h in range(24)}
    for o in all_orders:
        if o.created_at:
            h = o.created_at.hour
            hour_counts[h] = hour_counts.get(h, 0) + 1

    peak_hours = [HourlyOrderStat(hour=h, order_count=cnt) for h, cnt in sorted(hour_counts.items())]

    return AdminAnalyticsSummary(
        total_orders=total_orders,
        total_revenue=float(total_revenue),
        active_vendors_count=active_vendors_count,
        active_students_count=active_students_count,
        orders_today=orders_today,
        revenue_today=float(revenue_today),
        orders_yesterday=orders_yesterday,
        revenue_yesterday=float(revenue_yesterday),
        peak_hours=peak_hours,
    )


@router.post(
    "/announcements",
    response_model=AnnouncementOut,
    status_code=status.HTTP_201_CREATED,
)
def create_announcement(
    data: AnnouncementCreate,
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin)],
):
    announcement = Announcement(
        title=data.title,
        message=data.message,
        expires_at=data.expires_at,
        created_by_id=current_admin.id,
        is_active=True,
    )
    db.add(announcement)
    db.commit()
    db.refresh(announcement)
    return announcement


@router.get(
    "/announcements",
    response_model=list[AnnouncementOut],
)
def list_admin_announcements(
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin)],
):
    return (
        db.query(Announcement)
        .order_by(Announcement.created_at.desc())
        .all()
    )


@router.delete(
    "/announcements/{announcement_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_announcement(
    announcement_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin)],
):
    announcement = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found.",
        )
    db.delete(announcement)
    db.commit()
    return None


@router.post(
    "/wallet/adjust",
    response_model=WalletTransactionOut,
    status_code=status.HTTP_200_OK,
)
def adjust_student_wallet(
    data: WalletAdjustmentRequest,
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin)],
):
    tx = adjust_wallet_balance(
        db=db,
        student_id=data.student_id,
        amount=data.amount,
        tx_type=WalletTransactionType.admin_adjustment,
        reason=data.reason,
    )
    db.commit()
    db.refresh(tx)
    return tx


@router.get(
    "/students",
    response_model=list[UserOut],
)
def list_students(
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin)],
    search: str | None = Query(None),
):
    query = db.query(User).filter(User.role == UserRole.student)
    if search:
        query = query.filter(
            (User.name.ilike(f"%{search}%")) | (User.phone_number.ilike(f"%{search}%"))
        )
    return query.order_by(User.name.asc()).limit(50).all()


# ---------------------------------------------------------------------------
# Settlement ledger
# ---------------------------------------------------------------------------
# Recording a settlement is NOT processing a payment. There is no payment
# processor in this system: an admin transfers the money to the vendor outside
# the app (bank transfer, cash) and then uses these endpoints to write down that
# it happened. Endpoint names, response fields and error copy all say "record"
# or "mark as settled" for that reason, and no UI is allowed to imply otherwise.



@router.get("/settlements/summary", response_model=AdminSettlementSummaryOut)
def admin_settlement_summary(
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin)],
):
    """Platform-wide outstanding obligation: money held from students that the
    platform still owes vendors. Derived from the same rows as the per-vendor
    breakdown, so the two cannot disagree."""
    return get_admin_summary(db)


@router.get("/settlements/vendors", response_model=list[AdminVendorBalanceOut])
def admin_settlement_vendor_balances(
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin)],
):
    """Per-vendor pending/settled breakdown, largest outstanding first."""
    return get_vendor_balances(db)


@router.get("/settlements", response_model=AdminSettlementListOut)
def admin_list_settlements(
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin)],
    vendor_id: int | None = Query(None),
    status_filter: SettlementStatus | None = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    rows, total = list_admin_settlements(
        db,
        vendor_id=vendor_id,
        status_filter=status_filter,
        limit=limit,
        offset=offset,
    )
    return AdminSettlementListOut(
        items=[to_settlement_detail(r) for r in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.patch("/settlements/{settlement_id}/mark-settled", response_model=VendorSettlementDetailOut)
def admin_mark_settlement_settled(
    settlement_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin)],
):
    """Record that an admin has settled this amount with the vendor.

    Idempotency is deliberately *not* silent: re-settling an already-settled
    row returns 400 rather than quietly succeeding, because a second call
    usually means two admins disagreed about the state and someone should look.
    """
    settlement = get_settlement_or_404(db, settlement_id)
    mark_settled(db, settlement, current_admin)
    db.commit()
    db.refresh(settlement)
    return to_settlement_detail(settlement)


@router.post(
    "/settlements/bulk-settle",
    response_model=list[VendorSettlementDetailOut],
    status_code=status.HTTP_200_OK,
)
def admin_bulk_settle_vendor(
    data: BulkSettleRequest,
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin)],
):
    """Record a full outstanding balance as settled for one vendor.

    Settles only that vendor's *pending* rows, under one settled_at/settled_by,
    which is how a weekly payout actually happens. Other vendors and this
    vendor's already-settled history are untouched.
    """
    rows = bulk_settle_vendor(db, data.vendor_id, current_admin)
    db.commit()
    for row in rows:
        db.refresh(row)
    return [to_settlement_detail(r) for r in rows]
