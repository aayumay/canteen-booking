import pytest
from fastapi import status


def test_nutrition_and_allergen_lifecycle(
    client, vendor_user, vendor_auth_headers, student_user, student_auth_headers
):
    # 1. Vendor creates menu item with nutrition info
    payload = {
        "name": "High-Protein Quinoa Bowl",
        "description": "Quinoa with roasted veggies and paneer",
        "price": 140.0,
        "category": "Bowls",
        "calories": 450,
        "protein_g": 22.5,
        "carbs_g": 52.0,
        "fat_g": 11.5,
        "allergens": ["dairy", "soy"],
        "is_vegan": False,
    }
    res_create = client.post("/api/v1/vendor/menu", headers=vendor_auth_headers, json=payload)
    assert res_create.status_code == status.HTTP_201_CREATED
    item = res_create.json()
    assert item["calories"] == 450
    assert item["protein_g"] == 22.5
    assert "dairy" in item["allergens"]

    # 2. Student views menu and sees nutrition details
    res_menu = client.get(f"/api/v1/student/vendors/{vendor_user.id}/menu")
    assert res_menu.status_code == status.HTTP_200_OK
    items = res_menu.json()
    found = next((i for i in items if i["id"] == item["id"]), None)
    assert found is not None
    assert found["calories"] == 450
    assert found["protein_g"] == 22.5
    assert found["carbs_g"] == 52.0

    # 3. Student updates allergen avoidance preferences
    res_allergens = client.patch(
        "/api/v1/student/allergens",
        headers=student_auth_headers,
        json={"allergens": ["dairy", "peanuts", "gluten"]},
    )
    assert res_allergens.status_code == status.HTTP_200_OK
    assert "dairy" in res_allergens.json()["allergens"]

    # 4. Student queries allergen preferences
    res_get_allergens = client.get("/api/v1/student/allergens", headers=student_auth_headers)
    assert res_get_allergens.status_code == status.HTTP_200_OK
    assert "peanuts" in res_get_allergens.json()["allergens"]
