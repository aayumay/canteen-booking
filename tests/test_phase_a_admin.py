from datetime import datetime, timedelta, timezone
import pytest
from fastapi import status

from app.models.announcement import Announcement
from app.models.order import Order, OrderStatus
from app.models.order_item import OrderItem
from app.models.user import User, UserRole


def test_provision_admin_user_success(client, db, admin_headers):
    payload = {
        "phone_number": "+919876540001",
        "name": "Institution Principal",
    }
    res = client.post("/api/v1/admin/users", headers=admin_headers, json=payload)
    assert res.status_code == status.HTTP_201_CREATED
    data = res.json()
    assert data["phone_number"] == "+919876540001"
    assert data["role"] == "admin"
    assert data["name"] == "Institution Principal"


def test_admin_endpoints_forbidden_for_student_and_vendor(
    client, student_auth_headers, vendor_auth_headers
):
    res_student = client.get("/api/v1/admin/vendors", headers=student_auth_headers)
    assert res_student.status_code == status.HTTP_403_FORBIDDEN

    res_vendor = client.get("/api/v1/admin/analytics/summary", headers=vendor_auth_headers)
    assert res_vendor.status_code == status.HTTP_403_FORBIDDEN


def test_admin_vendor_list_and_suspension_flow(
    client, db, admin_auth_headers, vendor_user, menu_item, student_auth_headers
):
    # Check admin vendors list
    res = client.get("/api/v1/admin/vendors", headers=admin_auth_headers)
    assert res.status_code == status.HTTP_200_OK
    vendors = res.json()
    assert len(vendors) >= 1
    target = next((v for v in vendors if v["id"] == vendor_user.id), None)
    assert target is not None
    assert target["is_active"] is True
    assert target["item_count"] >= 1

    # Suspend vendor
    res_sus = client.patch(
        f"/api/v1/admin/vendors/{vendor_user.id}/suspend",
        headers=admin_auth_headers,
    )
    assert res_sus.status_code == status.HTTP_200_OK
    assert res_sus.json()["is_active"] is False

    # Student cannot view suspended vendor's menu
    res_menu = client.get(f"/api/v1/student/vendors/{vendor_user.id}/menu")
    assert res_menu.status_code == status.HTTP_404_NOT_FOUND

    # Reactivate vendor
    res_react = client.patch(
        f"/api/v1/admin/vendors/{vendor_user.id}/reactivate",
        headers=admin_auth_headers,
    )
    assert res_react.status_code == status.HTTP_200_OK
    assert res_react.json()["is_active"] is True

    # Reactivated vendor's menu is accessible if open
    vendor_user.is_shop_open = True
    db.commit()
    res_menu_after = client.get(f"/api/v1/student/vendors/{vendor_user.id}/menu")
    assert res_menu_after.status_code == status.HTTP_200_OK


def test_admin_orders_and_analytics(
    client, db, admin_auth_headers, student_user, vendor_user, menu_item
):
    # Create test orders
    order1 = Order(
        student_id=student_user.id,
        vendor_id=vendor_user.id,
        status=OrderStatus.picked_up,
        total_amount=150.0,
        pickup_token="999888",
    )
    db.add(order1)
    db.flush()
    item1 = OrderItem(
        order_id=order1.id,
        menu_item_id=menu_item.id,
        item_name=menu_item.name,
        quantity=3,
        price_at_order=50.0,
    )
    db.add(item1)

    order2 = Order(
        student_id=student_user.id,
        vendor_id=vendor_user.id,
        status=OrderStatus.placed,
        total_amount=50.0,
        pickup_token="999889",
    )
    db.add(order2)
    db.flush()
    item2 = OrderItem(
        order_id=order2.id,
        menu_item_id=menu_item.id,
        item_name=menu_item.name,
        quantity=1,
        price_at_order=50.0,
    )
    db.add(item2)
    db.commit()

    # Query admin orders
    res_orders = client.get("/api/v1/admin/orders", headers=admin_auth_headers)
    assert res_orders.status_code == status.HTTP_200_OK
    orders = res_orders.json()
    assert len(orders) >= 2

    # Query analytics summary
    res_analytics = client.get("/api/v1/admin/analytics/summary", headers=admin_auth_headers)
    assert res_analytics.status_code == status.HTTP_200_OK
    summary = res_analytics.json()
    assert summary["total_orders"] >= 2
    assert summary["total_revenue"] >= 200.0
    assert summary["active_vendors_count"] >= 1
    assert summary["active_students_count"] >= 1
    assert "peak_hours" in summary


def test_announcements_lifecycle(client, db, admin_auth_headers):
    # Admin creates announcement
    payload = {
        "title": "Canteen Maintenance Notice",
        "message": "Block A canteen will close 30 minutes early today.",
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
    }
    res_create = client.post(
        "/api/v1/admin/announcements",
        headers=admin_auth_headers,
        json=payload,
    )
    assert res_create.status_code == status.HTTP_201_CREATED
    announcement_id = res_create.json()["id"]

    # Public / student fetch
    res_public = client.get("/api/v1/announcements")
    assert res_public.status_code == status.HTTP_200_OK
    public_announcements = res_public.json()
    assert any(a["id"] == announcement_id for a in public_announcements)

    # Admin delete
    res_del = client.delete(
        f"/api/v1/admin/announcements/{announcement_id}",
        headers=admin_auth_headers,
    )
    assert res_del.status_code == status.HTTP_204_NO_CONTENT

    # Verify gone from public list
    res_public2 = client.get("/api/v1/announcements")
    assert not any(a["id"] == announcement_id for a in res_public2.json())
