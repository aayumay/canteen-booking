import pytest
from fastapi import status

from app.models.order import Order, OrderStatus
from app.models.pickup_slot import PickupSlot


def test_vendor_queue_depth_computation(
    client, db, student_user, vendor_user, menu_item
):
    # Initially 0 queue depth
    res = client.get("/api/v1/student/vendors")
    assert res.status_code == status.HTTP_200_OK
    vendors = res.json()
    v_data = next((v for v in vendors if v["id"] == vendor_user.id), None)
    assert v_data is not None
    assert v_data["current_queue_depth"] == 0

    # Place 2 active orders
    order1 = Order(
        student_id=student_user.id,
        vendor_id=vendor_user.id,
        status=OrderStatus.placed,
        total_amount=50.0,
        pickup_token="111222",
    )
    order2 = Order(
        student_id=student_user.id,
        vendor_id=vendor_user.id,
        status=OrderStatus.preparing,
        total_amount=50.0,
        pickup_token="111223",
    )
    db.add_all([order1, order2])
    db.commit()

    # Verify queue depth is now 2
    res2 = client.get("/api/v1/student/vendors")
    assert res2.status_code == status.HTTP_200_OK
    v_data2 = next((v for v in res2.json() if v["id"] == vendor_user.id), None)
    assert v_data2["current_queue_depth"] == 2
    assert v_data2["estimated_wait_minutes"] >= 6


def test_vendor_pickup_slot_lifecycle_and_capacity_controls(
    client, db, vendor_user, vendor_auth_headers, student_user, student_auth_headers, menu_item
):
    # Vendor creates a slot 12:45 to 13:00 max 1 order for testing capacity
    slot_payload = {
        "start_time": "12:45",
        "end_time": "13:00",
        "max_orders": 1,
    }
    res_create = client.post("/api/v1/vendor/slots", headers=vendor_auth_headers, json=slot_payload)
    assert res_create.status_code == status.HTTP_201_CREATED
    slot_id = res_create.json()["id"]
    assert res_create.json()["available_capacity"] == 1

    # Student views vendor slots
    res_student_slots = client.get(f"/api/v1/student/vendors/{vendor_user.id}/slots")
    assert res_student_slots.status_code == status.HTTP_200_OK
    slots = res_student_slots.json()
    assert len(slots) == 1
    assert slots[0]["available_capacity"] == 1

    # Student places order selecting this slot
    order_payload = {
        "vendor_id": vendor_user.id,
        "payment_method": "pay_at_counter",
        "pickup_slot_id": slot_id,
        "items": [{"menu_item_id": menu_item.id, "quantity": 1}],
    }
    res_order = client.post("/api/v1/student/orders", headers=student_auth_headers, json=order_payload)
    assert res_order.status_code == status.HTTP_201_CREATED
    order_id = res_order.json()["id"]
    assert res_order.json()["pickup_slot_id"] == slot_id

    # Check slot is now full (available_capacity = 0)
    res_slots_after = client.get(f"/api/v1/student/vendors/{vendor_user.id}/slots")
    assert res_slots_after.json()[0]["available_capacity"] == 0

    # Second student tries to order for full slot -> rejected 400
    res_order_full = client.post("/api/v1/student/orders", headers=student_auth_headers, json=order_payload)
    assert res_order_full.status_code == status.HTTP_400_BAD_REQUEST
    assert "slot is full" in res_order_full.json()["detail"].lower()

    # Cancel first order -> capacity freed
    res_cancel = client.patch(f"/api/v1/student/orders/{order_id}/cancel", headers=student_auth_headers)
    assert res_cancel.status_code == status.HTTP_200_OK
    res_slots_freed = client.get(f"/api/v1/student/vendors/{vendor_user.id}/slots")
    assert res_slots_freed.json()[0]["available_capacity"] == 1
