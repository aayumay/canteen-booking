from unittest.mock import patch
from fastapi import status
from app.core.security import create_access_token
from app.models.user import User, UserRole


def test_vendor_self_registration_creates_unapproved_vendor(client, db):
    phone = "+919888877771"
    with patch("app.services.otp_service._send_sms", return_value=None):
        res = client.post(
            "/api/v1/auth/register-vendor",
            json={
                "phone_number": phone,
                "name": "Ramesh Kumar",
                "shop_name": "Ramesh Dosa Corner",
                "stall_photo_url": "https://example.com/ramesh_dosa.jpg",
            },
        )
        assert res.status_code == status.HTTP_201_CREATED
        data = res.json()
        assert data["phone_number"] == phone
        assert data["name"] == "Ramesh Kumar"
        assert data["shop_name"] == "Ramesh Dosa Corner"
        assert data["is_approved"] is False
        assert data["stall_photo_url"] == "https://example.com/ramesh_dosa.jpg"

    # Duplicate phone rejection
    res2 = client.post(
        "/api/v1/auth/register-vendor",
        json={
            "phone_number": phone,
            "name": "Another Guy",
            "shop_name": "Another Shop",
        },
    )
    assert res2.status_code == status.HTTP_409_CONFLICT


def test_unapproved_vendor_login_and_student_visibility_gating(client, db, admin_user, student_user):
    phone = "+919888877772"
    with patch("app.services.otp_service._send_sms", return_value=None):
        reg_res = client.post(
            "/api/v1/auth/register-vendor",
            json={
                "phone_number": phone,
                "name": "Suresh Uncle",
                "shop_name": "Suresh Chaat",
                "stall_photo_url": "https://example.com/chaat.jpg",
            },
        )
        assert reg_res.status_code == status.HTTP_201_CREATED
        vendor_id = reg_res.json()["id"]

    # Vendor can verify OTP and login
    otp_res = client.post(
        "/api/v1/auth/verify-otp",
        json={"phone_number": phone, "otp_code": "123456"},
    )
    assert otp_res.status_code == status.HTTP_200_OK
    vendor_token = otp_res.json()["access_token"]
    vendor_headers = {"Authorization": f"Bearer {vendor_token}"}

    # Check vendor profile me
    me_res = client.get("/api/v1/auth/me", headers=vendor_headers)
    assert me_res.status_code == status.HTTP_200_OK
    assert me_res.json()["is_approved"] is False

    # Vendor toggles shop open
    toggle_res = client.patch("/api/v1/vendor/shop/toggle", headers=vendor_headers)
    assert toggle_res.status_code == status.HTTP_200_OK
    assert toggle_res.json()["is_shop_open"] is True

    # Student checks open vendors -> Suresh Chaat should NOT be visible because is_approved is False
    student_token = create_access_token(data={"sub": str(student_user.id), "role": student_user.role.value})
    student_headers = {"Authorization": f"Bearer {student_token}"}

    vendors_res = client.get("/api/v1/student/vendors", headers=student_headers)
    assert vendors_res.status_code == status.HTTP_200_OK
    vendor_ids = [v["id"] for v in vendors_res.json()]
    assert vendor_id not in vendor_ids

    # Student tries to view menu of unapproved vendor -> 404
    menu_res = client.get(f"/api/v1/student/vendors/{vendor_id}/menu", headers=student_headers)
    assert menu_res.status_code == status.HTTP_404_NOT_FOUND

    # Admin lists pending vendors
    admin_token = create_access_token(data={"sub": str(admin_user.id), "role": admin_user.role.value})
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    pending_res = client.get("/api/v1/admin/vendors/pending", headers=admin_headers)
    assert pending_res.status_code == status.HTTP_200_OK
    pending_ids = [v["id"] for v in pending_res.json()]
    assert vendor_id in pending_ids

    # Admin approves vendor
    approve_res = client.patch(f"/api/v1/admin/vendors/{vendor_id}/approve", headers=admin_headers)
    assert approve_res.status_code == status.HTTP_200_OK
    assert approve_res.json()["is_approved"] is True

    # Student checks open vendors again -> Suresh Chaat IS now visible!
    vendors_res2 = client.get("/api/v1/student/vendors", headers=student_headers)
    assert vendors_res2.status_code == status.HTTP_200_OK
    approved_vendor = next((v for v in vendors_res2.json() if v["id"] == vendor_id), None)
    assert approved_vendor is not None
    assert approved_vendor["shop_name"] == "Suresh Chaat"
    assert approved_vendor["stall_photo_url"] == "https://example.com/chaat.jpg"
    assert approved_vendor["is_approved"] is True


def test_vendor_update_profile(client, db, vendor_user):
    vendor_token = create_access_token(data={"sub": str(vendor_user.id), "role": vendor_user.role.value})
    headers = {"Authorization": f"Bearer {vendor_token}"}

    update_res = client.patch(
        "/api/v1/vendor/profile",
        json={
            "name": "Updated Vendor Name",
            "shop_name": "Brand New Shop Name",
            "stall_photo_url": "https://example.com/new_photo.png",
        },
        headers=headers,
    )
    assert update_res.status_code == status.HTTP_200_OK
    data = update_res.json()
    assert data["name"] == "Updated Vendor Name"
    assert data["shop_name"] == "Brand New Shop Name"
    assert data["stall_photo_url"] == "https://example.com/new_photo.png"
