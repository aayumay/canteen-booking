"""Settlement ledger tests.

Covers the seven behaviours the feature is specified by:
  1. a wallet-paid order creates exactly one pending settlement, atomically
     with the order row and the wallet deduction
  2. rejecting/cancelling voids that settlement, atomically with the refund
  3. a pay-at-counter order creates no settlement
  4. mark-settled records status/settled_at/settled_by and fails cleanly on a
     second attempt
  5. bulk-settle settles all and only that vendor's pending rows
  6. vendor endpoints never expose another vendor's data
  7. the platform-wide pending total equals the sum of per-vendor totals
"""

from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.core.security import create_access_token
from app.crud.order import create_order
from app.models.menu_item import MenuItem
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.vendor_settlement import SettlementStatus, VendorSettlement
from app.models.wallet_transaction import WalletTransaction, WalletTransactionType
from app.services.settlement_service import (
    create_settlement_for_order,
    get_admin_summary,
    mark_settled,
    void_settlement_for_order,
)


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------


def auth(user):
    token = create_access_token(data={"sub": str(user.id), "role": user.role.value})
    return {"Authorization": f"Bearer {token}"}


def fund_wallet(db, student, amount=500.0):
    student.wallet_balance = amount
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


def add_menu_item(db, vendor, name="Mango Shake", price=30.0):
    item = MenuItem(
        vendor_id=vendor.id,
        name=name,
        description="Test item",
        price=price,
        category="Drinks",
        is_available=True,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def place_wallet_order(client, db, student, vendor, item):
    """Place a wallet-paid order through the real API and return the Order."""
    fund_wallet(db, student, 500.0)
    resp = client.post(
        "/api/v1/student/orders",
        headers=auth(student),
        json={
            "vendor_id": vendor.id,
            "items": [{"menu_item_id": item.id, "quantity": 1}],
            "payment_method": "wallet",
        },
    )
    assert resp.status_code == 201, resp.text
    order = db.query(Order).filter(Order.id == resp.json()["id"]).first()
    db.refresh(order)
    return order


def settlement_for(db, order):
    rows = db.query(VendorSettlement).filter(VendorSettlement.order_id == order.id).all()
    assert len(rows) == 1, f"expected exactly one settlement for order {order.id}"
    return rows[0]


# ---------------------------------------------------------------------------
# 1. wallet-paid order creates exactly one pending settlement, atomically
# ---------------------------------------------------------------------------


def test_wallet_order_creates_pending_settlement(
    client, db, student_user, vendor_user, menu_item
):
    order = place_wallet_order(client, db, student_user, vendor_user, menu_item)
    s = settlement_for(db, order)

    assert s.status == SettlementStatus.pending
    assert s.vendor_id == vendor_user.id
    # Amount is the order's own server-computed total, never a recalculation.
    assert Decimal(str(s.amount)) == Decimal(str(order.total_amount))
    assert Decimal(str(s.amount)) == Decimal(str(menu_item.price))
    assert s.settled_at is None
    assert s.settled_by is None
    assert s.voided_at is None


def test_wallet_order_settlement_is_atomic_with_deduction(
    client, db, student_user, vendor_user, menu_item
):
    order = place_wallet_order(client, db, student_user, vendor_user, menu_item)
    db.refresh(student_user)

    # Wallet debited...
    assert Decimal(str(student_user.wallet_balance)) == Decimal("450.00")
    # ...debit recorded...
    debit = (
        db.query(WalletTransaction)
        .filter(WalletTransaction.related_order_id == order.id)
        .filter(WalletTransaction.type == WalletTransactionType.order_payment)
        .first()
    )
    assert debit is not None
    assert Decimal(str(debit.amount)) == Decimal("-50.00")
    # ...and the settlement exists. No partial state anywhere.
    assert settlement_for(db, order).status == SettlementStatus.pending


def test_insufficient_balance_leaves_no_order_and_no_settlement(
    client, db, student_user, vendor_user, menu_item
):
    """The overdraft guard must not leave a settlement behind."""
    fund_wallet(db, student_user, 1.0)
    resp = client.post(
        "/api/v1/student/orders",
        headers=auth(student_user),
        json={
            "vendor_id": vendor_user.id,
            "items": [{"menu_item_id": menu_item.id, "quantity": 1}],
            "payment_method": "wallet",
        },
    )
    assert resp.status_code == 400
    assert db.query(Order).count() == 0
    assert db.query(VendorSettlement).count() == 0


# ---------------------------------------------------------------------------
# 2. rejection / cancellation voids the settlement
# ---------------------------------------------------------------------------


def test_vendor_rejection_voids_settlement_and_refunds(
    client, db, student_user, vendor_user, menu_item
):
    order = place_wallet_order(client, db, student_user, vendor_user, menu_item)
    assert settlement_for(db, order).status == SettlementStatus.pending

    resp = client.patch(
        f"/api/v1/vendor/orders/{order.id}/status",
        headers=auth(vendor_user),
        json={"status": "rejected", "rejection_reason": "Out of ingredients"},
    )
    assert resp.status_code == 200, resp.text

    s = settlement_for(db, order)
    assert s.status == SettlementStatus.voided, "no phantom pending amount"
    assert s.voided_at is not None

    db.refresh(student_user)
    assert Decimal(str(student_user.wallet_balance)) == Decimal("500.00")


def test_student_cancellation_voids_settlement(
    client, db, student_user, vendor_user, menu_item
):
    order = place_wallet_order(client, db, student_user, vendor_user, menu_item)
    resp = client.patch(
        f"/api/v1/student/orders/{order.id}/cancel",
        headers=auth(student_user),
    )
    assert resp.status_code == 200, resp.text
    assert settlement_for(db, order).status == SettlementStatus.voided


def test_void_helper_is_a_noop_on_an_already_voided_row(
    client, db, student_user, vendor_user, menu_item
):
    order = place_wallet_order(client, db, student_user, vendor_user, menu_item)
    client.patch(
        f"/api/v1/student/orders/{order.id}/cancel",
        headers=auth(student_user),
    )
    first_voided_at = settlement_for(db, order).voided_at
    assert first_voided_at is not None

    assert void_settlement_for_order(db, order) is None
    assert settlement_for(db, order).voided_at == first_voided_at


def test_void_helper_does_not_touch_an_already_settled_row(
    client, db, student_user, vendor_user, admin_user, menu_item
):
    """A settled row stays settled even if the order is later rejected.

    The admin is on record as having paid; silently rewriting it to voided
    would erase the only evidence that money left the platform.
    """
    order = place_wallet_order(client, db, student_user, vendor_user, menu_item)
    s = settlement_for(db, order)
    client.patch(
        f"/api/v1/admin/settlements/{s.id}/mark-settled",
        headers=auth(admin_user),
    )

    assert void_settlement_for_order(db, order) is None
    assert settlement_for(db, order).status == SettlementStatus.settled


# ---------------------------------------------------------------------------
# 3. pay-at-counter creates no settlement
# ---------------------------------------------------------------------------


def test_pay_at_counter_order_creates_no_settlement(
    client, db, student_user, vendor_user, menu_item
):
    resp = client.post(
        "/api/v1/student/orders",
        headers=auth(student_user),
        json={
            "vendor_id": vendor_user.id,
            "items": [{"menu_item_id": menu_item.id, "quantity": 1}],
            "payment_method": "pay_at_counter",
        },
    )
    assert resp.status_code == 201, resp.text
    assert db.query(VendorSettlement).count() == 0


def test_service_helper_ignores_non_wallet_orders(db, student_user, vendor_user, menu_item):
    # Deliberately not db.add()ed: create_order() flushes the order first and
    # then attaches the items itself.
    item = OrderItem(
        menu_item_id=menu_item.id,
        item_name=menu_item.name,
        price_at_order=Decimal("50.00"),
        quantity=1,
    )
    order = create_order(
        db,
        student_id=student_user.id,
        vendor_id=vendor_user.id,
        items=[item],
        total=50.0,
        payment_method="pay_at_counter",
    )
    db.commit()

    assert create_settlement_for_order(db, order) is None
    assert db.query(VendorSettlement).count() == 0


# ---------------------------------------------------------------------------
# 4. admin mark-settled
# ---------------------------------------------------------------------------


def test_admin_mark_settled_records_audit_fields(
    client, db, student_user, vendor_user, admin_user, menu_item
):
    order = place_wallet_order(client, db, student_user, vendor_user, menu_item)
    s = settlement_for(db, order)

    resp = client.patch(
        f"/api/v1/admin/settlements/{s.id}/mark-settled",
        headers=auth(admin_user),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "settled"
    assert body["settled_by"] == admin_user.id
    assert body["settled_at"] is not None

    db.refresh(s)
    assert s.status == SettlementStatus.settled
    assert s.settled_by == admin_user.id


def test_mark_settled_twice_fails_cleanly(
    client, db, student_user, vendor_user, admin_user, menu_item
):
    order = place_wallet_order(client, db, student_user, vendor_user, menu_item)
    s = settlement_for(db, order)

    first = client.patch(
        f"/api/v1/admin/settlements/{s.id}/mark-settled", headers=auth(admin_user)
    )
    assert first.status_code == 200

    second = client.patch(
        f"/api/v1/admin/settlements/{s.id}/mark-settled", headers=auth(admin_user)
    )
    assert second.status_code == 400
    assert "already" in second.json()["detail"].lower()


def test_cannot_settle_a_voided_settlement(
    client, db, student_user, vendor_user, admin_user, menu_item
):
    order = place_wallet_order(client, db, student_user, vendor_user, menu_item)
    client.patch(f"/api/v1/student/orders/{order.id}/cancel", headers=auth(student_user))
    s = settlement_for(db, order)

    resp = client.patch(
        f"/api/v1/admin/settlements/{s.id}/mark-settled", headers=auth(admin_user)
    )
    assert resp.status_code == 400
    assert "voided" in resp.json()["detail"].lower()


def test_mark_settled_unknown_id_404(client, db, admin_user):
    resp = client.patch(
        "/api/v1/admin/settlements/999999/mark-settled", headers=auth(admin_user)
    )
    assert resp.status_code == 404


def test_double_settle_is_blocked_by_the_database_guard(
    client, db, student_user, vendor_user, admin_user, menu_item
):
    """The guard lives in the UPDATE's WHERE clause, not in a Python status check.

    Simulates a second admin who is still holding a 'pending' copy of the row.
    The in-memory attribute deliberately lies; ``no_autoflush`` keeps that lie
    from being written, so the only thing that can stop the write is the
    database rejecting a second pending -> settled transition. Without the
    ``status = pending`` guard this would silently overwrite a colleague's
    audit stamp.
    """
    order = place_wallet_order(client, db, student_user, vendor_user, menu_item)
    row = settlement_for(db, order)
    assert row.status == SettlementStatus.pending

    first = client.patch(
        f"/api/v1/admin/settlements/{row.id}/mark-settled", headers=auth(admin_user)
    )
    assert first.status_code == 200
    first_stamp = first.json()["settled_at"]

    # Now pretend to be a second admin still holding a 'pending' copy: the
    # in-memory attribute deliberately lies, and no_autoflush keeps that lie
    # from reaching the database. The only thing that can stop the write is
    # the database refusing a second pending -> settled transition. Without
    # the ``status = pending`` guard this would overwrite a colleague's stamp.
    stale = db.get(VendorSettlement, row.id)
    stale.status = SettlementStatus.pending
    with db.no_autoflush:
        with pytest.raises(HTTPException) as exc:
            mark_settled(db, stale, admin_user)
    assert exc.value.status_code == 400
    assert "already" in exc.value.detail.lower()

    # Drop the stale copy and confirm the original audit trail survived.
    db.expunge(stale)
    survivor = db.get(VendorSettlement, row.id)
    assert survivor.status == SettlementStatus.settled
    assert survivor.settled_at.isoformat() == first_stamp
    assert survivor.settled_by == admin_user.id


def test_bulk_settle_skips_rows_settled_by_someone_else(
    client, db, student_user, vendor_user, admin_user, menu_item
):
    """A bulk must not re-stamp a row another admin just settled.

    The pre-settled row keeps its original settled_at/settled_by, so the
    history still shows who paid for what.
    """
    o1 = place_wallet_order(client, db, student_user, vendor_user, menu_item)
    o2 = place_wallet_order(client, db, student_user, vendor_user, menu_item)
    s1 = settlement_for(db, o1)

    client.patch(
        f"/api/v1/admin/settlements/{s1.id}/mark-settled", headers=auth(admin_user)
    )
    original_stamp = db.get(VendorSettlement, s1.id).settled_at

    resp = client.post(
        "/api/v1/admin/settlements/bulk-settle",
        headers=auth(admin_user),
        json={"vendor_id": vendor_user.id},
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 1, "only the still-pending row is in the batch"

    db.refresh(s1)
    assert s1.settled_at == original_stamp, "pre-settled row keeps its own stamp"
    assert settlement_for(db, o2).status == SettlementStatus.settled


def test_non_admin_cannot_mark_settled(client, db, student_user, vendor_user, menu_item):
    order = place_wallet_order(client, db, student_user, vendor_user, menu_item)
    s = settlement_for(db, order)

    for headers in (auth(student_user), auth(vendor_user)):
        resp = client.patch(
            f"/api/v1/admin/settlements/{s.id}/mark-settled", headers=headers
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# 5. bulk-settle scoping
# ---------------------------------------------------------------------------


def test_bulk_settle_only_touches_that_vendors_pending_rows(
    client, db, student_user, vendor_user, vendor_user_2, admin_user, menu_item
):
    item2 = add_menu_item(db, vendor_user_2)

    o1 = place_wallet_order(client, db, student_user, vendor_user, menu_item)
    o2 = place_wallet_order(client, db, student_user, vendor_user, menu_item)
    o3 = place_wallet_order(client, db, student_user, vendor_user_2, item2)

    s1, s2, s3 = (settlement_for(db, o) for o in (o1, o2, o3))

    # Pre-settle one of vendor 1's rows to prove settled history is preserved.
    client.patch(
        f"/api/v1/admin/settlements/{s1.id}/mark-settled", headers=auth(admin_user)
    )

    resp = client.post(
        "/api/v1/admin/settlements/bulk-settle",
        headers=auth(admin_user),
        json={"vendor_id": vendor_user.id},
    )
    assert resp.status_code == 200, resp.text
    assert len(resp.json()) == 1, "only the one remaining pending row"

    db.refresh(s1)
    db.refresh(s2)
    db.refresh(s3)
    assert s1.status == SettlementStatus.settled, "already-settled row untouched"
    assert s2.status == SettlementStatus.settled
    assert s2.settled_by == admin_user.id
    assert s3.status == SettlementStatus.pending, "other vendor untouched"


def test_bulk_settle_shares_one_audit_stamp(
    client, db, student_user, vendor_user, admin_user, menu_item
):
    o1 = place_wallet_order(client, db, student_user, vendor_user, menu_item)
    o2 = place_wallet_order(client, db, student_user, vendor_user, menu_item)
    s1, s2 = (settlement_for(db, o) for o in (o1, o2))

    client.post(
        "/api/v1/admin/settlements/bulk-settle",
        headers=auth(admin_user),
        json={"vendor_id": vendor_user.id},
    )
    db.refresh(s1)
    db.refresh(s2)
    assert s1.settled_at == s2.settled_at
    assert s1.settled_by == s2.settled_by == admin_user.id


def test_bulk_settle_with_nothing_pending_fails_cleanly(client, db, vendor_user, admin_user):
    resp = client.post(
        "/api/v1/admin/settlements/bulk-settle",
        headers=auth(admin_user),
        json={"vendor_id": vendor_user.id},
    )
    assert resp.status_code == 400
    assert "no pending" in resp.json()["detail"].lower()


def test_bulk_settle_unknown_vendor_404(client, db, admin_user):
    resp = client.post(
        "/api/v1/admin/settlements/bulk-settle",
        headers=auth(admin_user),
        json={"vendor_id": 999999},
    )
    assert resp.status_code == 404


def test_bulk_settle_rejects_a_student_id(client, db, student_user, admin_user):
    resp = client.post(
        "/api/v1/admin/settlements/bulk-settle",
        headers=auth(admin_user),
        json={"vendor_id": student_user.id},
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# 6. vendor scoping
# ---------------------------------------------------------------------------


def test_vendor_summary_and_list_are_scoped(
    client, db, student_user, vendor_user, vendor_user_2, menu_item
):
    item2 = add_menu_item(db, vendor_user_2)
    place_wallet_order(client, db, student_user, vendor_user, menu_item)
    place_wallet_order(client, db, student_user, vendor_user_2, item2)

    s1 = client.get("/api/v1/vendor/settlements/summary", headers=auth(vendor_user))
    assert s1.status_code == 200
    assert s1.json()["pending_amount"] == 50.0
    assert s1.json()["pending_count"] == 1

    s2 = client.get("/api/v1/vendor/settlements/summary", headers=auth(vendor_user_2))
    assert s2.json()["pending_amount"] == 30.0
    assert s2.json()["pending_count"] == 1

    listing = client.get("/api/v1/vendor/settlements", headers=auth(vendor_user))
    assert listing.status_code == 200
    body = listing.json()
    assert body["total"] == 1
    assert body["limit"] == 50
    assert body["offset"] == 0
    assert len(body["items"]) == 1
    assert body["items"][0]["vendor_id"] == vendor_user.id, "never another vendor's row"


def test_vendor_with_no_wallet_orders_gets_an_empty_ledger(
    client, db, student_user, vendor_user, menu_item
):
    """Counter-paid orders are out of scope, so this vendor legitimately has
    no rows at all rather than a zero-amount row."""
    client.post(
        "/api/v1/student/orders",
        headers=auth(student_user),
        json={
            "vendor_id": vendor_user.id,
            "items": [{"menu_item_id": menu_item.id, "quantity": 1}],
            "payment_method": "pay_at_counter",
        },
    )
    empty = client.get("/api/v1/vendor/settlements", headers=auth(vendor_user)).json()
    assert empty["total"] == 0
    assert empty["items"] == []
    summary = client.get(
        "/api/v1/vendor/settlements/summary", headers=auth(vendor_user)
    ).json()
    assert summary["pending_amount"] == 0.0
    assert summary["pending_count"] == 0
    assert summary["settled_count"] == 0


def test_student_cannot_reach_vendor_settlements(client, db, student_user):
    assert client.get("/api/v1/vendor/settlements", headers=auth(student_user)).status_code == 403
    assert (
        client.get("/api/v1/vendor/settlements/summary", headers=auth(student_user)).status_code
        == 403
    )


def test_vendor_cannot_reach_admin_settlements(client, db, vendor_user):
    assert client.get("/api/v1/admin/settlements", headers=auth(vendor_user)).status_code == 403
    assert (
        client.get("/api/v1/admin/settlements/summary", headers=auth(vendor_user)).status_code
        == 403
    )


# ---------------------------------------------------------------------------
# 7. aggregate / detail reconciliation
# ---------------------------------------------------------------------------


def test_platform_total_matches_sum_of_vendor_totals(
    client, db, student_user, vendor_user, vendor_user_2, admin_user, menu_item
):
    item2 = add_menu_item(db, vendor_user_2)
    place_wallet_order(client, db, student_user, vendor_user, menu_item)
    place_wallet_order(client, db, student_user, vendor_user, menu_item)
    place_wallet_order(client, db, student_user, vendor_user_2, item2)

    platform = client.get("/api/v1/admin/settlements/summary", headers=auth(admin_user))
    assert platform.status_code == 200
    p = platform.json()
    assert p["pending_amount"] == 130.0
    assert p["pending_count"] == 3
    assert p["vendor_count"] == 2

    rows = client.get(
        "/api/v1/admin/settlements/vendors", headers=auth(admin_user)
    ).json()
    assert sum(r["pending_amount"] for r in rows) == p["pending_amount"], "no drift"
    assert sum(r["pending_count"] for r in rows) == p["pending_count"]

    # Largest outstanding first.
    assert rows[0]["vendor_id"] == vendor_user.id
    assert rows[0]["pending_amount"] == 100.0
    assert rows[0]["pending_count"] == 2
    assert rows[1]["vendor_id"] == vendor_user_2.id
    assert rows[1]["pending_amount"] == 30.0


def test_service_aggregate_matches_row_by_row_sum(
    db, student_user, vendor_user, vendor_user_2, admin_user, menu_item
):
    """Guards the aggregate against drift at the service layer, independent of
    the HTTP layer."""
    from app.services.order_service import place_order
    from app.schemas.order import OrderCreate

    item2 = add_menu_item(db, vendor_user_2)
    fund_wallet(db, student_user, 1000.0)

    for vendor, item in ((vendor_user, menu_item), (vendor_user, menu_item), (vendor_user_2, item2)):
        place_order(
            db,
            student_user,
            OrderCreate(
                vendor_id=vendor.id,
                items=[{"menu_item_id": item.id, "quantity": 1}],
                payment_method="wallet",
            ),
        )

    summary = get_admin_summary(db)
    assert summary["pending_count"] == 3

    row_sum = sum(
        float(row.amount)
        for row in db.query(VendorSettlement)
        .filter(VendorSettlement.status == SettlementStatus.pending)
        .all()
    )
    assert round(row_sum, 2) == summary["pending_amount"]


def test_platform_total_drops_when_settled(
    client, db, student_user, vendor_user, admin_user, menu_item
):
    order = place_wallet_order(client, db, student_user, vendor_user, menu_item)
    s = settlement_for(db, order)

    client.patch(
        f"/api/v1/admin/settlements/{s.id}/mark-settled", headers=auth(admin_user)
    )
    p = client.get("/api/v1/admin/settlements/summary", headers=auth(admin_user)).json()
    assert p["pending_amount"] == 0.0
    assert p["pending_count"] == 0
    assert p["settled_amount"] == 50.0
    assert p["settled_count"] == 1


def test_voided_amounts_are_reported_separately_from_pending(
    client, db, student_user, vendor_user, menu_item
):
    order = place_wallet_order(client, db, student_user, vendor_user, menu_item)
    client.patch(f"/api/v1/student/orders/{order.id}/cancel", headers=auth(student_user))

    p = client.get("/api/v1/vendor/settlements/summary", headers=auth(vendor_user)).json()
    assert p["pending_amount"] == 0.0
    assert p["pending_count"] == 0
    assert p["voided_amount"] == 50.0
    assert p["voided_count"] == 1


# ---------------------------------------------------------------------------
# admin list filters
# ---------------------------------------------------------------------------


def test_admin_list_filters_by_vendor_and_status(
    client, db, student_user, vendor_user, vendor_user_2, admin_user, menu_item
):
    item2 = add_menu_item(db, vendor_user_2)
    place_wallet_order(client, db, student_user, vendor_user, menu_item)
    o2 = place_wallet_order(client, db, student_user, vendor_user_2, item2)

    s2 = settlement_for(db, o2)
    client.patch(
        f"/api/v1/admin/settlements/{s2.id}/mark-settled", headers=auth(admin_user)
    )

    by_vendor = client.get(
        "/api/v1/admin/settlements",
        headers=auth(admin_user),
        params={"vendor_id": vendor_user.id},
    ).json()
    assert by_vendor["total"] == 1
    assert by_vendor["items"][0]["vendor_id"] == vendor_user.id

    pending = client.get(
        "/api/v1/admin/settlements",
        headers=auth(admin_user),
        params={"status": "pending"},
    ).json()
    assert pending["total"] == 1
    assert pending["items"][0]["status"] == "pending"

    settled = client.get(
        "/api/v1/admin/settlements",
        headers=auth(admin_user),
        params={"status": "settled"},
    ).json()
    assert settled["total"] == 1
    assert settled["items"][0]["settled_by"] == admin_user.id


def test_admin_list_rejects_invalid_status_filter(client, db, admin_user):
    resp = client.get(
        "/api/v1/admin/settlements",
        headers=auth(admin_user),
        params={"status": "not-a-status"},
    )
    assert resp.status_code == 422


def test_admin_list_paginates(client, db, student_user, vendor_user, admin_user, menu_item):
    for _ in range(3):
        place_wallet_order(client, db, student_user, vendor_user, menu_item)

    page = client.get(
        "/api/v1/admin/settlements",
        headers=auth(admin_user),
        params={"limit": 2, "offset": 0},
    ).json()
    assert page["total"] == 3
    assert len(page["items"]) == 2
    assert page["limit"] == 2

    page2 = client.get(
        "/api/v1/admin/settlements",
        headers=auth(admin_user),
        params={"limit": 2, "offset": 2},
    ).json()
    assert len(page2["items"]) == 1


def test_settlement_detail_includes_order_context(
    client, db, student_user, vendor_user, menu_item
):
    order = place_wallet_order(client, db, student_user, vendor_user, menu_item)
    body = client.get("/api/v1/vendor/settlements", headers=auth(vendor_user)).json()
    row = body["items"][0]
    assert row["order_id"] == order.id
    assert row["pickup_token"] == order.pickup_token
    assert row["order_status"] == "placed"


def test_vendor_list_paginates_and_filters(
    client, db, student_user, vendor_user, admin_user, menu_item
):
    o1 = place_wallet_order(client, db, student_user, vendor_user, menu_item)
    place_wallet_order(client, db, student_user, vendor_user, menu_item)
    s1 = settlement_for(db, o1)
    client.patch(
        f"/api/v1/admin/settlements/{s1.id}/mark-settled", headers=auth(admin_user)
    )

    page = client.get(
        "/api/v1/vendor/settlements",
        headers=auth(vendor_user),
        params={"limit": 1, "offset": 0},
    ).json()
    assert page["total"] == 2
    assert len(page["items"]) == 1
    assert page["limit"] == 1

    pending = client.get(
        "/api/v1/vendor/settlements",
        headers=auth(vendor_user),
        params={"status": "pending"},
    ).json()
    assert pending["total"] == 1
    assert pending["items"][0]["status"] == "pending"

    voided = client.get(
        "/api/v1/vendor/settlements",
        headers=auth(vendor_user),
        params={"status": "voided"},
    ).json()
    assert voided["total"] == 0, "empty filter is an empty page, not an error"


def test_amount_is_a_snapshot_not_a_live_recalculation(
    client, db, student_user, vendor_user, menu_item
):
    """Changing the menu price after the fact must not revalue the ledger."""
    order = place_wallet_order(client, db, student_user, vendor_user, menu_item)
    s = settlement_for(db, order)

    menu_item.price = 999.0
    db.add(menu_item)
    db.commit()

    db.refresh(s)
    assert Decimal(str(s.amount)) == Decimal("50.00")
