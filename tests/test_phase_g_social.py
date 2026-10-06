import pytest
from fastapi import status


def test_campus_social_and_leaderboard(
    client, student_user, student_auth_headers
):
    # 1. Update social profile and opt-in to leaderboard
    payload = {
        "name": "Aayush Kushwaha",
        "hostel_block": "Aryabhatta Hostel Block A",
        "department": "Computer Science & Engineering",
        "leaderboard_opt_in": True,
    }
    res_up = client.patch(
        "/api/v1/student/profile/social",
        headers=student_auth_headers,
        json=payload,
    )
    assert res_up.status_code == status.HTTP_200_OK
    data = res_up.json()
    assert data["hostel_block"] == "Aryabhatta Hostel Block A"
    assert data["leaderboard_opt_in"] is True

    # 2. Query leaderboard
    res_lb = client.get("/api/v1/student/leaderboard", headers=student_auth_headers)
    assert res_lb.status_code == status.HTTP_200_OK
    lb_data = res_lb.json()
    assert lb_data["opted_in_count"] >= 1
    found = next((e for e in lb_data["entries"] if e["student_id"] == student_user.id), None)
    assert found is not None
    assert found["name"] == "Aayush Kushwaha"
    assert found["hostel_block"] == "Aryabhatta Hostel Block A"

    # 3. Opt-out from leaderboard
    client.patch(
        "/api/v1/student/profile/social",
        headers=student_auth_headers,
        json={"leaderboard_opt_in": False},
    )

    # 4. Check leaderboard no longer lists the student
    res_lb_after = client.get("/api/v1/student/leaderboard", headers=student_auth_headers)
    assert not any(e["student_id"] == student_user.id for e in res_lb_after.json()["entries"])
