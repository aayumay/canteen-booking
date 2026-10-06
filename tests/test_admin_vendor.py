import pytest
from fastapi import status
from app.models.user import User, UserRole


def test_admin_provision_vendor_success(client, db, admin_headers):
    payload = {
        "phone_number": "+919876500001",
        "name": "Admin Created Vendor",
        "shop_name": "Campus Pizza",
    }
    response = client.post("/api/v1/admin/vendors", headers=admin_headers, json=payload)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["phone_number"] == "+919876500001"
    assert data["shop_name"] == "Campus Pizza"

    # Verify user in database
    user = db.query(User).filter(User.phone_number == "+919876500001").first()
    assert user is not None
    assert user.role == UserRole.vendor


def test_admin_provision_vendor_missing_key(client, db):
    payload = {
        "phone_number": "+919876500002",
        "name": "Vendor No Key",
        "shop_name": "No Key Cafe",
    }
    response = client.post("/api/v1/admin/vendors", json=payload)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_admin_provision_vendor_wrong_key(client, db):
    payload = {
        "phone_number": "+919876500003",
        "name": "Vendor Wrong Key",
        "shop_name": "Wrong Key Cafe",
    }
    response = client.post("/api/v1/admin/vendors", headers={"X-Admin-Key": "wrong-secret"}, json=payload)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_admin_provision_vendor_duplicate_phone(client, db, admin_headers, vendor_user):
    payload = {
        "phone_number": vendor_user.phone_number,
        "name": "Duplicate Vendor",
        "shop_name": "Duplicate Cafe",
    }
    response = client.post("/api/v1/admin/vendors", headers=admin_headers, json=payload)
    assert response.status_code == status.HTTP_409_CONFLICT
