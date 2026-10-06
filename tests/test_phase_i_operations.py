from fastapi.testclient import TestClient
from app.models.user import User
from app.models.menu_item import MenuItem


def test_flash_discount_and_hourly_analytics(
    client: TestClient,
    vendor_user: User,
    student_user: User,
    menu_item: MenuItem,
    vendor_auth_headers: dict,
    student_auth_headers: dict,
):
    # 1. Enable 20% flash discount on menu_item
    resp = client.patch(
        f"/api/v1/vendor/menu/{menu_item.id}/flash-discount",
        json={"is_flash_discount": True, "flash_discount_percent": 20},
        headers=vendor_auth_headers,
    )
    assert resp.status_code == 200, resp.text
    updated = resp.json()
    assert updated["is_flash_discount"] is True
    assert updated["flash_discount_percent"] == 20
    assert updated["effective_price"] == 40.0 # 50 - 20% = 40

    # 2. Student places order with this discounted item
    order_data = {
        "vendor_id": vendor_user.id,
        "items": [{"menu_item_id": menu_item.id, "quantity": 2}], # 2 * 40 = 80
        "payment_method": "pay_at_counter",
        "reusable_container": False,
        "cutlery_needed": True,
    }
    order_resp = client.post("/api/v1/student/orders", json=order_data, headers=student_auth_headers)
    assert order_resp.status_code == 201, order_resp.text
    order = order_resp.json()
    assert order["total_amount"] == 80.0
    assert order["items"][0]["price_at_order"] == 40.0

    # 3. Vendor queries demand by hour analytics
    analytics_resp = client.get("/api/v1/vendor/analytics/demand-by-hour", headers=vendor_auth_headers)
    assert analytics_resp.status_code == 200, analytics_resp.text
    hours = analytics_resp.json()
    assert len(hours) == 24
    total_orders_in_hours = sum(h["order_count"] for h in hours)
    assert total_orders_in_hours >= 1
