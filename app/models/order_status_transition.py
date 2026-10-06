from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class OrderStatusTransition(Base):
    __tablename__ = "order_status_transitions"

    id: Mapped[int] = mapped_column(primary_key=True)
    from_status: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    to_status: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    actor: Mapped[str] = mapped_column(String(20), nullable=False)
    requires_reason: Mapped[bool] = mapped_column(default=False, nullable=False)
