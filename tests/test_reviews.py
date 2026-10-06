import pytest
from fastapi import status
from app.models.order import Order, OrderStatus
from app.models.user import User, UserRole


def _create_picked_up_order(db, student: User, vendor: User) -> Order:
    order = Order(
        student_id=student.id,
        vendor_id=vendor.id,
        status=OrderStatus.picked_up,
        total_amount=100.00,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def test_submit_review_success(client, db, student_user, vendor_user, student_auth_headers):
    order = _create_picked_up_order(db, student_user, vendor_user)

    payload = {
        "rating": 5,
        "comment": "Crispy and fresh burger! Loved it.",
        "photo_url": "/uploads/test_burger.jpg",
    }
    response = client.post(
        f"/api/v1/student/orders/{order.id}/review",
        headers=student_auth_headers,
        json=payload,
    )
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["order_id"] == order.id
    assert data["vendor_id"] == vendor_user.id
    assert data["rating"] == 5
    assert data["comment"] == "Crispy and fresh burger! Loved it."
    assert data["photo_url"] == "/uploads/test_burger.jpg"
    assert data["reviewer_name"] == "Test"  # First name of "Test Student"


def test_review_non_picked_up_order_fails(client, db, student_user, vendor_user, student_auth_headers):
    order = Order(
        student_id=student_user.id,
        vendor_id=vendor_user.id,
        status=OrderStatus.preparing,
        total_amount=100.00,
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    payload = {"rating": 4, "comment": "Food is taking long"}
    response = client.post(
        f"/api/v1/student/orders/{order.id}/review",
        headers=student_auth_headers,
        json=payload,
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "completed" in response.json()["detail"].lower()


def test_review_other_student_order_fails(client, db, student_user, vendor_user):
    order = _create_picked_up_order(db, student_user, vendor_user)

    other_student = User(
        phone_number="+919876543888",
        role=UserRole.student,
        name="Other Student",
        is_active=True,
    )
    db.add(other_student)
    db.commit()
    db.refresh(other_student)

    from app.core.security import create_access_token
    token = create_access_token(data={"sub": str(other_student.id), "role": other_student.role.value})
    headers = {"Authorization": f"Bearer {token}"}

    payload = {"rating": 5, "comment": "Stealing review"}
    response = client.post(
        f"/api/v1/student/orders/{order.id}/review",
        headers=headers,
        json=payload,
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_duplicate_review_fails_409(client, db, student_user, vendor_user, student_auth_headers):
    order = _create_picked_up_order(db, student_user, vendor_user)

    payload = {"rating": 4, "comment": "First review"}
    res1 = client.post(
        f"/api/v1/student/orders/{order.id}/review",
        headers=student_auth_headers,
        json=payload,
    )
    assert res1.status_code == status.HTTP_201_CREATED

    # Second review attempt on same order -> 409
    res2 = client.post(
        f"/api/v1/student/orders/{order.id}/review",
        headers=student_auth_headers,
        json=payload,
    )
    assert res2.status_code == status.HTTP_409_CONFLICT


def test_vendor_aggregate_ratings_and_listing(
    client, db, student_user, vendor_user, student_auth_headers, vendor_auth_headers
):
    # Before reviews: average_rating is None, review_count is 0
    res_before = client.get("/api/v1/student/vendors")
    assert res_before.status_code == status.HTTP_200_OK
    v_data = next(v for v in res_before.json() if v["id"] == vendor_user.id)
    assert v_data["average_rating"] is None
    assert v_data["review_count"] == 0

    # Order 1 reviewed with 5 stars
    order1 = _create_picked_up_order(db, student_user, vendor_user)
    client.post(
        f"/api/v1/student/orders/{order1.id}/review",
        headers=student_auth_headers,
        json={"rating": 5, "comment": "Excellent"},
    )

    # Order 2 reviewed with 4 stars
    order2 = _create_picked_up_order(db, student_user, vendor_user)
    client.post(
        f"/api/v1/student/orders/{order2.id}/review",
        headers=student_auth_headers,
        json={"rating": 4, "comment": "Good"},
    )

    # After reviews: average is (5+4)/2 = 4.5, count is 2
    res_after = client.get("/api/v1/student/vendors")
    v_after = next(v for v in res_after.json() if v["id"] == vendor_user.id)
    assert v_after["average_rating"] == 4.5
    assert v_after["review_count"] == 2

    # Fetch public vendor reviews list
    reviews_res = client.get(
        f"/api/v1/student/vendors/{vendor_user.id}/reviews",
        headers=student_auth_headers,
    )
    assert reviews_res.status_code == status.HTTP_200_OK
    r_data = reviews_res.json()
    assert r_data["total"] == 2
    assert r_data["average_rating"] == 4.5
    assert r_data["review_count"] == 2
    assert len(r_data["items"]) == 2

    # Vendor fetches own reviews
    vendor_reviews_res = client.get(
        "/api/v1/vendor/reviews",
        headers=vendor_auth_headers,
    )
    assert vendor_reviews_res.status_code == status.HTTP_200_OK
    assert vendor_reviews_res.json()["total"] == 2
