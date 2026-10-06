import random

from sqlalchemy.orm import Session, joinedload

from app.models.order import Order, OrderStatus
from app.models.order_item import OrderItem


def get_order_by_id(db: Session, order_id: int) -> Order | None:
    return db.query(Order).filter(Order.id == order_id).first()


def get_order_by_id_with_items(db: Session, order_id: int) -> Order | None:
    order = (
        db.query(Order)
        .options(
            joinedload(Order.items),
            joinedload(Order.vendor),
            joinedload(Order.pickup_slot),
        )
        .filter(Order.id == order_id)
        .first()
    )
    if order:
        if order.vendor and not getattr(order, "vendor_name", None):
            order.vendor_name = order.vendor.shop_name or order.vendor.name
        if order.pickup_slot and not getattr(order, "slot_time", None):
            order.slot_time = f"{order.pickup_slot.start_time.strftime('%H:%M')} - {order.pickup_slot.end_time.strftime('%H:%M')}"
    return order


def list_orders_by_student(db: Session, student_id: int) -> list[Order]:
    orders = (
        db.query(Order)
        .options(
            joinedload(Order.items),
            joinedload(Order.vendor),
            joinedload(Order.pickup_slot),
        )
        .filter(Order.student_id == student_id)
        .order_by(Order.created_at.desc())
        .all()
    )
    for order in orders:
        if order.vendor and not getattr(order, "vendor_name", None):
            order.vendor_name = order.vendor.shop_name or order.vendor.name
        if order.pickup_slot and not getattr(order, "slot_time", None):
            order.slot_time = f"{order.pickup_slot.start_time.strftime('%H:%M')} - {order.pickup_slot.end_time.strftime('%H:%M')}"
    return orders


def list_orders_by_vendor(
    db: Session, vendor_id: int, status: OrderStatus | None = None
) -> list[Order]:
    query = (
        db.query(Order)
        .options(
            joinedload(Order.items),
            joinedload(Order.student),
            joinedload(Order.pickup_slot),
        )
        .filter(Order.vendor_id == vendor_id)
    )
    if status:
        query = query.filter(Order.status == status)
    return query.order_by(Order.created_at.desc()).all()


ACTIVE_ORDER_STATUSES = (
    OrderStatus.placed,
    OrderStatus.accepted,
    OrderStatus.preparing,
    OrderStatus.ready,
)


def _generate_unique_pickup_token(db: Session, vendor_id: int) -> str:
    """
    Pickup codes only have to be unique among a given vendor's *active* orders.
    Scoping to (vendor_id, status) lets two vendors legitimately hold the same
    code, and lets a code be reused once every order carrying it is closed out.
    """
    for _ in range(10):
        token = str(random.randint(100000, 999999))
        exists = (
            db.query(Order)
            .filter(
                Order.vendor_id == vendor_id,
                Order.pickup_token == token,
                Order.status.in_(ACTIVE_ORDER_STATUSES),
            )
            .first()
        )
        if not exists:
            return token
    raise RuntimeError("Unable to generate unique pickup token")


def get_order_by_pickup_token(db: Session, vendor_id: int, token: str) -> Order | None:
    """
    Resolve a code to one of *this vendor's* orders. Active orders win over
    closed-out ones so a freshly re-used code never resolves to a stale order.
    """
    active = (
        db.query(Order)
        .filter(
            Order.vendor_id == vendor_id,
            Order.pickup_token == token,
            Order.status.in_(ACTIVE_ORDER_STATUSES),
        )
        .order_by(Order.created_at.desc())
        .first()
    )
    if active:
        return active
    return (
        db.query(Order)
        .filter(Order.vendor_id == vendor_id, Order.pickup_token == token)
        .order_by(Order.updated_at.desc())
        .first()
    )


def list_ready_orders_by_vendor(db: Session, vendor_id: int) -> list[Order]:
    return (
        db.query(Order)
        .options(
            joinedload(Order.items),
            joinedload(Order.student),
        )
        .filter(Order.vendor_id == vendor_id, Order.status == OrderStatus.ready)
        .order_by(Order.created_at.asc())
        .all()
    )


def create_order(
    db: Session,
    student_id: int,
    vendor_id: int,
    items: list[OrderItem],
    total: float,
    payment_method: str = "pay_at_counter",
    pickup_slot_id: int | None = None,
    cutlery_needed: bool = True,
    reusable_container: bool = False,
    container_discount: float = 0.0,
) -> Order:
    order = Order(
        student_id=student_id,
        vendor_id=vendor_id,
        status=OrderStatus.placed,
        total_amount=total,
        payment_method=payment_method,
        pickup_slot_id=pickup_slot_id,
        pickup_token=_generate_unique_pickup_token(db, vendor_id),
        cutlery_needed=cutlery_needed,
        reusable_container=reusable_container,
        container_discount=container_discount,
    )
    db.add(order)
    db.flush()
    for item in items:
        item.order_id = order.id
        db.add(item)
    return order


def update_order_status(
    db: Session, order: Order, status: OrderStatus, rejection_reason: str | None = None
) -> Order:
    order.status = status
    if rejection_reason is not None:
        order.rejection_reason = rejection_reason
    db.commit()
    db.refresh(order)
    return order
