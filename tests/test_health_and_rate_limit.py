from unittest.mock import MagicMock, patch
from fastapi import status


def test_health_check_ok(client):
    response = client.get("/health")
    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"status": "ok", "database": "connected"}


def test_health_check_db_failure(client):
    with patch("app.main.engine.connect", side_effect=Exception("DB Unreachable")):
        response = client.get("/health")
        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        assert response.json()["status"] == "unhealthy"
