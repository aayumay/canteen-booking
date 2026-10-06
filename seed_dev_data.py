"""
Dev seed script to populate realistic sample vendors and menu items.
Run with: python seed_dev_data.py
"""
import os
import sys

from app.db.session import SessionLocal, engine
from app.models import Base, MenuItem, Order, OrderItem, Review, User
from app.models.user import UserRole
from app.crud.order_status_transition import seed_transitions

def seed():
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        seed_transitions(db)

        # Check if vendor already exists
        vendor1 = db.query(User).filter(User.phone_number == "+919876543211").first()
        if not vendor1:
            print("Creating Vendor 1: Snack Corner...")
            vendor1 = User(
                phone_number="+919876543211",
                name="Chef Marco",
                role=UserRole.vendor,
                shop_name="Snack Corner",
                is_shop_open=True,
                is_active=True,
            )
            db.add(vendor1)
            db.commit()
            db.refresh(vendor1)

        vendor2 = db.query(User).filter(User.phone_number == "+919876543212").first()
        if not vendor2:
            print("Creating Vendor 2: Fresh Cafe & Drinks...")
            vendor2 = User(
                phone_number="+919876543212",
                name="Barista Sarah",
                role=UserRole.vendor,
                shop_name="Fresh Cafe & Drinks",
                is_shop_open=True,
                is_active=True,
            )
            db.add(vendor2)
            db.commit()
            db.refresh(vendor2)

        # Student user
        student = db.query(User).filter(User.phone_number == "+919876543210").first()
        if not student:
            print("Creating Student: Aayush...")
            student = User(
                phone_number="+919876543210",
                name="Aayush Kushwaha",
                role=UserRole.student,
                is_active=True,
            )
            db.add(student)
            db.commit()
            db.refresh(student)

        # Seed Menu Items for Vendor 1
        items_v1 = [
            {
                "name": "Greek Green Salad",
                "description": "Crisp romaine, cherry tomatoes, cucumbers, feta cheese, and olive oil vinaigrette.",
                "price": 85.00,
                "category": "Salads",
                "image_url": "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80",
                "is_available": True,
            },
            {
                "name": "Roasted Pumpkin Soup",
                "description": "Creamy roasted pumpkin puree with toasted seeds, coconut cream, and garlic croutons.",
                "price": 65.00,
                "category": "Salads",
                "image_url": "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&auto=format&fit=crop&q=80",
                "is_available": True,
            },
            {
                "name": "Artisan Veg Pizza",
                "description": "Stone-baked thin crust pizza loaded with bell peppers, olives, basil, and fresh mozzarella.",
                "price": 140.00,
                "category": "Pizza",
                "image_url": "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80",
                "is_available": True,
            },
            {
                "name": "Avocado Salmon Roll",
                "description": "Fresh Atlantic salmon, ripe avocado, sushi rice, toasted sesame, and wasabi mayo.",
                "price": 180.00,
                "category": "Sushi",
                "image_url": "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&auto=format&fit=crop&q=80",
                "is_available": True,
            },
            {
                "name": "Belgian Chocolate Lava Cake",
                "description": "Warm molten dark chocolate center with powdered sugar and vanilla bean ice cream.",
                "price": 80.00,
                "category": "Cakes",
                "image_url": "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&auto=format&fit=crop&q=80",
                "is_available": True,
            },
            {
                "name": "Teriyaki Tofu Power Bowl",
                "description": "Steamed brown rice, glazed teriyaki tofu, edamame, shredded purple cabbage, and sesame seeds.",
                "price": 120.00,
                "category": "Bowls",
                "image_url": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80",
                "is_available": True,
            },
            {
                "name": "Tropical Mango Smoothie",
                "description": "Chilled blend of fresh Alphonso mangoes, Greek yogurt, chia seeds, and honey.",
                "price": 55.00,
                "category": "Drinks",
                "image_url": "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=600&auto=format&fit=crop&q=80",
                "is_available": True,
            },
        ]

        for item_data in items_v1:
            existing = db.query(MenuItem).filter(
                MenuItem.vendor_id == vendor1.id,
                MenuItem.name == item_data["name"]
            ).first()
            if not existing:
                item = MenuItem(vendor_id=vendor1.id, **item_data)
                db.add(item)

        # Seed Menu Items for Vendor 2
        items_v2 = [
            {
                "name": "Cold Brew Artisan Coffee",
                "description": "Slow-steeped 18hr cold brew with oat milk and caramel drizzle.",
                "price": 70.00,
                "category": "Drinks",
                "image_url": "https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=600&auto=format&fit=crop&q=80",
                "is_available": True,
            },
            {
                "name": "Wild Berry Protein Smoothie",
                "description": "Blueberries, strawberries, raspberries, whey protein, and almond milk.",
                "price": 85.00,
                "category": "Drinks",
                "image_url": "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=600&auto=format&fit=crop&q=80",
                "is_available": True,
            },
        ]

        for item_data in items_v2:
            existing = db.query(MenuItem).filter(
                MenuItem.vendor_id == vendor2.id,
                MenuItem.name == item_data["name"]
            ).first()
            if not existing:
                item = MenuItem(vendor_id=vendor2.id, **item_data)
                db.add(item)

        db.commit()
        print("[SUCCESS] Database successfully seeded with vendors and dishes!")

    finally:
        db.close()

if __name__ == "__main__":
    seed()
