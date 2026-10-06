import pytest
from fastapi import status
from app.models.menu_item import MenuItem
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.user import User


def test_order_placement_server_side_total_and_snapshots(
    client, db, student_user, vendor_user, student_auth_headers
):
    item1 = MenuItem(
        vendor_id=vendor_user.id,
        name="Paneer Roll",
        price=80.00,
        is_available=True,
    )
    item2 = MenuItem(
        vendor_id=vendor_user.id,
        name="Cold Coffee",
        price=40.00,
        is_available=True,
    )
    db.add_all([item1, item2])
    db.commit()
    db.refresh(item1)
    db.refresh(item2)

    payload = {
        "vendor_id": vendor_user.id,
        "items": [
            {"menu_item_id": item1.id, "quantity": 2},
            {"menu_item_id": item2.id, "quantity": 1},
        ],
    }

    response = client.post("/api/v1/student/orders", headers=student_auth_headers, json=payload)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()

    # Total should be (80*2) + (40*1) = 200.00 calculated strictly server side
    assert float(data["total_amount"]) == 200.00
    assert len(data["items"]) == 2
    order_id = data["id"]

    # Now simulate vendor changing menu item price later
    item1.price = 120.00
    db.commit()

    # Verify existing OrderItem still preserves original snapshot price
    saved_order = client.get(f"/api/v1/student/orders/{order_id}", headers=student_auth_headers).json()
    assert float(saved_order["total_amount"]) == 200.00
    item1_snapshot = next(it for it in saved_order["items"] if it["menu_item_id"] == item1.id)
    assert float(item1_snapshot["price_at_order"]) == 80.00


def test_order_placement_unavailable_item_fails(
    client, db, student_user, vendor_user, student_auth_headers
):
    item = MenuItem(
        vendor_id=vendor_user.id,
        name="Sold Out Cake",
        price=150.00,
        is_available=False,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    payload = {
        "vendor_id": vendor_user.id,
        "items": [{"menu_item_id": item.id, "quantity": 1}],
    }

    response = client.post("/api/v1/student/orders", headers=student_auth_headers, json=payload)
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "not available" in response.json()["detail"].lower()


def test_order_placement_closed_shop_fails(
    client, db, student_user, vendor_user, student_auth_headers, menu_item
):
    # Set shop closed
    vendor_user.is_shop_open = False
    db.commit()

    payload = {
        "vendor_id": vendor_user.id,
        "items": [{"menu_item_id": menu_item.id, "quantity": 1}],
    }

    response = client.post("/api/v1/student/orders", headers=student_auth_headers, json=payload)
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "closed" in response.json()["detail"].lower()
