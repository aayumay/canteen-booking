from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload
from app.models.meal_plan import MealPlan, MealPlanSubscription
from app.models.user import User
from app.schemas.meal_plan import MealPlanCreate, MealPlanUpdate


def create_meal_plan(db: Session, vendor_id: int, plan_in: MealPlanCreate) -> MealPlan:
    plan = MealPlan(
        vendor_id=vendor_id,
        name=plan_in.name,
        description=plan_in.description,
        price=plan_in.price,
        total_meals=plan_in.total_meals,
        validity_days=plan_in.validity_days,
        is_active=True,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


def get_meal_plan(db: Session, plan_id: int) -> MealPlan | None:
    return db.query(MealPlan).filter(MealPlan.id == plan_id).first()


def get_vendor_meal_plans(db: Session, vendor_id: int, active_only: bool = False) -> list[MealPlan]:
    query = db.query(MealPlan).filter(MealPlan.vendor_id == vendor_id)
    if active_only:
        query = query.filter(MealPlan.is_active == True)
    return query.order_by(MealPlan.id.desc()).all()


def get_active_meal_plans(db: Session) -> list[MealPlan]:
    stmt = (
        select(MealPlan)
        .join(User, MealPlan.vendor_id == User.id)
        .filter(MealPlan.is_active == True, User.is_active == True, User.is_approved == True)
        .order_by(MealPlan.id.desc())
    )
    plans = db.execute(stmt).scalars().all()
    for p in plans:
        p.vendor_shop_name = p.vendor.shop_name if p.vendor else None
    return list(plans)


def update_meal_plan(db: Session, plan: MealPlan, plan_in: MealPlanUpdate) -> MealPlan:
    update_data = plan_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(plan, field, val)
    db.commit()
    db.refresh(plan)
    return plan


def create_subscription(
    db: Session, student_id: int, meal_plan: MealPlan
) -> MealPlanSubscription:
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=meal_plan.validity_days)
    sub = MealPlanSubscription(
        student_id=student_id,
        meal_plan_id=meal_plan.id,
        meals_remaining=meal_plan.total_meals,
        expires_at=expires_at,
        is_active=True,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


def get_student_subscriptions(
    db: Session, student_id: int, active_only: bool = False
) -> list[MealPlanSubscription]:
    now = datetime.now(timezone.utc)
    query = (
        db.query(MealPlanSubscription)
        .options(joinedload(MealPlanSubscription.meal_plan).joinedload(MealPlan.vendor))
        .filter(MealPlanSubscription.student_id == student_id)
    )
    if active_only:
        query = query.filter(
            MealPlanSubscription.is_active == True,
            MealPlanSubscription.meals_remaining > 0,
            MealPlanSubscription.expires_at > now,
        )
    subs = query.order_by(MealPlanSubscription.id.desc()).all()
    for s in subs:
        if s.meal_plan:
            s.meal_plan.vendor_shop_name = (
                s.meal_plan.vendor.shop_name if s.meal_plan.vendor else None
            )
    return subs


def get_student_active_subscription_for_vendor(
    db: Session, student_id: int, vendor_id: int
) -> MealPlanSubscription | None:
    now = datetime.now(timezone.utc)
    sub = (
        db.query(MealPlanSubscription)
        .join(MealPlan, MealPlanSubscription.meal_plan_id == MealPlan.id)
        .filter(
            MealPlanSubscription.student_id == student_id,
            MealPlan.vendor_id == vendor_id,
            MealPlanSubscription.is_active == True,
            MealPlanSubscription.meals_remaining > 0,
            MealPlanSubscription.expires_at > now,
        )
        .order_by(MealPlanSubscription.expires_at.asc())
        .first()
    )
    return sub
