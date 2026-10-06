import pytest
from fastapi import status

from app.models.order import Order, OrderStatus
from app.models.wallet_transaction import WalletTransaction, WalletTransactionType


def test_admin_wallet_adjust_and_student_wallet_query(
    client, db, admin_auth_headers, student_user, student_auth_headers
):
    # Initial balance is 0.00
    res_initial = client.get("/api/v1/student/wallet", headers=student_auth_headers)
    assert res_initial.status_code == status.HTTP_200_OK
    data = res_initial.json()
    assert data["balance"] == 0.0
    assert data["is_low_balance"] is True
    assert len(data["transactions"]) == 0

    # Admin credits ₹500 via admin adjustment
    adjust_payload = {
        "student_id": student_user.id,
        "amount": 500.0,
        "reason": "Cash deposit at accounts office",
    }
    res_adjust = client.post(
        "/api/v1/admin/wallet/adjust",
        headers=admin_auth_headers,
        json=adjust_payload,
    )
    assert res_adjust.status_code == status.HTTP_200_OK
    assert res_adjust.json()["balance_after"] == 500.0
    assert res_adjust.json()["type"] == "admin_adjustment"

    # Student checks wallet after topup
    res_after = client.get("/api/v1/student/wallet", headers=student_auth_headers)
    assert res_after.status_code == status.HTTP_200_OK
    data_after = res_after.json()
    assert data_after["balance"] == 500.0
    assert data_after["is_low_balance"] is False
    assert len(data_after["transactions"]) == 1
    assert data_after["transactions"][0]["amount"] == 500.0


def test_update_low_balance_threshold(client, student_auth_headers):
    res = client.patch(
        "/api/v1/student/wallet/threshold",
        headers=student_auth_headers,
        json={"low_balance_threshold": 100.0},
    )
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["low_balance_threshold"] == 100.0


def test_order_placement_insufficient_wallet_balance(
    client, student_auth_headers, vendor_user, menu_item
):
    # Student has 0 balance, tries to place order with wallet
    payload = {
        "vendor_id": vendor_user.id,
        "payment_method": "wallet",
        "items": [{"menu_item_id": menu_item.id, "quantity": 2}],
    }
    res = client.post("/api/v1/student/orders", headers=student_auth_headers, json=payload)
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert "insufficient wallet balance" in res.json()["detail"].lower()


def test_order_placement_and_cancellation_refund_flow(
    client, db, admin_auth_headers, student_user, student_auth_headers, vendor_user, menu_item
):
    # Admin credits ₹200 to student wallet
    client.post(
        "/api/v1/admin/wallet/adjust",
        headers=admin_auth_headers,
        json={
            "student_id": student_user.id,
            "amount": 200.0,
            "reason": "Topup for lunch",
        },
    )

    # Place order for 2 items @ 50.00 = 100.00
    order_payload = {
        "vendor_id": vendor_user.id,
        "payment_method": "wallet",
        "items": [{"menu_item_id": menu_item.id, "quantity": 2}],
    }
    res_order = client.post(
        "/api/v1/student/orders",
        headers=student_auth_headers,
        json=order_payload,
    )
    assert res_order.status_code == status.HTTP_201_CREATED
    order_data = res_order.json()
    assert order_data["total_amount"] == 100.0
    assert order_data["payment_method"] == "wallet"
    order_id = order_data["id"]

    # Verify wallet was debited
    res_wallet = client.get("/api/v1/student/wallet", headers=student_auth_headers)
    assert res_wallet.json()["balance"] == 100.0
    transactions = res_wallet.json()["transactions"]
    payment_tx = next((t for t in transactions if t["type"] == "order_payment"), None)
    assert payment_tx is not None
    assert payment_tx["amount"] == -100.0
    assert payment_tx["related_order_id"] == order_id

    # Cancel order -> triggers auto refund
    res_cancel = client.patch(
        f"/api/v1/student/orders/{order_id}/cancel",
        headers=student_auth_headers,
    )
    assert res_cancel.status_code == status.HTTP_200_OK
    assert res_cancel.json()["status"] == "cancelled"

    # Verify balance was restored to 200.00 and refund transaction logged
    res_wallet_after = client.get("/api/v1/student/wallet", headers=student_auth_headers)
    assert res_wallet_after.json()["balance"] == 200.0
    txs_after = res_wallet_after.json()["transactions"]
    refund_tx = next((t for t in txs_after if t["type"] == "refund"), None)
    assert refund_tx is not None
    assert refund_tx["amount"] == 100.0
    assert refund_tx["related_order_id"] == order_id
