"""
Vendor QR / manual pickup verification.

Covers the handover contract end to end: ownership, exact code match, the
ready-status precondition with specific messages, idempotency, and the fact
that picking up never touches money.
"""
from decimal import Decimal

import pytest
from sqlalchemy.orm import Session

from app.models.order import Order, OrderStatus
from app.models.order_item import OrderItem
from app.models.user import User
from app.models.wallet_transaction import WalletTransaction

VERIFY_URL = "/api/v1/vendor/orders/verify-pickup"
READY_URL = "/api/v1/vendor/orders/ready"


def _make_order(
    db: Session,
    student: User,
    vendor: User,
    status: OrderStatus = OrderStatus.ready,
    token: str = "123456",
) -> Order:
    order = Order(
        student_id=student.id,
        vendor_id=vendor.id,
        status=status,
        total_amount=Decimal("150.00"),
        payment_method="pay_at_counter",
        pickup_token=token,
    )
    db.add(order)
    db.flush()
    db.add(
        OrderItem(
            order_id=order.id,
            menu_item_id=1,
            item_name="Veg Burger",
            price_at_order=Decimal("150.00"),
            quantity=1,
        )
    )
    db.commit()
    db.refresh(order)
    return order


def test_verify_pickup_transitions_ready_order(
    client, db, vendor_user, student_user, vendor_auth_headers
):
    order = _make_order(db, student_user, vendor_user)

    res = client.post(
        VERIFY_URL,
        json={"order_id": order.id, "pickup_token": order.pickup_token},
        headers=vendor_auth_headers,
    )

    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "picked_up"
    assert body["picked_up_confirmed_by"] == vendor_user.id
    assert body["picked_up_at"] is not None

    db.expire_all()
    assert db.get(Order, order.id).status == OrderStatus.picked_up


def test_verify_pickup_accepts_bare_token(client, db, vendor_user, student_user, vendor_auth_headers):
    order = _make_order(db, student_user, vendor_user, token="654321")

    res = client.post(VERIFY_URL, json={"pickup_token": "654321"}, headers=vendor_auth_headers)

    assert res.status_code == 200
    assert res.json()["id"] == order.id
    assert res.json()["status"] == "picked_up"


def test_verify_pickup_rejects_other_vendors_order(
    client, db, vendor_user_2, student_user, vendor_auth_headers
):
    """Vendor 1 must not be able to close out vendor 2's order."""
    order = _make_order(db, student_user, vendor_user_2, token="777777")

    res = client.post(
        VERIFY_URL,
        json={"order_id": order.id, "pickup_token": "777777"},
        headers=vendor_auth_headers,
    )

    assert res.status_code == 404
    # Must not confirm the order exists elsewhere.
    assert "not found" in res.json()["detail"].lower()

    db.expire_all()
    assert db.get(Order, order.id).status == OrderStatus.ready


def test_verify_pickup_rejects_wrong_token(
    client, db, vendor_user, student_user, vendor_auth_headers
):
    order = _make_order(db, student_user, vendor_user, token="111111")

    res = client.post(
        VERIFY_URL,
        json={"order_id": order.id, "pickup_token": "222222"},
        headers=vendor_auth_headers,
    )

    assert res.status_code == 400
    assert "match" in res.json()["detail"].lower()

    db.expire_all()
    assert db.get(Order, order.id).status == OrderStatus.ready


@pytest.mark.parametrize(
    "order_status,expected_fragment",
    [
        (OrderStatus.placed, "not ready"),
        (OrderStatus.accepted, "not ready"),
        (OrderStatus.preparing, "prepared"),
        (OrderStatus.picked_up, "already picked up"),
        (OrderStatus.cancelled, "cancelled"),
        (OrderStatus.rejected, "rejected"),
    ],
)
def test_verify_pickup_requires_ready_status(
    client,
    db,
    vendor_user,
    student_user,
    vendor_auth_headers,
    order_status,
    expected_fragment,
):
    order = _make_order(db, student_user, vendor_user, status=order_status, token="333333")

    res = client.post(
        VERIFY_URL,
        json={"order_id": order.id, "pickup_token": "333333"},
        headers=vendor_auth_headers,
    )

    assert res.status_code == 400
    assert expected_fragment in res.json()["detail"].lower()

    db.expire_all()
    assert db.get(Order, order.id).status == order_status


def test_verify_pickup_rejects_unknown_token(client, db, vendor_user, student_user, vendor_auth_headers):
    _make_order(db, student_user, vendor_user, token="444444")

    res = client.post(VERIFY_URL, json={"pickup_token": "999999"}, headers=vendor_auth_headers)

    assert res.status_code == 404
    assert "no matching order" in res.json()["detail"].lower()


def test_verify_pickup_token_lookup_is_tenant_scoped(
    client, db, vendor_user, vendor_user_2, student_user, vendor_auth_headers, vendor_2_auth_headers
):
    """
    The bare-token path has no order_id to scope by, so it must never resolve
    another vendor's code. Both vendors legitimately hold 246810 here, which is
    only possible because uniqueness is vendor-scoped.
    """
    mine = _make_order(db, student_user, vendor_user, token="246810")
    theirs = _make_order(db, student_user, vendor_user_2, token="246810")

    # Vendor 1 scanning the shared code closes out their own order only.
    res1 = client.post(VERIFY_URL, json={"pickup_token": "246810"}, headers=vendor_auth_headers)
    assert res1.status_code == 200
    assert res1.json()["id"] == mine.id

    db.expire_all()
    assert db.get(Order, mine.id).status == OrderStatus.picked_up
    assert db.get(Order, theirs.id).status == OrderStatus.ready

    # Vendor 2 scanning the same code closes out theirs.
    res2 = client.post(VERIFY_URL, json={"pickup_token": "246810"}, headers=vendor_2_auth_headers)
    assert res2.status_code == 200
    assert res2.json()["id"] == theirs.id

    db.expire_all()
    assert db.get(Order, theirs.id).status == OrderStatus.picked_up


def test_verify_pickup_never_resolves_another_vendors_token(
    client, db, vendor_user_2, student_user, vendor_auth_headers
):
    """A code that exists only for another vendor must not confirm anything."""
    _make_order(db, student_user, vendor_user_2, token="314159")

    res = client.post(VERIFY_URL, json={"pickup_token": "314159"}, headers=vendor_auth_headers)

    assert res.status_code == 404
    assert "no matching order" in res.json()["detail"].lower()

    db.expire_all()
    assert db.query(Order).filter(Order.pickup_token == "314159").one().status == OrderStatus.ready


def test_verify_pickup_does_not_touch_money(
    client, db, vendor_user, student_user, vendor_auth_headers
):
    """Picking up must not create wallet transactions or move balances."""
    order = _make_order(db, student_user, vendor_user, token="555555")
    order.payment_method = "wallet"
    student_user.wallet_balance = Decimal("500.00")
    db.commit()

    before_balance = Decimal(str(student_user.wallet_balance))
    before_txs = db.query(WalletTransaction).count()

    res = client.post(
        VERIFY_URL,
        json={"order_id": order.id, "pickup_token": "555555"},
        headers=vendor_auth_headers,
    )
    assert res.status_code == 200

    db.expire_all()
    assert db.query(WalletTransaction).count() == before_txs
    assert Decimal(str(db.get(User, student_user.id).wallet_balance)) == before_balance


def test_verify_pickup_requires_vendor_role(
    client, db, vendor_user, student_user, student_auth_headers
):
    order = _make_order(db, student_user, vendor_user, token="888888")

    res = client.post(
        VERIFY_URL,
        json={"order_id": order.id, "pickup_token": "888888"},
        headers=student_auth_headers,
    )

    assert res.status_code == 403
    db.expire_all()
    assert db.get(Order, order.id).status == OrderStatus.ready


def test_verify_pickup_rejects_malformed_token(client, db, vendor_user, vendor_auth_headers):
    res = client.post(VERIFY_URL, json={"pickup_token": "12ab"}, headers=vendor_auth_headers)
    assert res.status_code == 422


def test_verify_pickup_requires_some_identifier(client, db, vendor_user, vendor_auth_headers):
    res = client.post(VERIFY_URL, json={}, headers=vendor_auth_headers)
    assert res.status_code == 422


def test_ready_list_only_returns_vendors_ready_orders(
    client, db, vendor_user, vendor_user_2, student_user, vendor_auth_headers
):
    mine = _make_order(db, student_user, vendor_user, token="101010")
    _make_order(db, student_user, vendor_user, status=OrderStatus.preparing, token="202020")
    _make_order(db, student_user, vendor_user_2, token="303030")

    res = client.get(READY_URL, headers=vendor_auth_headers)

    assert res.status_code == 200
    body = res.json()
    assert [o["id"] for o in body] == [mine.id]
    assert body[0]["student_name"] == student_user.name
    assert body[0]["item_summary"]


def test_ready_list_masks_pickup_token(client, db, vendor_user, student_user, vendor_auth_headers):
    order = _make_order(db, student_user, vendor_user, token="123456")

    body = client.get(READY_URL, headers=vendor_auth_headers).json()

    assert body[0]["pickup_token_last4"] == "3456"
    assert "123456" not in str(body)


def test_ready_list_selection_confirms_without_code(
    client, db, vendor_user, student_user, vendor_auth_headers
):
    """The documented fallback: pick from the list, no code entry required."""
    order = _make_order(db, student_user, vendor_user, token="456789")

    ready = client.get(READY_URL, headers=vendor_auth_headers).json()[0]
    res = client.post(VERIFY_URL, json={"order_id": ready["id"]}, headers=vendor_auth_headers)

    assert res.status_code == 200
    assert res.json()["id"] == order.id
    assert res.json()["status"] == "picked_up"


def test_pickup_token_may_repeat_across_vendors(
    db, vendor_user, vendor_user_2, student_user
):
    """The whole point of relaxing uniqueness."""
    a = _make_order(db, student_user, vendor_user, status=OrderStatus.ready, token="246810")
    b = _make_order(db, student_user, vendor_user_2, status=OrderStatus.ready, token="246810")

    assert a.pickup_token == b.pickup_token == "246810"


def test_pickup_token_avoided_while_active_for_same_vendor(db, vendor_user, student_user, menu_item):
    """A second live order from the same vendor must not reuse a live code."""
    from app.crud.order import create_order

    first = create_order(
        db,
        student_id=student_user.id,
        vendor_id=vendor_user.id,
        items=[OrderItem(menu_item_id=menu_item.id, item_name="Veg Burger", price_at_order=Decimal("50.00"), quantity=1)],
        total=50.0,
    )
    second = create_order(
        db,
        student_id=student_user.id,
        vendor_id=vendor_user.id,
        items=[OrderItem(menu_item_id=menu_item.id, item_name="Veg Burger", price_at_order=Decimal("50.00"), quantity=1)],
        total=50.0,
    )
    db.commit()

    assert first.pickup_token != second.pickup_token
