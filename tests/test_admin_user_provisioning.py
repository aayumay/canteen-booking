"""
Admin-driven account provisioning.

The provisioning endpoints previously required ADMIN_API_KEY only, which meant
the admin dashboard could not create an account: the browser holds an admin JWT
and cannot be handed the shared key. These cover the second accepted
credential (an authenticated admin session) and the new student endpoint.
"""

import pytest
from fastapi import status

from app.models.user import User, UserRole

STUDENT_PHONE = "+919877000001"
VENDOR_PHONE = "+919877000002"
ADMIN_PHONE = "+919877000003"


# ---------------------------------------------------------------------------
# Bootstrap key must keep working
# ---------------------------------------------------------------------------


def test_admin_key_still_provisions_student(client, db, admin_headers):
    response = client.post(
        "/api/v1/admin/students",
        headers=admin_headers,
        json={"phone_number": STUDENT_PHONE, "name": "Key Student"},
    )
    assert response.status_code == status.HTTP_201_CREATED

    user = db.query(User).filter(User.phone_number == STUDENT_PHONE).first()
    assert user is not None
    assert user.role == UserRole.student


def test_admin_key_still_provisions_admin(client, db, admin_headers):
    response = client.post(
        "/api/v1/admin/users",
        headers=admin_headers,
        json={"phone_number": ADMIN_PHONE, "name": "Key Admin"},
    )
    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["role"] == "admin"


# ---------------------------------------------------------------------------
# Authenticated admin session
# ---------------------------------------------------------------------------


def test_admin_session_provisions_student(client, db, admin_auth_headers):
    response = client.post(
        "/api/v1/admin/students",
        headers=admin_auth_headers,
        json={"phone_number": STUDENT_PHONE, "name": "Session Student"},
    )
    assert response.status_code == status.HTTP_201_CREATED

    data = response.json()
    assert data["phone_number"] == STUDENT_PHONE
    assert data["name"] == "Session Student"
    assert data["role"] == "student"

    user = db.query(User).filter(User.phone_number == STUDENT_PHONE).first()
    assert user is not None
    assert user.role == UserRole.student
    # A provisioned student must be able to log in straight away, so the
    # account has to start active.
    assert user.is_active is True


def test_admin_session_provisions_vendor(client, db, admin_auth_headers):
    response = client.post(
        "/api/v1/admin/vendors",
        headers=admin_auth_headers,
        json={
            "phone_number": VENDOR_PHONE,
            "name": "Session Vendor",
            "shop_name": "Session Cafe",
        },
    )
    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["shop_name"] == "Session Cafe"

    user = db.query(User).filter(User.phone_number == VENDOR_PHONE).first()
    assert user.role == UserRole.vendor


def test_admin_session_provisions_admin(client, db, admin_auth_headers):
    response = client.post(
        "/api/v1/admin/users",
        headers=admin_auth_headers,
        json={"phone_number": ADMIN_PHONE, "name": "Session Admin"},
    )
    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["role"] == "admin"

    user = db.query(User).filter(User.phone_number == ADMIN_PHONE).first()
    assert user.role == UserRole.admin


# ---------------------------------------------------------------------------
# Rejection
# ---------------------------------------------------------------------------


def test_provision_student_unauthenticated(client, db):
    response = client.post(
        "/api/v1/admin/students",
        json={"phone_number": STUDENT_PHONE, "name": "Anonymous"},
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert db.query(User).filter(User.phone_number == STUDENT_PHONE).first() is None


def test_provision_student_wrong_key(client, db):
    response = client.post(
        "/api/v1/admin/students",
        headers={"X-Admin-Key": "wrong-secret"},
        json={"phone_number": STUDENT_PHONE, "name": "Wrong Key"},
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert db.query(User).filter(User.phone_number == STUDENT_PHONE).first() is None


def test_student_session_cannot_provision(client, db, student_auth_headers):
    response = client.post(
        "/api/v1/admin/students",
        headers=student_auth_headers,
        json={"phone_number": STUDENT_PHONE, "name": "Self Promoted"},
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert db.query(User).filter(User.phone_number == STUDENT_PHONE).first() is None


def test_vendor_session_cannot_provision(client, db, vendor_auth_headers):
    response = client.post(
        "/api/v1/admin/vendors",
        headers=vendor_auth_headers,
        json={
            "phone_number": VENDOR_PHONE,
            "name": "Rogue Vendor",
            "shop_name": "Rogue Stall",
        },
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_provision_student_duplicate_phone(client, db, admin_auth_headers, student_user):
    response = client.post(
        "/api/v1/admin/students",
        headers=admin_auth_headers,
        json={"phone_number": student_user.phone_number, "name": "Duplicate"},
    )
    assert response.status_code == status.HTTP_409_CONFLICT


def test_provision_student_rejects_short_phone(client, admin_auth_headers):
    response = client.post(
        "/api/v1/admin/students",
        headers=admin_auth_headers,
        json={"phone_number": "123", "name": "Too Short"},
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_provision_student_rejects_blank_name(client, admin_auth_headers):
    response = client.post(
        "/api/v1/admin/students",
        headers=admin_auth_headers,
        json={"phone_number": STUDENT_PHONE, "name": ""},
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY