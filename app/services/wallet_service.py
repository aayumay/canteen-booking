from decimal import Decimal
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User, UserRole
from app.models.wallet_transaction import WalletTransaction, WalletTransactionType


def adjust_wallet_balance(
    db: Session,
    student_id: int,
    amount: float,
    tx_type: WalletTransactionType,
    reason: str | None = None,
    related_order_id: int | None = None,
) -> WalletTransaction:
    student = db.query(User).filter(User.id == student_id, User.role == UserRole.student).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found.",
        )

    current_balance = Decimal(str(student.wallet_balance or 0.0))
    adjustment = Decimal(str(amount))
    new_balance = current_balance + adjustment

    if new_balance < Decimal("0.00"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient wallet balance. Current: ₹{float(current_balance):.2f}, required: ₹{float(abs(adjustment)):.2f}",
        )

    student.wallet_balance = float(new_balance)
    tx = WalletTransaction(
        student_id=student.id,
        amount=float(adjustment),
        type=tx_type,
        related_order_id=related_order_id,
        reason=reason,
        balance_after=float(new_balance),
    )
    db.add(tx)
    return tx


def get_student_wallet_details(db: Session, student_id: int):
    student = db.query(User).filter(User.id == student_id).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found.")

    transactions = (
        db.query(WalletTransaction)
        .filter(WalletTransaction.student_id == student_id)
        .order_by(WalletTransaction.created_at.desc())
        .all()
    )

    bal = float(student.wallet_balance or 0.0)
    thresh = float(student.low_balance_threshold or 50.0)
    is_low = bal <= thresh

    return {
        "balance": bal,
        "low_balance_threshold": thresh,
        "is_low_balance": is_low,
        "transactions": transactions,
    }
