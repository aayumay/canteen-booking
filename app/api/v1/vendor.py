from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_vendor
from app.crud.menu_item import (
    create_menu_item,
    delete_menu_item,
    get_menu_item_by_id,
    list_menu_items_by_vendor,
    update_menu_item,
)
from app.crud.order import get_order_by_id_with_items, list_orders_by_vendor
from app.db.session import get_db
from app.models.order import OrderStatus
from app.models.user import User
from app.models.vendor_settlement import SettlementStatus
from app.schemas.meal_plan import MealPlanCreate, MealPlanOut, MealPlanUpdate
from app.schemas.menu_item import FlashDiscountUpdate, MenuItemCreate, MenuItemOut, MenuItemUpdate
from app.schemas.order import (
    OrderOut,
    OrderStatusUpdate,
    OrderWithItemsOut,
    PickupVerifyIn,
    PickupVerifyOut,
    ReadyOrderOut,
)
from app.schemas.review import ReviewListOut
from app.schemas.settlement import (
    SettlementListOut,
    VendorSettlementSummaryOut,
)
from app.schemas.user import UserOut, VendorProfileUpdate
from app.services.order_service import (
    list_ready_orders_for_pickup,
    transition_order_status,
    verify_pickup,
)
from app.services.review_service import list_own_vendor_reviews
from app.services.settlement_service import (
    get_vendor_summary,
    list_vendor_settlements,
    to_settlement_detail,
)

router = APIRouter(prefix="/vendor", tags=["vendor"])


def _summarise_items(order) -> str:
    """Compact '2x Veg Burger, 1x Chai' line for the ready-orders list."""
    parts = [f"{item.quantity}x {item.item_name}" for item in order.items]
    if not parts:
        return "No items"
    if len(parts) <= 2:
        return ", ".join(parts)
    return ", ".join(parts[:2]) + f" +{len(parts) - 2} more"


@router.patch("/profile", response_model=UserOut)
def update_vendor_profile(
    data: VendorProfileUpdate,
    db: Annotated[Session, Depends(get_db)],
    vendor: User = Depends(get_current_vendor),
):
    if data.name is not None:
        vendor.name = data.name.strip()
    if data.shop_name is not None:
        vendor.shop_name = data.shop_name.strip()
    if data.stall_photo_url is not None:
        vendor.stall_photo_url = data.stall_photo_url.strip() or None
    db.commit()
    db.refresh(vendor)
    return vendor


@router.patch("/shop/toggle", response_model=dict)
def toggle_shop(
    db: Annotated[Session, Depends(get_db)],
    vendor: User = Depends(get_current_vendor),
):
    vendor.is_shop_open = not vendor.is_shop_open
    db.commit()
    db.refresh(vendor)
    return {"is_shop_open": vendor.is_shop_open}


@router.get("/menu", response_model=list[MenuItemOut])
def list_my_menu(
    db: Annotated[Session, Depends(get_db)],
    vendor: User = Depends(get_current_vendor),
):
    return list_menu_items_by_vendor(db, vendor.id)


@router.post("/menu", response_model=MenuItemOut, status_code=status.HTTP_201_CREATED)
def add_menu_item(
    data: MenuItemCreate,
    db: Annotated[Session, Depends(get_db)],
    vendor: User = Depends(get_current_vendor),
):
    return create_menu_item(db, vendor.id, data)


@router.get("/menu/{item_id}", response_model=MenuItemOut)
def get_menu_item(
    item_id: int,
    db: Annotated[Session, Depends(get_db)],
    vendor: User = Depends(get_current_vendor),
):
    item = get_menu_item_by_id(db, item_id)
    if not item or item.vendor_id != vendor.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu item not found.",
        )
    return item


@router.patch("/menu/{item_id}", response_model=MenuItemOut)
def edit_menu_item(
    item_id: int,
    data: MenuItemUpdate,
    db: Annotated[Session, Depends(get_db)],
    vendor: User = Depends(get_current_vendor),
):
    item = get_menu_item_by_id(db, item_id)
    if not item or item.vendor_id != vendor.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu item not found.",
        )
    return update_menu_item(db, item, data)


@router.delete("/menu/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_menu_item(
    item_id: int,
    db: Annotated[Session, Depends(get_db)],
    vendor: User = Depends(get_current_vendor),
):
    item = get_menu_item_by_id(db, item_id)
    if not item or item.vendor_id != vendor.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu item not found.",
        )
    delete_menu_item(db, item)
    return None


@router.get("/orders", response_model=list[OrderWithItemsOut])
def list_incoming_orders(
    db: Annotated[Session, Depends(get_db)],
    vendor: User = Depends(get_current_vendor),
    status: OrderStatus | None = None,
):
    return list_orders_by_vendor(db, vendor.id, status)


@router.get("/orders/ready", response_model=list[ReadyOrderOut])
def list_ready_orders(
    db: Annotated[Session, Depends(get_db)],
    vendor: User = Depends(get_current_vendor),
):
    """
    Declared before /orders/{order_id} so the literal path wins over the
    int-typed parameter. Codes are truncated to the last 4 digits.
    """
    orders = list_ready_orders_for_pickup(db, vendor)
    return [
        ReadyOrderOut(
            id=order.id,
            student_id=order.student_id,
            student_name=(order.student.name if order.student else "Student"),
            item_summary=_summarise_items(order),
            item_count=sum(item.quantity for item in order.items),
            total_amount=float(order.total_amount),
            pickup_token_last4=order.pickup_token[-4:],
            created_at=order.created_at,
        )
        for order in orders
    ]


@router.post("/orders/verify-pickup", response_model=PickupVerifyOut)
def verify_pickup_endpoint(
    data: PickupVerifyIn,
    db: Annotated[Session, Depends(get_db)],
    vendor: User = Depends(get_current_vendor),
):
    order = verify_pickup(db, vendor, data)
    return PickupVerifyOut(
        id=order.id,
        student_id=order.student_id,
        student_name=(order.student.name if order.student else "Student"),
        vendor_id=order.vendor_id,
        status=order.status,
        pickup_token=order.pickup_token,
        picked_up_at=order.picked_up_at,
        picked_up_confirmed_by=order.picked_up_confirmed_by,
    )


@router.get("/orders/{order_id}", response_model=OrderWithItemsOut)
def get_incoming_order(
    order_id: int,
    db: Annotated[Session, Depends(get_db)],
    vendor: User = Depends(get_current_vendor),
):
    order = get_order_by_id_with_items(db, order_id)
    if not order or order.vendor_id != vendor.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found.",
        )
    return order


@router.patch("/orders/{order_id}/status", response_model=OrderWithItemsOut)
def update_order_status_endpoint(
    order_id: int,
    update: OrderStatusUpdate,
    db: Annotated[Session, Depends(get_db)],
    vendor: User = Depends(get_current_vendor),
):
    order = transition_order_status(db, vendor, order_id, update)
    return get_order_by_id_with_items(db, order.id)


from app.crud.pickup_slot import (
    create_pickup_slot,
    delete_pickup_slot,
    get_pickup_slot_by_id,
    list_pickup_slots_by_vendor,
)
from app.schemas.pickup_slot import PickupSlotCreate, PickupSlotOut
from datetime import time as dtime


def _parse_time(t_str: str) -> dtime:
    parts = [int(p) for p in t_str.strip().split(":")]
    return dtime(parts[0], parts[1])


@router.get("/reviews", response_model=ReviewListOut)
def list_my_reviews(
    db: Annotated[Session, Depends(get_db)],
    vendor: User = Depends(get_current_vendor),
    limit: int = 50,
    offset: int = 0,
):
    return list_own_vendor_reviews(db, vendor, limit=limit, offset=offset)


@router.post("/slots", response_model=PickupSlotOut, status_code=status.HTTP_201_CREATED)
def create_slot_endpoint(
    data: PickupSlotCreate,
    db: Annotated[Session, Depends(get_db)],
    vendor: User = Depends(get_current_vendor),
):
    st = _parse_time(data.start_time)
    et = _parse_time(data.end_time)
    slot = create_pickup_slot(db, vendor.id, st, et, data.max_orders)
    return PickupSlotOut(
        id=slot.id,
        vendor_id=slot.vendor_id,
        start_time=slot.start_time.strftime("%H:%M"),
        end_time=slot.end_time.strftime("%H:%M"),
        max_orders=slot.max_orders,
        current_order_count=slot.current_order_count,
        available_capacity=max(0, slot.max_orders - slot.current_order_count),
        is_active=slot.is_active,
    )


@router.get("/slots", response_model=list[PickupSlotOut])
def list_vendor_slots(
    db: Annotated[Session, Depends(get_db)],
    vendor: User = Depends(get_current_vendor),
):
    slots = list_pickup_slots_by_vendor(db, vendor.id, active_only=False)
    return [
        PickupSlotOut(
            id=s.id,
            vendor_id=s.vendor_id,
            start_time=s.start_time.strftime("%H:%M"),
            end_time=s.end_time.strftime("%H:%M"),
            max_orders=s.max_orders,
            current_order_count=s.current_order_count,
            available_capacity=max(0, s.max_orders - s.current_order_count),
            is_active=s.is_active,
        )
        for s in slots
    ]


@router.delete("/slots/{slot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vendor_slot(
    slot_id: int,
    db: Annotated[Session, Depends(get_db)],
    vendor: User = Depends(get_current_vendor),
):
    slot = get_pickup_slot_by_id(db, slot_id)
    if not slot or slot.vendor_id != vendor.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pickup slot not found.",
        )
    delete_pickup_slot(db, slot)
    return None


@router.post("/meal-plans", response_model=MealPlanOut, status_code=status.HTTP_201_CREATED)
def create_vendor_meal_plan(
    data: MealPlanCreate,
    db: Annotated[Session, Depends(get_db)],
    vendor: User = Depends(get_current_vendor),
):
    from app.crud.meal_plan import create_meal_plan

    plan = create_meal_plan(db, vendor.id, data)
    return MealPlanOut(
        id=plan.id,
        vendor_id=plan.vendor_id,
        name=plan.name,
        description=plan.description,
        price=float(plan.price),
        total_meals=plan.total_meals,
        validity_days=plan.validity_days,
        is_active=plan.is_active,
        created_at=plan.created_at,
        vendor_shop_name=vendor.shop_name,
    )


@router.get("/meal-plans", response_model=list[MealPlanOut])
def list_vendor_meal_plans(
    db: Annotated[Session, Depends(get_db)],
    vendor: User = Depends(get_current_vendor),
):
    from app.crud.meal_plan import get_vendor_meal_plans

    plans = get_vendor_meal_plans(db, vendor.id, active_only=False)
    return [
        MealPlanOut(
            id=p.id,
            vendor_id=p.vendor_id,
            name=p.name,
            description=p.description,
            price=float(p.price),
            total_meals=p.total_meals,
            validity_days=p.validity_days,
            is_active=p.is_active,
            created_at=p.created_at,
            vendor_shop_name=vendor.shop_name,
        )
        for p in plans
    ]


@router.patch("/meal-plans/{plan_id}", response_model=MealPlanOut)
def update_vendor_meal_plan(
    plan_id: int,
    data: MealPlanUpdate,
    db: Annotated[Session, Depends(get_db)],
    vendor: User = Depends(get_current_vendor),
):
    from app.crud.meal_plan import get_meal_plan, update_meal_plan

    plan = get_meal_plan(db, plan_id)
    if not plan or plan.vendor_id != vendor.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meal plan not found.",
        )
    updated = update_meal_plan(db, plan, data)
    return MealPlanOut(
        id=updated.id,
        vendor_id=updated.vendor_id,
        name=updated.name,
        description=updated.description,
        price=float(updated.price),
        total_meals=updated.total_meals,
        validity_days=updated.validity_days,
        is_active=updated.is_active,
        created_at=updated.created_at,
        vendor_shop_name=vendor.shop_name,
    )


@router.patch("/menu/{item_id}/flash-discount", response_model=MenuItemOut)
def set_menu_item_flash_discount(
    item_id: int,
    data: FlashDiscountUpdate,
    db: Annotated[Session, Depends(get_db)],
    vendor: User = Depends(get_current_vendor),
):
    item = get_menu_item_by_id(db, item_id)
    if not item or item.vendor_id != vendor.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu item not found.",
        )
    item.is_flash_discount = data.is_flash_discount
    item.flash_discount_percent = data.flash_discount_percent if data.is_flash_discount else 0
    db.commit()
    db.refresh(item)
    return item


@router.get("/analytics/demand-by-hour", response_model=list[dict])
def get_vendor_demand_by_hour(
    db: Annotated[Session, Depends(get_db)],
    vendor: User = Depends(get_current_vendor),
):
    from app.models.order import Order

    orders = (
        db.query(Order)
        .filter(
            Order.vendor_id == vendor.id,
            Order.status.notin_([OrderStatus.cancelled, OrderStatus.rejected]),
        )
        .all()
    )

    hourly_stats = []
    for h in range(24):
        h_orders = [o for o in orders if o.created_at.hour == h]
        hourly_stats.append({
            "hour": h,
            "label": f"{h:02d}:00",
            "order_count": len(h_orders),
            "revenue": round(sum(float(o.total_amount) for o in h_orders), 2),
        })
    return hourly_stats


# ---------------------------------------------------------------------------
# Settlement ledger (read-only for vendors)
# ---------------------------------------------------------------------------
# A vendor can see what they are owed and what has been recorded as settled.
# They cannot settle anything themselves: recording a payout is an admin
# action, because it is a financial acknowledgement. No vendor_id is ever read
# from the request here - it always comes from the authenticated user, so one
# vendor cannot read another's ledger by passing an id.


@router.get("/settlements/summary", response_model=VendorSettlementSummaryOut)
def get_my_settlement_summary(
    db: Annotated[Session, Depends(get_db)],
    vendor: User = Depends(get_current_vendor),
):
    return get_vendor_summary(db, vendor.id)


@router.get("/settlements", response_model=SettlementListOut)
def list_my_settlements(
    db: Annotated[Session, Depends(get_db)],
    vendor: User = Depends(get_current_vendor),
    status_filter: SettlementStatus | None = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    rows, total = list_vendor_settlements(
        db,
        vendor_id=vendor.id,
        status_filter=status_filter,
        limit=limit,
        offset=offset,
    )
    return SettlementListOut(
        items=[to_settlement_detail(r) for r in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


