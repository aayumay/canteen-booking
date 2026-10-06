from fastapi.testclient import TestClient
from app.models.user import User


def test_order_sustainability_discount_and_stats(
    client: TestClient,
    student_user: User,
    vendor_user: User,
    menu_item,
    student_auth_headers: dict,
):
    # 1. Place an order with reusable_container=True and cutlery_needed=False
    order_data = {
        "vendor_id": vendor_user.id,
        "items": [{"menu_item_id": menu_item.id, "quantity": 2}], # 2 * 50 = 100
        "payment_method": "pay_at_counter",
        "cutlery_needed": False,
        "reusable_container": True,
    }
    resp = client.post("/api/v1/student/orders", json=order_data, headers=student_auth_headers)
    assert resp.status_code == 201, resp.text
    created = resp.json()
    assert created["cutlery_needed"] is False
    assert created["reusable_container"] is True
    assert created["container_discount"] == 5.0
    assert created["total_amount"] == 95.0 # 100 - 5

    # 2. Check sustainability stats
    stats_resp = client.get("/api/v1/student/sustainability-stats", headers=student_auth_headers)
    assert stats_resp.status_code == 200, stats_resp.text
    stats = stats_resp.json()
    assert stats["total_orders"] >= 1
    assert stats["cutlery_saved_count"] >= 1
    assert stats["containers_reused_count"] >= 1
    assert stats["total_eco_saved_amount"] >= 5.0
    assert stats["plastic_saved_grams"] >= 70.0 # 20 + 50
