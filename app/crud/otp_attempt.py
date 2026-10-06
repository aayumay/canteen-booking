from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.otp_attempt import OtpAttempt


def count_recent_otp_requests(
    db: Session, phone_number: str, since: datetime
) -> int:
    return (
        db.query(func.count(OtpAttempt.id))
        .filter(
            OtpAttempt.phone_number == phone_number,
            OtpAttempt.created_at >= since,
        )
        .scalar()
        or 0
    )


def get_latest_active_otp(db: Session, phone_number: str) -> OtpAttempt | None:
    return (
        db.query(OtpAttempt)
        .filter(
            OtpAttempt.phone_number == phone_number,
            OtpAttempt.is_used.is_(False),
            OtpAttempt.expires_at > datetime.now(timezone.utc),
        )
        .order_by(OtpAttempt.created_at.desc())
        .first()
    )


def create_otp_attempt(db: Session, phone_number: str, hashed_otp: str, expires_at: datetime) -> OtpAttempt:
    attempt = OtpAttempt(
        phone_number=phone_number,
        hashed_otp=hashed_otp,
        expires_at=expires_at,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return attempt


def increment_otp_attempt_count(db: Session, attempt: OtpAttempt) -> None:
    attempt.attempts += 1
    db.commit()


def mark_otp_used(db: Session, attempt: OtpAttempt) -> None:
    attempt.is_used = True
    db.commit()
