from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.crud.menu_item import get_menu_item_by_id
from app.crud.order import (
    create_order,
    get_order_by_id,
    get_order_by_pickup_token,
    list_ready_orders_by_vendor,
    update_order_status,
)
from app.crud.order_status_transition import get_transition, seed_transitions
from app.crud.user import get_user_by_id
from app.models.menu_item import MenuItem
from app.models.order import Order, OrderStatus
from app.models.order_item import OrderItem
from app.models.user import User, UserRole
from app.models.wallet_transaction import WalletTransaction, WalletTransactionType
from app.schemas.order import OrderCreate, OrderStatusUpdate, PickupVerifyIn
from app.services.settlement_service import (
    create_settlement_for_order,
    void_settlement_for_order,
)
from app.services.wallet_service import adjust_wallet_balance


def _ensure_state_machine_seeded(db: Session) -> None:
    seed_transitions(db)


def place_order(db: Session, student: User, data: OrderCreate) -> Order:
    if student.role != UserRole.student:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can place orders.",
        )

    vendor = get_user_by_id(db, data.vendor_id)
    if not vendor or vendor.role != UserRole.vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found.",
        )
    if not vendor.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vendor account is suspended.",
        )
    if not vendor.is_approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vendor is pending institution admin approval.",
        )
    if not vendor.is_shop_open:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vendor shop is currently closed.",
        )

    menu_item_ids = [item.menu_item_id for item in data.items]
    menu_items = {item_id: get_menu_item_by_id(db, item_id) for item_id in set(menu_item_ids)}

    order_items: list[OrderItem] = []
    total = Decimal("0.00")

    for line in data.items:
        item = menu_items.get(line.menu_item_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Menu item {line.menu_item_id} not found.",
            )
        if item.vendor_id != vendor.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Menu item {line.menu_item_id} does not belong to this vendor.",
            )
        if not item.is_available:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Menu item {item.name} is not available.",
            )

        unit_price = item.effective_price
        line_total = Decimal(str(unit_price)) * line.quantity
        total += line_total
        order_items.append(
            OrderItem(
                menu_item_id=item.id,
                item_name=item.name,
                price_at_order=unit_price,
                quantity=line.quantity,
            )
        )

    payment_method = data.payment_method or "pay_at_counter"
    cutlery_needed = data.cutlery_needed
    reusable_container = data.reusable_container
    container_discount = 0.0

    if reusable_container:
        container_discount = min(5.0, float(total))
        total = max(Decimal("0.00"), total - Decimal(str(container_discount)))

    total_float = float(total)
    slot_id = data.pickup_slot_id

    if slot_id:
        from app.models.pickup_slot import PickupSlot

        slot = db.query(PickupSlot).filter(PickupSlot.id == slot_id).first()
        if not slot or slot.vendor_id != vendor.id or not slot.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid pickup slot selected.",
            )
        if slot.current_order_count >= slot.max_orders:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected pickup slot is full.",
            )
        slot.current_order_count += 1

    if payment_method == "meal_plan":
        from app.crud.meal_plan import get_student_active_subscription_for_vendor

        sub = get_student_active_subscription_for_vendor(db, student.id, vendor.id)
        if not sub:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active meal plan with remaining meals found for this vendor.",
            )
        sub.meals_remaining -= 1
        order = create_order(
            db,
            student_id=student.id,
            vendor_id=vendor.id,
            items=order_items,
            total=total_float,
            payment_method="meal_plan",
            pickup_slot_id=slot_id,
            cutlery_needed=cutlery_needed,
            reusable_container=reusable_container,
            container_discount=container_discount,
        )
        db.commit()
        db.refresh(order)
        return order
    elif payment_method == "wallet":
        current_balance = Decimal(str(student.wallet_balance or 0.0))
        if current_balance < total:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient wallet balance. Current balance: ₹{float(current_balance):.2f}, required: ₹{total_float:.2f}",
            )
        order = create_order(
            db,
            student_id=student.id,
            vendor_id=vendor.id,
            items=order_items,
            total=total_float,
            payment_method="wallet",
            pickup_slot_id=slot_id,
            cutlery_needed=cutlery_needed,
            reusable_container=reusable_container,
            container_discount=container_discount,
        )
        adjust_wallet_balance(
            db,
            student_id=student.id,
            amount=-total_float,
            tx_type=WalletTransactionType.order_payment,
            reason=f"Payment for Order #{order.pickup_token}",
            related_order_id=order.id,
        )
        # Same transaction as the order row and the wallet deduction above: the
        # single commit below is what makes all three atomic. Staged after the
        # deduction so an insufficient-balance failure can never leave an
        # orphan settlement behind. No commit here on purpose.
        create_settlement_for_order(db, order)
        db.commit()
        db.refresh(order)
        return order
    else:
        order = create_order(
            db,
            student_id=student.id,
            vendor_id=vendor.id,
            items=order_items,
            total=total_float,
            payment_method=payment_method,
            pickup_slot_id=slot_id,
            cutlery_needed=cutlery_needed,
            reusable_container=reusable_container,
            container_discount=container_discount,
        )
        db.commit()
        db.refresh(order)
        return order


def transition_order_status(
    db: Session, actor: User, order_id: int, update: OrderStatusUpdate
) -> Order:
    _ensure_state_machine_seeded(db)

    order = get_order_by_id(db, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found.",
        )

    if actor.role == UserRole.vendor and order.vendor_id != actor.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this order.",
        )
    if actor.role == UserRole.student and order.student_id != actor.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this order.",
        )

    actor_role_str = actor.role.value
    transition = get_transition(db, order.status.value, update.status.value, actor_role_str)
    if not transition:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot transition from {order.status.value} to {update.status.value} as {actor_role_str}.",
        )

    if transition.requires_reason and not update.rejection_reason:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rejection reason is required.",
        )

    if update.status in (OrderStatus.cancelled, OrderStatus.rejected):
        # Release pickup slot if any
        if order.pickup_slot_id:
            from app.models.pickup_slot import PickupSlot

            slot = db.query(PickupSlot).filter(PickupSlot.id == order.pickup_slot_id).first()
            if slot and slot.current_order_count > 0:
                slot.current_order_count -= 1

        if order.payment_method == "meal_plan":
            from app.models.meal_plan import MealPlanSubscription, MealPlan
            sub = (
                db.query(MealPlanSubscription)
                .join(MealPlan, MealPlanSubscription.meal_plan_id == MealPlan.id)
                .filter(
                    MealPlanSubscription.student_id == order.student_id,
                    MealPlan.vendor_id == order.vendor_id,
                    MealPlanSubscription.is_active == True,
                )
                .first()
            )
            if sub:
                sub.meals_remaining += 1

        if order.payment_method == "wallet":
            existing_refund = (
                db.query(WalletTransaction)
                .filter(
                    WalletTransaction.related_order_id == order.id,
                    WalletTransaction.type == WalletTransactionType.refund,
                )
                .first()
            )
            if not existing_refund:
                adjust_wallet_balance(
                    db,
                    student_id=order.student_id,
                    amount=float(order.total_amount),
                    tx_type=WalletTransactionType.refund,
                    reason=f"Refund for {update.status.value} Order #{order.pickup_token}",
                    related_order_id=order.id,
                )

        # Void the vendor's claim on this order in the same transaction as the
        # refund above. Must stay *after* _ensure_state_machine_seeded(), which
        # commits, and *before* update_order_status(), which is the single
        # commit that closes the request.
        void_settlement_for_order(db, order)

    return update_order_status(
        db, order, update.status, update.rejection_reason if transition.requires_reason else None
    )


_PICKUP_BLOCKED_BY_STATUS = {
    OrderStatus.placed: "This order is not ready for pickup yet.",
    OrderStatus.accepted: "This order is not ready for pickup yet.",
    OrderStatus.preparing: "This order is still being prepared.",
    OrderStatus.picked_up: "This order was already picked up.",
    OrderStatus.cancelled: "This order was cancelled.",
    OrderStatus.rejected: "This order was rejected.",
}


def _reject_pickup(order: Order) -> HTTPException:
    """Turn a non-ready order into a specific, actionable 400."""
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=_PICKUP_BLOCKED_BY_STATUS.get(
            order.status, "This order is not ready for pickup yet."
        ),
    )


def verify_pickup(db: Session, vendor: User, data: PickupVerifyIn) -> Order:
    """
    Confirm a handover. Ownership and code are checked before status, and the
    ready -> picked_up move always goes through the shared state machine so it
    stays auditable and consistent with the dashboard's status control.
    """
    if data.order_id is not None:
        order = get_order_by_id(db, data.order_id)
        # Same 404 for "missing" and "someone else's" so the endpoint can't be
        # used to probe which order ids exist.
        if not order or order.vendor_id != vendor.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found.",
            )
        if data.pickup_token is not None and order.pickup_token != data.pickup_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="That code does not match this order.",
            )
    else:
        order = get_order_by_pickup_token(db, vendor.id, data.pickup_token)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No matching order for that code.",
            )

    if order.status != OrderStatus.ready:
        raise _reject_pickup(order)

    # Confirm the transition is permitted *before* writing the audit columns.
    # seed_transitions() commits, so mutating first could persist the audit
    # trail on a transition that then refused to run.
    _ensure_state_machine_seeded(db)
    if not get_transition(db, OrderStatus.ready.value, OrderStatus.picked_up.value, "vendor"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This order cannot be marked as picked up.",
        )

    order.picked_up_at = datetime.now(timezone.utc)
    order.picked_up_confirmed_by = vendor.id

    transition_order_status(
        db, vendor, order.id, OrderStatusUpdate(status=OrderStatus.picked_up)
    )
    return order


def list_ready_orders_for_pickup(db: Session, vendor: User) -> list[Order]:
    return list_ready_orders_by_vendor(db, vendor.id)
