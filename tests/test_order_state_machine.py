import pytest
from fastapi import status
from app.models.order import Order, OrderStatus
from app.models.order_item import OrderItem
from app.models.user import User


def _create_order(db, student: User, vendor: User, status: OrderStatus = OrderStatus.placed) -> Order:
    order = Order(
        student_id=student.id,
        vendor_id=vendor.id,
        status=status,
        total_amount=100.00,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def test_order_full_valid_lifecycle(client, db, student_user, vendor_user, vendor_auth_headers):
    order = _create_order(db, student_user, vendor_user, OrderStatus.placed)

    # placed -> accepted
    res1 = client.patch(
        f"/api/v1/vendor/orders/{order.id}/status",
        headers=vendor_auth_headers,
        json={"status": "accepted"},
    )
    assert res1.status_code == status.HTTP_200_OK
    assert res1.json()["status"] == "accepted"

    # accepted -> preparing
    res2 = client.patch(
        f"/api/v1/vendor/orders/{order.id}/status",
        headers=vendor_auth_headers,
        json={"status": "preparing"},
    )
    assert res2.status_code == status.HTTP_200_OK
    assert res2.json()["status"] == "preparing"

    # preparing -> ready
    res3 = client.patch(
        f"/api/v1/vendor/orders/{order.id}/status",
        headers=vendor_auth_headers,
        json={"status": "ready"},
    )
    assert res3.status_code == status.HTTP_200_OK
    assert res3.json()["status"] == "ready"

    # ready -> picked_up
    res4 = client.patch(
        f"/api/v1/vendor/orders/{order.id}/status",
        headers=vendor_auth_headers,
        json={"status": "picked_up"},
    )
    assert res4.status_code == status.HTTP_200_OK
    assert res4.json()["status"] == "picked_up"


def test_order_invalid_transition_skipped_state(client, db, student_user, vendor_user, vendor_auth_headers):
    order = _create_order(db, student_user, vendor_user, OrderStatus.placed)

    # placed -> ready (illegal skipped step)
    res = client.patch(
        f"/api/v1/vendor/orders/{order.id}/status",
        headers=vendor_auth_headers,
        json={"status": "ready"},
    )
    assert res.status_code == status.HTTP_400_BAD_REQUEST


def test_vendor_rejection_requires_reason(client, db, student_user, vendor_user, vendor_auth_headers):
    order = _create_order(db, student_user, vendor_user, OrderStatus.placed)

    # placed -> rejected without reason
    res_no_reason = client.patch(
        f"/api/v1/vendor/orders/{order.id}/status",
        headers=vendor_auth_headers,
        json={"status": "rejected"},
    )
    assert res_no_reason.status_code == status.HTTP_400_BAD_REQUEST

    # placed -> rejected with reason
    res_with_reason = client.patch(
        f"/api/v1/vendor/orders/{order.id}/status",
        headers=vendor_auth_headers,
        json={"status": "rejected", "rejection_reason": "Out of stock"},
    )
    assert res_with_reason.status_code == status.HTTP_200_OK
    assert res_with_reason.json()["status"] == "rejected"
    assert res_with_reason.json()["rejection_reason"] == "Out of stock"


def test_student_cancel_only_when_placed(client, db, student_user, vendor_user, student_auth_headers):
    # Placed order -> cancellation allowed
    order = _create_order(db, student_user, vendor_user, OrderStatus.placed)
    res = client.patch(
        f"/api/v1/student/orders/{order.id}/cancel",
        headers=student_auth_headers,
    )
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["status"] == "cancelled"

    # Accepted order -> cancellation forbidden
    order2 = _create_order(db, student_user, vendor_user, OrderStatus.accepted)
    res2 = client.patch(
        f"/api/v1/student/orders/{order2.id}/cancel",
        headers=student_auth_headers,
    )
    assert res2.status_code == status.HTTP_400_BAD_REQUEST
