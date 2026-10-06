"""Menu item ingredients + macro nutrition.

Covers the four things the feature has to get right:
  1. every nutrition field is optional - blank, partial and full payloads all save
  2. macro_percentages computes the real ratio, and returns null rather than a
     misleading partial breakdown when data is incomplete
  3. the values are vendor-entered and stored verbatim; nothing is estimated
     from the ingredient text
  4. obviously-wrong numbers (negative, absurd calories) are rejected server-side
     with a clear 422
"""

import pytest

from app.schemas.menu_item import (
    MAX_CALORIES,
    MAX_MACRO_G,
    MenuItemCreate,
    MenuItemOut,
    MenuItemUpdate,
)

VENDOR_HEADERS_KEY = "vendor"


def auth(user):
    from app.core.security import create_access_token

    token = create_access_token(data={"sub": str(user.id), "role": user.role.value})
    return {"Authorization": f"Bearer {token}"}


def make_item(client, vendor_user, **overrides):
    """POST a menu item, defaulting to the minimum a vendor must supply."""
    payload = {"name": "Veg Fried Rice", "price": 80}
    payload.update(overrides)
    return client.post("/api/v1/vendor/menu", headers=auth(vendor_user), json=payload)


# ---------------------------------------------------------------------------
# 1. everything is optional
# ---------------------------------------------------------------------------


def test_item_saves_with_every_nutrition_field_blank(client, vendor_user):
    resp = make_item(client, vendor_user)
    assert resp.status_code == 201, resp.text
    body = resp.json()

    for field in (
        "ingredients",
        "serving_size",
        "calories",
        "protein_g",
        "carbs_g",
        "fat_g",
        "fiber_g",
    ):
        assert body[field] is None, f"{field} should be absent, not defaulted"
    assert body["macro_percentages"] is None


def test_item_saves_with_only_some_nutrition_fields(client, vendor_user):
    resp = make_item(client, vendor_user, calories=420, protein_g=12.5, ingredients="Rice, peas, carrot")
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["calories"] == 420
    assert body["protein_g"] == 12.5
    assert body["ingredients"] == "Rice, peas, carrot"
    assert body["fat_g"] is None
    # Partial macros must not produce a ratio.
    assert body["macro_percentages"] is None


def test_item_saves_with_every_nutrition_field_filled(client, vendor_user):
    resp = make_item(
        client,
        vendor_user,
        ingredients="Paneer, bell peppers, onion, soy sauce, rice",
        serving_size="1 bowl (approx. 350g)",
        calories=520,
        protein_g=24.0,
        carbs_g=58.0,
        fat_g=18.0,
        fiber_g=4.5,
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["ingredients"] == "Paneer, bell peppers, onion, soy sauce, rice"
    assert body["serving_size"] == "1 bowl (approx. 350g)"
    assert body["calories"] == 520
    assert body["protein_g"] == 24.0
    assert body["carbs_g"] == 58.0
    assert body["fat_g"] == 18.0
    assert body["fiber_g"] == 4.5
    assert body["macro_percentages"] is not None


def test_ingredients_only_no_numbers_is_allowed(client, vendor_user):
    """Ingredients without macros is a legitimate, useful entry."""
    resp = make_item(client, vendor_user, ingredients="Rice, dal, ghee, onion")
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["ingredients"] == "Rice, dal, ghee, onion"
    assert body["calories"] is None
    assert body["macro_percentages"] is None


def test_newline_separated_ingredients_are_stored_verbatim(client, vendor_user):
    text = "Paneer\nBell peppers\nOnion\nSoy sauce"
    resp = make_item(client, vendor_user, ingredients=text)
    assert resp.status_code == 201
    assert resp.json()["ingredients"] == text, "free text, not split or reordered"


def test_patch_can_add_and_then_clear_nutrition(client, vendor_user):
    item_id = make_item(client, vendor_user).json()["id"]

    added = client.patch(
        f"/api/v1/vendor/menu/{item_id}",
        headers=auth(vendor_user),
        json={"calories": 300, "protein_g": 10, "carbs_g": 30, "fat_g": 12, "fiber_g": 3},
    )
    assert added.status_code == 200
    assert added.json()["macro_percentages"] is not None

    cleared = client.patch(
        f"/api/v1/vendor/menu/{item_id}",
        headers=auth(vendor_user),
        json={"calories": None, "protein_g": None, "carbs_g": None, "fat_g": None, "fiber_g": None},
    )
    assert cleared.status_code == 200
    assert cleared.json()["calories"] is None
    assert cleared.json()["macro_percentages"] is None


def test_student_menu_endpoint_returns_nutrition(client, vendor_user, student_user):
    make_item(
        client,
        vendor_user,
        name="Paneer Bowl",
        ingredients="Paneer, rice",
        serving_size="1 bowl",
        calories=520,
        protein_g=24,
        carbs_g=58,
        fat_g=18,
    )
    resp = client.get(
        f"/api/v1/student/vendors/{vendor_user.id}/menu", headers=auth(student_user)
    )
    assert resp.status_code == 200, resp.text
    item = next(i for i in resp.json() if i["name"] == "Paneer Bowl")
    assert item["ingredients"] == "Paneer, rice"
    assert item["serving_size"] == "1 bowl"
    assert item["macro_percentages"] is not None


# ---------------------------------------------------------------------------
# 2. macro_percentages arithmetic and its null cases
# ---------------------------------------------------------------------------


def test_macro_percentages_use_atwater_factors():
    """protein 10g = 40kcal, carbs 25g = 100kcal, fat 10g = 90kcal -> 230 total."""
    out = MenuItemOut(
        id=1,
        vendor_id=1,
        name="Test",
        price=10,
        calories=230,
        protein_g=10,
        carbs_g=25,
        fat_g=10,
    )
    pcts = out.macro_percentages
    assert pcts is not None
    assert pcts.protein_pct == pytest.approx(17.4, abs=0.1)   # 40/230
    assert pcts.carbs_pct == pytest.approx(43.5, abs=0.1)     # 100/230
    assert pcts.fat_pct == pytest.approx(39.1, abs=0.1)       # 90/230
    assert round(pcts.protein_pct + pcts.carbs_pct + pcts.fat_pct) == 100


def test_macro_percentages_percentages_sum_to_100():
    out = MenuItemOut(
        id=1, vendor_id=1, name="T", price=10, calories=400,
        protein_g=30, carbs_g=40, fat_g=20,
    )
    p = out.macro_percentages
    assert p.protein_pct + p.carbs_pct + p.fat_pct == pytest.approx(100.0, abs=0.3)


def test_macro_percentages_null_without_calories():
    out = MenuItemOut(
        id=1, vendor_id=1, name="T", price=10,
        protein_g=10, carbs_g=20, fat_g=5,
    )
    assert out.macro_percentages is None


@pytest.mark.parametrize("missing", ["protein_g", "carbs_g", "fat_g"])
def test_macro_percentages_null_when_any_single_macro_missing(missing):
    values = {"calories": 400, "protein_g": 20, "carbs_g": 30, "fat_g": 10}
    values[missing] = None
    out = MenuItemOut(id=1, vendor_id=1, name="T", price=10, **values)
    assert out.macro_percentages is None, f"partial data must not yield a {missing}-less ratio"


def test_macro_percentages_null_when_all_macros_zero():
    """No calories from macros means no total to take a share of."""
    out = MenuItemOut(
        id=1, vendor_id=1, name="T", price=10, calories=400,
        protein_g=0, carbs_g=0, fat_g=0,
    )
    assert out.macro_percentages is None


def test_macro_percentages_present_with_a_zero_macro():
    """One macro genuinely being zero is real data, not missing data."""
    out = MenuItemOut(
        id=1, vendor_id=1, name="T", price=10, calories=240,
        protein_g=15, carbs_g=30, fat_g=0,
    )
    p = out.macro_percentages
    assert p is not None
    assert p.fat_pct == 0.0
    assert p.protein_pct > 0 and p.carbs_pct > 0


def test_macro_percentages_ignore_fiber():
    """Fiber is a carbohydrate but is not counted as available carbs here;
    it must not appear in the ratio."""
    with_fiber = MenuItemOut(
        id=1, vendor_id=1, name="T", price=10, calories=300,
        protein_g=10, carbs_g=20, fat_g=10, fiber_g=5,
    )
    without = MenuItemOut(
        id=1, vendor_id=1, name="T", price=10, calories=300,
        protein_g=10, carbs_g=20, fat_g=10,
    )
    assert with_fiber.macro_percentages == without.macro_percentages


def test_macro_percentages_ratios_are_of_macro_calories_not_declared_calories():
    """Declared calories and macro-derived calories disagree all the time.

    The ratio must still be a ratio of the macros, so it sums to 100% rather
    than being scaled against a number the vendor typed in by hand.
    """
    out = MenuItemOut(
        id=1, vendor_id=1, name="T", price=10, calories=900,  # deliberately inconsistent
        protein_g=25, carbs_g=50, fat_g=20,
    )
    p = out.macro_percentages
    # Macro-derived total is 100 + 200 + 180 = 480 kcal, and the percentages are
    # shares of *that*, not of the hand-typed 900. So the ratio still sums to
    # 100% instead of topping out at 53%.
    assert p.protein_pct == pytest.approx(20.8, abs=0.1)   # 100/480
    assert p.carbs_pct == pytest.approx(41.7, abs=0.1)     # 200/480
    assert p.fat_pct == pytest.approx(37.5, abs=0.1)       # 180/480
    assert p.protein_pct + p.carbs_pct + p.fat_pct == pytest.approx(100.0, abs=0.3)


def test_macro_percentages_survives_json_serialisation(client, vendor_user):
    """It is a computed field, so it must appear in the wire payload."""
    make_item(
        client, vendor_user,
        calories=500, protein_g=20, carbs_g=50, fat_g=25,
    )
    body = make_item(
        client, vendor_user, name="Second",
        calories=500, protein_g=20, carbs_g=50, fat_g=25,
    ).json()
    assert "macro_percentages" in body
    assert set(body["macro_percentages"]) == {"protein_pct", "carbs_pct", "fat_pct"}


def test_zero_calories_with_zero_macros_does_not_divide_by_zero(client, vendor_user):
    resp = make_item(
        client, vendor_user,
        calories=0, protein_g=0, carbs_g=0, fat_g=0, fiber_g=0,
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["macro_percentages"] is None


# ---------------------------------------------------------------------------
# 3. nothing is estimated for the vendor
# ---------------------------------------------------------------------------


def test_nothing_is_inferred_from_ingredient_text(client, vendor_user):
    """A ingredients string full of protein-ish words must not synthesise numbers."""
    resp = make_item(
        client,
        vendor_user,
        ingredients="Paneer, dal, rice, ghee, nuts, egg",
        serving_size="1 plate",
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["calories"] is None
    assert body["protein_g"] is None
    assert body["carbs_g"] is None
    assert body["fat_g"] is None
    assert body["fiber_g"] is None
    assert body["macro_percentages"] is None


# ---------------------------------------------------------------------------
# 4. server-side range validation
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "field,bad",
    [
        ("calories", -1),
        ("protein_g", -0.1),
        ("carbs_g", -5),
        ("fat_g", -2.5),
        ("fiber_g", -1),
    ],
)
def test_negative_nutrition_values_rejected(client, vendor_user, field, bad):
    resp = make_item(client, vendor_user, **{field: bad})
    assert resp.status_code == 422, f"{field}={bad} should be rejected"
    assert field in resp.text


def test_absurd_calories_rejected(client, vendor_user):
    resp = make_item(client, vendor_user, calories=MAX_CALORIES + 1)
    assert resp.status_code == 422
    assert "calories" in resp.text


def test_absurd_macro_rejected(client, vendor_user):
    resp = make_item(client, vendor_user, protein_g=MAX_MACRO_G + 1)
    assert resp.status_code == 422
    assert "protein_g" in resp.text


def test_boundary_values_accepted(client, vendor_user):
    """The limits themselves must not be rejected - off-by-one guards."""
    resp = make_item(
        client, vendor_user,
        calories=MAX_CALORIES, protein_g=MAX_MACRO_G, carbs_g=0, fat_g=0,
    )
    assert resp.status_code == 201, resp.text


def test_validation_also_applies_on_patch(client, vendor_user):
    item_id = make_item(client, vendor_user).json()["id"]
    resp = client.patch(
        f"/api/v1/vendor/menu/{item_id}",
        headers=auth(vendor_user),
        json={"calories": 99999},
    )
    assert resp.status_code == 422


def test_schema_rejects_negative_directly():
    with pytest.raises(ValueError):
        MenuItemCreate(name="X", price=10, calories=-1)
    with pytest.raises(ValueError):
        MenuItemUpdate(fat_g=-3)


def test_ingredients_length_is_bounded():
    with pytest.raises(ValueError):
        MenuItemCreate(name="X", price=10, ingredients="a" * 2001)
