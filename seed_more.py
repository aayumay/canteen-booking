import os
import sys

from app.db.session import SessionLocal, engine
from app.models import Base, MenuItem, Order, OrderItem, Review, User
from app.models.user import UserRole
from app.crud.order_status_transition import seed_transitions

def seed():
    db = SessionLocal()
    try:
        # Vendor 3: The Grill House (Non-Veg focus)
        vendor3 = db.query(User).filter(User.phone_number == "+919876543213").first()
        if not vendor3:
            print("Creating Vendor 3: The Grill House...")
            vendor3 = User(
                phone_number="+919876543213",
                name="Chef John",
                role=UserRole.vendor,
                shop_name="The Grill House",
                is_shop_open=True,
                is_active=True,
                stall_photo_url="https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&auto=format&fit=crop&q=80"
            )
            db.add(vendor3)
            db.commit()
            db.refresh(vendor3)

        # Vendor 4: Pure Veg Delights (Veg / Vegan focus)
        vendor4 = db.query(User).filter(User.phone_number == "+919876543214").first()
        if not vendor4:
            print("Creating Vendor 4: Pure Veg Delights...")
            vendor4 = User(
                phone_number="+919876543214",
                name="Aarti Sharma",
                role=UserRole.vendor,
                shop_name="Pure Veg Delights",
                is_shop_open=True,
                is_active=True,
                stall_photo_url="https://images.unsplash.com/photo-1576402187878-974f70c890a5?w=600&auto=format&fit=crop&q=80"
            )
            db.add(vendor4)
            db.commit()
            db.refresh(vendor4)

        # Items for Vendor 3 (Non-Veg)
        items_v3 = [
            {
                "name": "Spicy Chicken Wings",
                "description": "Crispy fried chicken wings tossed in hot buffalo sauce.",
                "price": 220.00,
                "category": "Non-Veg Starters",
                "image_url": "https://images.unsplash.com/photo-1569691899455-88464f6d3cb1?w=600&auto=format&fit=crop&q=80",
                "is_available": True,
                "calories": 650,
                "protein_g": 45.0,
                "carbs_g": 12.0,
                "fat_g": 35.0,
                "allergens": "gluten, soy",
                "is_vegan": False
            },
            {
                "name": "Grilled Chicken Burger",
                "description": "Juicy grilled chicken breast with lettuce, tomato, and mayo in a brioche bun.",
                "price": 180.00,
                "category": "Non-Veg Mains",
                "image_url": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80",
                "is_available": True,
                "calories": 550,
                "protein_g": 35.0,
                "carbs_g": 40.0,
                "fat_g": 22.0,
                "allergens": "gluten, dairy, egg",
                "is_vegan": False
            }
        ]

        # Items for Vendor 4 (Veg & Vegan)
        items_v4 = [
            {
                "name": "Paneer Tikka Masala",
                "description": "Grilled cottage cheese cubes in a rich, creamy tomato gravy.",
                "price": 190.00,
                "category": "Veg Mains",
                "image_url": "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&auto=format&fit=crop&q=80",
                "is_available": True,
                "calories": 480,
                "protein_g": 18.0,
                "carbs_g": 25.0,
                "fat_g": 32.0,
                "allergens": "dairy, nuts",
                "is_vegan": False
            },
            {
                "name": "Vegan Buddha Bowl",
                "description": "Quinoa, roasted sweet potatoes, chickpeas, kale, and tahini dressing.",
                "price": 210.00,
                "category": "Vegan Healthy",
                "image_url": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&auto=format&fit=crop&q=80",
                "is_available": True,
                "calories": 420,
                "protein_g": 14.0,
                "carbs_g": 55.0,
                "fat_g": 16.0,
                "allergens": "sesame",
                "is_vegan": True
            }
        ]

        for item_data in items_v3:
            existing = db.query(MenuItem).filter(
                MenuItem.vendor_id == vendor3.id,
                MenuItem.name == item_data["name"]
            ).first()
            if not existing:
                item = MenuItem(vendor_id=vendor3.id, **item_data)
                db.add(item)

        for item_data in items_v4:
            existing = db.query(MenuItem).filter(
                MenuItem.vendor_id == vendor4.id,
                MenuItem.name == item_data["name"]
            ).first()
            if not existing:
                item = MenuItem(vendor_id=vendor4.id, **item_data)
                db.add(item)

        db.commit()
        print("[SUCCESS] Additional vendors and items seeded!")

    finally:
        db.close()

if __name__ == "__main__":
    seed()
