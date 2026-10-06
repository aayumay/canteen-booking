from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class MenuItem(Base):
    __tablename__ = "menu_items"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    # Nutrition & Allergen fields
    #
    # Every one of these is optional. Small canteen stalls frequently have no
    # nutrition data at all, and an empty section is far more honest than
    # showing placeholder numbers that look measured but are not. The app
    # never estimates or infers any of this from the ingredients text.
    calories: Mapped[int | None] = mapped_column(Integer, nullable=True)
    protein_g: Mapped[float | None] = mapped_column(Numeric(6, 1), nullable=True)
    carbs_g: Mapped[float | None] = mapped_column(Numeric(6, 1), nullable=True)
    fat_g: Mapped[float | None] = mapped_column(Numeric(6, 1), nullable=True)
    fiber_g: Mapped[float | None] = mapped_column(Numeric(6, 1), nullable=True)
    # Free text as the vendor typed it (comma- or newline-separated). No
    # ingredient master table: at this scale a structured list would be a
    # normalisation exercise nobody asked for, and it would fight the vendors
    # who describe a dish in their own words.
    ingredients: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Gives the macros context - "18g protein" means something very different
    # per plate than per bite.
    serving_size: Mapped[str | None] = mapped_column(String(100), nullable=True)
    allergens: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_vegan: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Operational waste / Flash discount fields
    is_flash_discount: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    flash_discount_percent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    vendor: Mapped["User"] = relationship("User", back_populates="menu_items")
    order_items: Mapped[list["OrderItem"]] = relationship("OrderItem", back_populates="menu_item")

    @property
    def effective_price(self) -> float:
        if self.is_flash_discount and self.flash_discount_percent > 0:
            return round(float(self.price) * (1 - self.flash_discount_percent / 100.0), 2)
        return float(self.price)

