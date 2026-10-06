import pytest
from fastapi import status
from app.models.menu_item import MenuItem
from app.models.order import Order, OrderStatus
from app.models.user import User, UserRole


def test_cross_vendor_menu_item_isolation(client, db, vendor_user, vendor_user_2, vendor_2_auth_headers):
    # Create menu item belonging to vendor 1
    item_v1 = MenuItem(
        vendor_id=vendor_user.id,
        name="Vendor 1 Burger",
        price=60.00,
        is_available=True,
    )
    db.add(item_v1)
    db.commit()
    db.refresh(item_v1)

    # Vendor 2 attempts to edit Vendor 1's menu item -> 404
    res_edit = client.patch(
        f"/api/v1/vendor/menu/{item_v1.id}",
        headers=vendor_2_auth_headers,
        json={"name": "Hacked Burger"},
    )
    assert res_edit.status_code == status.HTTP_404_NOT_FOUND

    # Vendor 2 attempts to delete Vendor 1's menu item -> 404
    res_del = client.delete(
        f"/api/v1/vendor/menu/{item_v1.id}",
        headers=vendor_2_auth_headers,
    )
    assert res_del.status_code == status.HTTP_404_NOT_FOUND


def test_cross_vendor_order_isolation(client, db, student_user, vendor_user, vendor_user_2, vendor_2_auth_headers):
    # Create order belonging to vendor 1
    order_v1 = Order(
        student_id=student_user.id,
        vendor_id=vendor_user.id,
        status=OrderStatus.placed,
        total_amount=120.00,
    )
    db.add(order_v1)
    db.commit()
    db.refresh(order_v1)

    # Vendor 2 attempts to fetch Vendor 1's incoming order -> 404
    res_get = client.get(
        f"/api/v1/vendor/orders/{order_v1.id}",
        headers=vendor_2_auth_headers,
    )
    assert res_get.status_code == status.HTTP_404_NOT_FOUND

    # Vendor 2 attempts to update status of Vendor 1's order -> 403 or 404
    res_status = client.patch(
        f"/api/v1/vendor/orders/{order_v1.id}/status",
        headers=vendor_2_auth_headers,
        json={"status": "accepted"},
    )
    assert res_status.status_code in [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND]


def test_cross_student_order_isolation(client, db, student_user, vendor_user):
    # Student 2
    student_2 = User(
        phone_number="+919876543299",
        role=UserRole.student,
        name="Student Two",
        is_active=True,
    )
    db.add(student_2)
    db.commit()
    db.refresh(student_2)

    # Order belonging to student 1
    order_s1 = Order(
        student_id=student_user.id,
        vendor_id=vendor_user.id,
        status=OrderStatus.placed,
        total_amount=50.00,
    )
    db.add(order_s1)
    db.commit()
    db.refresh(order_s1)

    from app.core.security import create_access_token
    s2_token = create_access_token(data={"sub": str(student_2.id), "role": student_2.role.value})
    s2_headers = {"Authorization": f"Bearer {s2_token}"}

    # Student 2 attempts to get Student 1's order -> 404
    res_get = client.get(
        f"/api/v1/student/orders/{order_s1.id}",
        headers=s2_headers,
    )
    assert res_get.status_code == status.HTTP_404_NOT_FOUND
