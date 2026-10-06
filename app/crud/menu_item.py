from sqlalchemy.orm import Session

from app.models.menu_item import MenuItem
from app.schemas.menu_item import MenuItemCreate, MenuItemUpdate


def _format_allergens(val) -> str | None:
    if val is None:
        return None
    if isinstance(val, list):
        return ",".join([str(x).strip().lower() for x in val if str(x).strip()])
    return str(val).strip()


def get_menu_item_by_id(db: Session, item_id: int) -> MenuItem | None:
    return db.query(MenuItem).filter(MenuItem.id == item_id).first()


def list_menu_items_by_vendor(
    db: Session, vendor_id: int, available_only: bool = False
) -> list[MenuItem]:
    query = db.query(MenuItem).filter(MenuItem.vendor_id == vendor_id)
    if available_only:
        query = query.filter(MenuItem.is_available.is_(True))
    return query.order_by(MenuItem.category, MenuItem.name).all()


def create_menu_item(db: Session, vendor_id: int, data: MenuItemCreate) -> MenuItem:
    item = MenuItem(
        vendor_id=vendor_id,
        name=data.name,
        description=data.description,
        price=data.price,
        category=data.category,
        image_url=data.image_url,
        is_available=data.is_available,
        # Nutrition is entirely optional: these land as NULL when the vendor
        # left the section blank, and the student-facing nutrition panel is
        # hidden rather than filled with defaults.
        ingredients=data.ingredients,
        serving_size=data.serving_size,
        calories=data.calories,
        protein_g=data.protein_g,
        carbs_g=data.carbs_g,
        fat_g=data.fat_g,
        fiber_g=data.fiber_g,
        allergens=_format_allergens(data.allergens),
        is_vegan=data.is_vegan if data.is_vegan is not None else False,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_menu_item(db: Session, item: MenuItem, data: MenuItemUpdate) -> MenuItem:
    update_data = data.model_dump(exclude_unset=True)
    if "allergens" in update_data:
        update_data["allergens"] = _format_allergens(update_data["allergens"])
    for field, value in update_data.items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


def delete_menu_item(db: Session, item: MenuItem) -> None:
    db.delete(item)
    db.commit()
