from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.models.order import Order, OrderStatus
from app.models.user import User, UserRole
from app.schemas.social import LeaderboardEntryOut, LeaderboardOut, SocialProfileUpdate


def update_social_profile(db: Session, student: User, update_in: SocialProfileUpdate) -> User:
    if update_in.name is not None:
        student.name = update_in.name.strip() or None
    if update_in.hostel_block is not None:
        student.hostel_block = update_in.hostel_block.strip() or None
    if update_in.department is not None:
        student.department = update_in.department.strip() or None
    if update_in.leaderboard_opt_in is not None:
        student.leaderboard_opt_in = update_in.leaderboard_opt_in
    db.commit()
    db.refresh(student)
    return student


def get_leaderboard(db: Session, limit: int = 10) -> LeaderboardOut:
    # Count total opted in students
    opted_in_count = (
        db.query(func.count(User.id))
        .filter(
            User.role == UserRole.student,
            User.is_active == True,
            User.leaderboard_opt_in == True,
        )
        .scalar()
        or 0
    )

    # Subquery / join to compute completed orders per opted-in student
    stmt = (
        select(
            User.id,
            User.name,
            User.hostel_block,
            User.department,
            func.count(Order.id).label("total_orders"),
        )
        .outerjoin(
            Order,
            (Order.student_id == User.id)
            & (Order.status.notin_([OrderStatus.cancelled, OrderStatus.rejected])),
        )
        .filter(
            User.role == UserRole.student,
            User.is_active == True,
            User.leaderboard_opt_in == True,
        )
        .group_by(User.id)
        .order_by(func.count(Order.id).desc(), User.name.asc())
        .limit(limit)
    )

    results = db.execute(stmt).all()

    entries: list[LeaderboardEntryOut] = []
    for idx, row in enumerate(results, start=1):
        entries.append(
            LeaderboardEntryOut(
                rank=idx,
                student_id=row[0],
                name=row[1] or f"Student #{row[0]}",
                hostel_block=row[2],
                department=row[3],
                total_orders=row[4],
            )
        )

    return LeaderboardOut(entries=entries, opted_in_count=opted_in_count)
