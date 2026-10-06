import pytest
from datetime import datetime
from fastapi import status


def test_student_class_schedule_and_timing_intelligence(
    client, student_user, student_auth_headers
):
    # 1. No schedule initially
    res_break_empty = client.get("/api/v1/student/schedule/upcoming-break", headers=student_auth_headers)
    assert res_break_empty.status_code == status.HTTP_200_OK
    assert res_break_empty.json()["has_schedule"] is False

    # 2. Add class on today spanning full 24 hours
    today_weekday = datetime.now().weekday()
    res_add = client.post(
        "/api/v1/student/schedule",
        headers=student_auth_headers,
        json={
            "day_of_week": today_weekday,
            "class_name": "Operating Systems & Networking",
            "start_time": "00:00",
            "end_time": "23:59",
            "location": "Room 402, CS Block",
        },
    )
    assert res_add.status_code == status.HTTP_201_CREATED
    entry_id = res_add.json()["id"]
    assert res_add.json()["class_name"] == "Operating Systems & Networking"

    # 3. List schedule
    res_list = client.get("/api/v1/student/schedule", headers=student_auth_headers)
    assert res_list.status_code == status.HTTP_200_OK
    entries = res_list.json()
    assert len(entries) == 1
    assert entries[0]["id"] == entry_id

    # 4. Check upcoming break now recognizes active class
    res_break = client.get("/api/v1/student/schedule/upcoming-break", headers=student_auth_headers)
    assert res_break.status_code == status.HTTP_200_OK
    break_data = res_break.json()
    assert break_data["has_schedule"] is True
    assert break_data["current_class"] == "Operating Systems & Networking"
    assert break_data["minutes_until_break"] is not None

    # 5. Delete class
    res_del = client.delete(f"/api/v1/student/schedule/{entry_id}", headers=student_auth_headers)
    assert res_del.status_code == status.HTTP_204_NO_CONTENT

    # 6. Verify empty again
    res_list_after = client.get("/api/v1/student/schedule", headers=student_auth_headers)
    assert len(res_list_after.json()) == 0
