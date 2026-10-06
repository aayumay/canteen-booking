from datetime import time
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.order import Order, OrderStatus
from app.models.pickup_slot import PickupSlot


def get_vendor_queue_depth(db: Session, vendor_id: int) -> tuple[int, int]:
    count = (
        db.query(func.count(Order.id))
        .filter(
            Order.vendor_id == vendor_id,
            Order.status.in_([OrderStatus.placed, OrderStatus.accepted, OrderStatus.preparing]),
        )
        .scalar()
        or 0
    )
    estimated_mins = max(5, count * 3) if count > 0 else 5
    return count, estimated_mins


def create_pickup_slot(
    db: Session,
    vendor_id: int,
    start_time: time,
    end_time: time,
    max_orders: int = 20,
) -> PickupSlot:
    slot = PickupSlot(
        vendor_id=vendor_id,
        start_time=start_time,
        end_time=end_time,
        max_orders=max_orders,
        current_order_count=0,
        is_active=True,
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


def list_pickup_slots_by_vendor(
    db: Session, vendor_id: int, active_only: bool = True
) -> list[PickupSlot]:
    query = db.query(PickupSlot).filter(PickupSlot.vendor_id == vendor_id)
    if active_only:
        query = query.filter(PickupSlot.is_active.is_(True))
    return query.order_by(PickupSlot.start_time.asc()).all()


def get_pickup_slot_by_id(db: Session, slot_id: int) -> PickupSlot | None:
    return db.query(PickupSlot).filter(PickupSlot.id == slot_id).first()


def delete_pickup_slot(db: Session, slot: PickupSlot) -> None:
    slot.is_active = False
    db.commit()
