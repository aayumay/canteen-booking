from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from app.models.wallet_transaction import WalletTransactionType


class WalletAdjustmentRequest(BaseModel):
    student_id: int
    amount: float = Field(..., description="Positive to credit, negative to debit")
    reason: str = Field(..., min_length=1, max_length=500)


class WalletThresholdUpdate(BaseModel):
    low_balance_threshold: float = Field(..., ge=0)


class WalletTransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    amount: float
    type: WalletTransactionType
    related_order_id: int | None = None
    reason: str | None = None
    balance_after: float
    created_at: datetime


class StudentWalletOut(BaseModel):
    balance: float
    low_balance_threshold: float
    is_low_balance: bool
    transactions: list[WalletTransactionOut] = []
