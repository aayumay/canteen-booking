import pytest
from fastapi import status
from sqlalchemy.orm import Session

from app.models.wallet_transaction import WalletTransactionType
from app.services.wallet_service import adjust_wallet_balance


def test_meal_plan_lifecycle_and_order_redemption(
    client, db: Session, vendor_user, vendor_auth_headers, student_user, student_auth_headers, menu_item
):
    # 1. Vendor creates a meal plan
    plan_res = client.post(
        "/api/v1/vendor/meal-plans",
        headers=vendor_auth_headers,
        json={
            "name": "10-Thali Lunch Pack",
            "description": "Save on daily lunch thalis",
            "price": 500.0,
            "total_meals": 10,
            "validity_days": 30,
        },
    )
    assert plan_res.status_code == status.HTTP_201_CREATED
    plan_id = plan_res.json()["id"]
    assert plan_res.json()["total_meals"] == 10

    # 2. Student browses meal plans
    list_res = client.get("/api/v1/student/meal-plans", headers=student_auth_headers)
    assert list_res.status_code == status.HTTP_200_OK
    assert any(p["id"] == plan_id for p in list_res.json())

    # 3. Student tries to subscribe without funds -> 400
    sub_fail = client.post(f"/api/v1/student/meal-plans/{plan_id}/subscribe", headers=student_auth_headers)
    assert sub_fail.status_code == status.HTTP_400_BAD_REQUEST
    assert "Insufficient wallet balance" in sub_fail.json()["detail"]

    # 4. Top up student wallet with 600
    adjust_wallet_balance(
        db,
        student_id=student_user.id,
        amount=600.0,
        tx_type=WalletTransactionType.topup,
        reason="Test Topup",
    )

    # 5. Student subscribes successfully
    sub_res = client.post(f"/api/v1/student/meal-plans/{plan_id}/subscribe", headers=student_auth_headers)
    assert sub_res.status_code == status.HTTP_201_CREATED
    assert sub_res.json()["meals_remaining"] == 10

    # Verify wallet was debited: 600 - 500 = 100
    w_res = client.get("/api/v1/student/wallet", headers=student_auth_headers)
    assert w_res.json()["balance"] == 100.0

    # 6. Student places order using meal_plan payment method
    order_res = client.post(
        "/api/v1/student/orders",
        headers=student_auth_headers,
        json={
            "vendor_id": vendor_user.id,
            "payment_method": "meal_plan",
            "items": [{"menu_item_id": menu_item.id, "quantity": 1}],
        },
    )
    assert order_res.status_code == status.HTTP_201_CREATED
    order_id = order_res.json()["id"]

    # Verify meal remaining dropped from 10 to 9
    my_plans = client.get("/api/v1/student/my-meal-plans", headers=student_auth_headers).json()
    assert len(my_plans) >= 1
    assert my_plans[0]["meals_remaining"] == 9

    # 7. Student cancels order -> meal refunded from 9 back to 10
    cancel_res = client.patch(f"/api/v1/student/orders/{order_id}/cancel", headers=student_auth_headers)
    assert cancel_res.status_code == status.HTTP_200_OK

    my_plans_after_cancel = client.get("/api/v1/student/my-meal-plans", headers=student_auth_headers).json()
    assert my_plans_after_cancel[0]["meals_remaining"] == 10
