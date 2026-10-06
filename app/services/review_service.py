from typing import Tuple

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.crud.order import get_order_by_id
from app.crud.user import get_user_by_id
from app.models.order import Order, OrderStatus
from app.models.review import Review
from app.models.user import User, UserRole
from app.schemas.review import ReviewCreate, ReviewListOut, ReviewOut


def _extract_first_name(full_name: str | None) -> str:
    if not full_name:
        return "Student"
    parts = full_name.strip().split()
    return parts[0] if parts else "Student"


def get_vendor_rating_summary(db: Session, vendor_id: int) -> Tuple[float | None, int]:
    result = (
        db.query(
            func.avg(Review.rating),
            func.count(Review.id),
        )
        .filter(Review.vendor_id == vendor_id)
        .first()
    )
    if not result or result[1] == 0:
        return None, 0

    avg_rating = round(float(result[0]), 1) if result[0] is not None else None
    count = int(result[1])
    return avg_rating, count


def create_review(
    db: Session, student: User, order_id: int, payload: ReviewCreate
) -> ReviewOut:
    if student.role != UserRole.student:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can submit reviews.",
        )

    order = get_order_by_id(db, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found.",
        )

    if order.student_id != student.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only review your own orders.",
        )

    if order.status != OrderStatus.picked_up:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order must be completed (picked up) before it can be reviewed.",
        )

    existing_review = db.query(Review).filter(Review.order_id == order_id).first()
    if existing_review:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This order has already been reviewed.",
        )

    review = Review(
        order_id=order.id,
        student_id=student.id,
        vendor_id=order.vendor_id,
        rating=payload.rating,
        comment=payload.comment,
        photo_url=payload.photo_url,
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    return ReviewOut(
        id=review.id,
        order_id=review.order_id,
        vendor_id=review.vendor_id,
        reviewer_name=_extract_first_name(student.name),
        rating=review.rating,
        comment=review.comment,
        photo_url=review.photo_url,
        created_at=review.created_at,
    )


def list_vendor_reviews(
    db: Session, vendor_id: int, limit: int = 50, offset: int = 0
) -> ReviewListOut:
    vendor = get_user_by_id(db, vendor_id)
    if not vendor or vendor.role != UserRole.vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found.",
        )

    total = db.query(Review).filter(Review.vendor_id == vendor_id).count()
    reviews = (
        db.query(Review, User.name)
        .join(User, Review.student_id == User.id)
        .filter(Review.vendor_id == vendor_id)
        .order_by(Review.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    items = [
        ReviewOut(
            id=r.Review.id,
            order_id=r.Review.order_id,
            vendor_id=r.Review.vendor_id,
            reviewer_name=_extract_first_name(r.name),
            rating=r.Review.rating,
            comment=r.Review.comment,
            photo_url=r.Review.photo_url,
            created_at=r.Review.created_at,
        )
        for r in reviews
    ]

    avg_rating, count = get_vendor_rating_summary(db, vendor_id)
    return ReviewListOut(
        items=items,
        total=total,
        average_rating=avg_rating,
        review_count=count,
    )


def list_own_vendor_reviews(
    db: Session, vendor: User, limit: int = 50, offset: int = 0
) -> ReviewListOut:
    return list_vendor_reviews(db, vendor.id, limit=limit, offset=offset)
