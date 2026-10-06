from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from fastapi import status
from app.core.security import create_access_token, create_refresh_token, hash_otp
from app.models.otp_attempt import OtpAttempt
from app.models.user import User, UserRole


def test_request_otp_success(client, db):
    with patch("app.services.otp_service._send_sms", return_value=None):
        response = client.post(
            "/api/v1/auth/request-otp",
            json={"phone_number": "+919999999991", "role": "student"},
        )
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert response.json()["detail"] == "OTP sent."


def test_request_otp_rate_limiting(client, db):
    phone = "+919999999992"
    with patch("app.services.otp_service._send_sms", return_value=None):
        # Fire 3 requests (max limit)
        for _ in range(3):
            res = client.post(
                "/api/v1/auth/request-otp",
                json={"phone_number": phone, "role": "student"},
            )
            assert res.status_code == status.HTTP_202_ACCEPTED

        # 4th request within window should return 429
        res4 = client.post(
            "/api/v1/auth/request-otp",
            json={"phone_number": phone, "role": "student"},
        )
        assert res4.status_code == status.HTTP_429_TOO_MANY_REQUESTS


def test_verify_otp_student_creation_on_first_login(client, db):
    phone = "+919999999993"
    raw_otp = "123456"
    otp_record = OtpAttempt(
        phone_number=phone,
        hashed_otp=hash_otp(raw_otp),
        attempts=0,
        is_used=False,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
    )
    db.add(otp_record)
    db.commit()

    response = client.post(
        "/api/v1/auth/verify-otp",
        json={"phone_number": phone, "otp_code": raw_otp, "name": "New Student"},
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"

    # Verify user exists in DB
    user = db.query(User).filter(User.phone_number == phone).first()
    assert user is not None
    assert user.role == UserRole.student
    assert user.name == "New Student"


def test_verify_otp_wrong_otp_increment_and_lockout(client, db):
    phone = "+919999999994"
    raw_otp = "888888"
    otp_record = OtpAttempt(
        phone_number=phone,
        hashed_otp=hash_otp(raw_otp),
        attempts=0,
        is_used=False,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
    )
    db.add(otp_record)
    db.commit()

    # Attempt 1 wrong
    res1 = client.post("/api/v1/auth/verify-otp", json={"phone_number": phone, "otp_code": "000000"})
    assert res1.status_code == status.HTTP_400_BAD_REQUEST

    # Attempt 2 wrong
    res2 = client.post("/api/v1/auth/verify-otp", json={"phone_number": phone, "otp_code": "000000"})
    assert res2.status_code == status.HTTP_400_BAD_REQUEST

    # Attempt 3 wrong -> locked out
    res3 = client.post("/api/v1/auth/verify-otp", json={"phone_number": phone, "otp_code": "000000"})
    assert res3.status_code == status.HTTP_400_BAD_REQUEST

    # Attempt 4 with correct OTP should now fail due to max attempts exceeded
    res4 = client.post("/api/v1/auth/verify-otp", json={"phone_number": phone, "otp_code": raw_otp})
    assert res4.status_code == status.HTTP_400_BAD_REQUEST
    assert "failed attempts" in res4.json()["detail"].lower() or "attempts" in res4.json()["detail"].lower()


def test_refresh_token_rotation_success(client, db, student_user):
    refresh_token = create_refresh_token(data={"sub": str(student_user.id), "role": student_user.role.value})

    response = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["refresh_token"] != refresh_token


def test_refresh_token_rejects_access_token(client, db, student_user):
    access_token = create_access_token(data={"sub": str(student_user.id), "role": student_user.role.value})

    response = client.post("/api/v1/auth/refresh", json={"refresh_token": access_token})
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert "invalid token type" in response.json()["detail"].lower()


def test_refresh_token_rejects_invalid_token(client, db):
    response = client.post("/api/v1/auth/refresh", json={"refresh_token": "invalid.fake.jwt"})
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
