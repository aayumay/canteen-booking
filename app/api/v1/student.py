from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_student, get_current_user
from app.crud.menu_item import list_menu_items_by_vendor
from app.crud.order import get_order_by_id_with_items, list_orders_by_student
from app.crud.user import get_user_by_id
from app.db.session import get_db
from app.models.order import OrderStatus
from app.models.user import User, UserRole
from app.schemas.class_schedule import (
    ClassScheduleCreate,
    ClassScheduleOut,
    UpcomingBreakOut,
)
from app.schemas.meal_plan import MealPlanOut, MealPlanSubscriptionOut
from app.schemas.menu_item import MenuItemOut
from app.schemas.order import (
    OrderCreate,
    OrderOut,
    OrderStatusUpdate,
    OrderWithItemsOut,
    SustainabilityStatsOut,
)
from app.schemas.review import ReviewCreate, ReviewListOut, ReviewOut
from app.schemas.user import VendorOut
from app.schemas.wallet import StudentWalletOut, WalletThresholdUpdate
from app.services.order_service import place_order, transition_order_status
from app.services.review_service import (
    create_review,
    get_vendor_rating_summary,
    list_vendor_reviews,
)

from app.crud.pickup_slot import get_vendor_queue_depth, list_pickup_slots_by_vendor
from app.schemas.pickup_slot import PickupSlotOut

router = APIRouter(prefix="/student", tags=["student"])


@router.get("/vendors", response_model=list[VendorOut])
def list_open_vendors(
    db: Annotated[Session, Depends(get_db)],
):
    vendors = (
        db.query(User)
        .filter(
            User.role == UserRole.vendor,
            User.is_approved.is_(True),
            User.is_shop_open.is_(True),
            User.is_active.is_(True),
        )
        .order_by(User.shop_name)
        .all()
    )

    out = []
    for v in vendors:
        avg_rating, count = get_vendor_rating_summary(db, v.id)
        queue_depth, wait_mins = get_vendor_queue_depth(db, v.id)
        out.append(
            VendorOut(
                id=v.id,
                phone_number=v.phone_number,
                name=v.name,
                shop_name=v.shop_name or "Canteen Vendor",
                is_shop_open=v.is_shop_open,
                is_approved=v.is_approved,
                stall_photo_url=v.stall_photo_url,
                average_rating=avg_rating,
                review_count=count,
                current_queue_depth=queue_depth,
                estimated_wait_minutes=wait_mins,
            )
        )
    return out


@router.get("/vendors/{vendor_id}/slots", response_model=list[PickupSlotOut])
def get_vendor_available_slots(
    vendor_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    vendor = get_user_by_id(db, vendor_id)
    if not vendor or vendor.role != UserRole.vendor or not vendor.is_active or not vendor.is_approved:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found.",
        )
    slots = list_pickup_slots_by_vendor(db, vendor_id, active_only=True)
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


@router.get("/vendors/{vendor_id}/menu", response_model=list[MenuItemOut])
def view_vendor_menu(
    vendor_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    vendor = get_user_by_id(db, vendor_id)
    if not vendor or vendor.role != UserRole.vendor or not vendor.is_active or not vendor.is_approved:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found or suspended.",
        )
    return list_menu_items_by_vendor(db, vendor_id, available_only=True)


@router.post("/orders", response_model=OrderWithItemsOut, status_code=status.HTTP_201_CREATED)
def create_order(
    data: OrderCreate,
    db: Annotated[Session, Depends(get_db)],
    student=Depends(get_current_student),
):
    order = place_order(db, student, data)
    return get_order_by_id_with_items(db, order.id)


@router.get("/orders", response_model=list[OrderWithItemsOut])
def list_my_orders(
    db: Annotated[Session, Depends(get_db)],
    student=Depends(get_current_student),
):
    return list_orders_by_student(db, student.id)


@router.get("/orders/{order_id}", response_model=OrderWithItemsOut)
def get_my_order(
    order_id: int,
    db: Annotated[Session, Depends(get_db)],
    student=Depends(get_current_student),
):
    order = get_order_by_id_with_items(db, order_id)
    if not order or order.student_id != student.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found.",
        )
    return order


@router.patch("/orders/{order_id}/cancel", response_model=OrderWithItemsOut)
def cancel_my_order(
    order_id: int,
    db: Annotated[Session, Depends(get_db)],
    student=Depends(get_current_student),
):
    order = transition_order_status(
        db, student, order_id, OrderStatusUpdate(status=OrderStatus.cancelled)
    )
    return get_order_by_id_with_items(db, order.id)


@router.post(
    "/orders/{order_id}/review",
    response_model=ReviewOut,
    status_code=status.HTTP_201_CREATED,
)
def submit_order_review(
    order_id: int,
    data: ReviewCreate,
    db: Annotated[Session, Depends(get_db)],
    student: User = Depends(get_current_student),
):
    return create_review(db, student, order_id, data)


@router.get("/vendors/{vendor_id}/reviews", response_model=ReviewListOut)
def get_vendor_reviews(
    vendor_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: User = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0,
):
    return list_vendor_reviews(db, vendor_id, limit=limit, offset=offset)


@router.get("/wallet", response_model=StudentWalletOut)
def get_my_wallet(
    db: Annotated[Session, Depends(get_db)],
    student: User = Depends(get_current_student),
):
    from app.services.wallet_service import get_student_wallet_details

    return get_student_wallet_details(db, student.id)


@router.patch("/wallet/threshold", response_model=StudentWalletOut)
def update_wallet_threshold(
    data: WalletThresholdUpdate,
    db: Annotated[Session, Depends(get_db)],
    student: User = Depends(get_current_student),
):
    student.low_balance_threshold = data.low_balance_threshold
    db.commit()
    db.refresh(student)
    from app.services.wallet_service import get_student_wallet_details

    return get_student_wallet_details(db, student.id)


@router.get("/meal-plans", response_model=list[MealPlanOut])
def list_available_meal_plans(
    db: Annotated[Session, Depends(get_db)],
    student: User = Depends(get_current_student),
):
    from app.crud.meal_plan import get_active_meal_plans

    plans = get_active_meal_plans(db)
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
            vendor_shop_name=getattr(p, "vendor_shop_name", None) or (p.vendor.shop_name if p.vendor else None),
        )
        for p in plans
    ]


@router.post("/meal-plans/{plan_id}/subscribe", response_model=MealPlanSubscriptionOut, status_code=status.HTTP_201_CREATED)
def subscribe_to_meal_plan(
    plan_id: int,
    db: Annotated[Session, Depends(get_db)],
    student: User = Depends(get_current_student),
):
    from app.crud.meal_plan import create_subscription, get_meal_plan
    from app.models.wallet_transaction import WalletTransactionType
    from app.services.wallet_service import adjust_wallet_balance

    plan = get_meal_plan(db, plan_id)
    if not plan or not plan.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meal plan not found or is currently inactive.",
        )

    plan_price = float(plan.price)
    current_balance = float(student.wallet_balance or 0.0)
    if current_balance < plan_price:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient wallet balance. Current balance: ₹{current_balance:.2f}, required: ₹{plan_price:.2f}",
        )

    # Atomically debit from wallet
    adjust_wallet_balance(
        db,
        student_id=student.id,
        amount=-plan_price,
        tx_type=WalletTransactionType.meal_plan_purchase,
        reason=f"Purchase of Meal Plan: {plan.name}",
    )

    sub = create_subscription(db, student.id, plan)
    db.commit()
    db.refresh(sub)

    return MealPlanSubscriptionOut(
        id=sub.id,
        student_id=sub.student_id,
        meal_plan_id=sub.meal_plan_id,
        meals_remaining=sub.meals_remaining,
        expires_at=sub.expires_at,
        is_active=sub.is_active,
        created_at=sub.created_at,
        meal_plan=MealPlanOut(
            id=plan.id,
            vendor_id=plan.vendor_id,
            name=plan.name,
            description=plan.description,
            price=float(plan.price),
            total_meals=plan.total_meals,
            validity_days=plan.validity_days,
            is_active=plan.is_active,
            created_at=plan.created_at,
            vendor_shop_name=plan.vendor.shop_name if plan.vendor else None,
        ),
    )


@router.get("/my-meal-plans", response_model=list[MealPlanSubscriptionOut])
def get_my_meal_plans(
    db: Annotated[Session, Depends(get_db)],
    student: User = Depends(get_current_student),
    active_only: bool = False,
):
    from app.crud.meal_plan import get_student_subscriptions

    subs = get_student_subscriptions(db, student.id, active_only=active_only)
    return [
        MealPlanSubscriptionOut(
            id=s.id,
            student_id=s.student_id,
            meal_plan_id=s.meal_plan_id,
            meals_remaining=s.meals_remaining,
            expires_at=s.expires_at,
            is_active=s.is_active,
            created_at=s.created_at,
            meal_plan=MealPlanOut(
                id=s.meal_plan.id,
                vendor_id=s.meal_plan.vendor_id,
                name=s.meal_plan.name,
                description=s.meal_plan.description,
                price=float(s.meal_plan.price),
                total_meals=s.meal_plan.total_meals,
                validity_days=s.meal_plan.validity_days,
                is_active=s.meal_plan.is_active,
                created_at=s.meal_plan.created_at,
                vendor_shop_name=getattr(s.meal_plan, "vendor_shop_name", None),
            )
            if s.meal_plan
            else None,
        )
        for s in subs
    ]


@router.post("/schedule", response_model=ClassScheduleOut, status_code=status.HTTP_201_CREATED)
def add_class_schedule_entry(
    data: ClassScheduleCreate,
    db: Annotated[Session, Depends(get_db)],
    student: User = Depends(get_current_student),
):
    from app.crud.class_schedule import create_schedule_entry

    entry = create_schedule_entry(db, student.id, data)
    return ClassScheduleOut(
        id=entry.id,
        student_id=entry.student_id,
        day_of_week=entry.day_of_week,
        class_name=entry.class_name,
        start_time=entry.start_time.strftime("%H:%M"),
        end_time=entry.end_time.strftime("%H:%M"),
        location=entry.location,
    )


@router.get("/schedule", response_model=list[ClassScheduleOut])
def list_my_class_schedule(
    db: Annotated[Session, Depends(get_db)],
    student: User = Depends(get_current_student),
):
    from app.crud.class_schedule import get_student_schedule

    entries = get_student_schedule(db, student.id)
    return [
        ClassScheduleOut(
            id=e.id,
            student_id=e.student_id,
            day_of_week=e.day_of_week,
            class_name=e.class_name,
            start_time=e.start_time.strftime("%H:%M"),
            end_time=e.end_time.strftime("%H:%M"),
            location=e.location,
        )
        for e in entries
    ]


@router.delete("/schedule/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_class_schedule_entry(
    entry_id: int,
    db: Annotated[Session, Depends(get_db)],
    student: User = Depends(get_current_student),
):
    from app.crud.class_schedule import delete_schedule_entry, get_schedule_entry_by_id

    entry = get_schedule_entry_by_id(db, entry_id)
    if not entry or entry.student_id != student.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class schedule entry not found.",
        )
    delete_schedule_entry(db, entry)
    return None


@router.get("/schedule/upcoming-break", response_model=UpcomingBreakOut)
def get_upcoming_lecture_break(
    db: Annotated[Session, Depends(get_db)],
    student: User = Depends(get_current_student),
):
    from app.crud.class_schedule import compute_upcoming_break

    return compute_upcoming_break(db, student.id)


@router.get("/allergens", response_model=dict)
def get_student_allergens(
    student: User = Depends(get_current_student),
):
    raw = student.allergen_filters or ""
    allergens = [a.strip() for a in raw.split(",") if a.strip()]
    return {"allergens": allergens}


@router.patch("/allergens", response_model=dict)
def update_student_allergens(
    data: dict,
    db: Annotated[Session, Depends(get_db)],
    student: User = Depends(get_current_student),
):
    allergens_list = data.get("allergens", [])
    clean_str = ",".join([str(a).strip().lower() for a in allergens_list if str(a).strip()])
    student.allergen_filters = clean_str if clean_str else None
    db.commit()
    db.refresh(student)
    return {"allergens": allergens_list}


@router.patch("/profile/social", response_model=dict)
def update_student_social_profile(
    data: dict,
    db: Annotated[Session, Depends(get_db)],
    student: User = Depends(get_current_student),
):
    from app.crud.social import update_social_profile
    from app.schemas.social import SocialProfileUpdate

    up = SocialProfileUpdate(
        name=data.get("name"),
        hostel_block=data.get("hostel_block"),
        department=data.get("department"),
        leaderboard_opt_in=data.get("leaderboard_opt_in"),
    )
    user = update_social_profile(db, student, up)
    return {
        "id": user.id,
        "name": user.name,
        "hostel_block": user.hostel_block,
        "department": user.department,
        "leaderboard_opt_in": user.leaderboard_opt_in,
    }


@router.get("/leaderboard", response_model=dict)
def get_campus_leaderboard(
    db: Annotated[Session, Depends(get_db)],
    student: User = Depends(get_current_student),
    limit: int = 10,
):
    from app.crud.social import get_leaderboard

    lb = get_leaderboard(db, limit=limit)
    return lb.model_dump()


@router.get("/sustainability-stats", response_model=SustainabilityStatsOut)
def get_student_sustainability_stats(
    db: Annotated[Session, Depends(get_db)],
    student: User = Depends(get_current_student),
):
    from app.models.order import Order
    orders = (
        db.query(Order)
        .filter(
            Order.student_id == student.id,
            Order.status.notin_([OrderStatus.cancelled, OrderStatus.rejected]),
        )
        .all()
    )
    total_orders = len(orders)
    cutlery_saved_count = sum(1 for o in orders if not o.cutlery_needed)
    containers_reused_count = sum(1 for o in orders if o.reusable_container)
    total_eco_saved_amount = sum(float(o.container_discount or 0.0) for o in orders)
    plastic_saved_grams = (cutlery_saved_count * 20.0) + (containers_reused_count * 50.0)

    return SustainabilityStatsOut(
        total_orders=total_orders,
        cutlery_saved_count=cutlery_saved_count,
        containers_reused_count=containers_reused_count,
        total_eco_saved_amount=round(total_eco_saved_amount, 2),
        plastic_saved_grams=round(plastic_saved_grams, 1),
    )



