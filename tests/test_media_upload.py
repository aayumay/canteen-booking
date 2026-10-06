import io
import pytest
from fastapi import status


def test_media_upload_success_jpeg(client, student_auth_headers):
    file_content = b"\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xFF\xDB"
    files = {"file": ("burger.jpg", io.BytesIO(file_content), "image/jpeg")}

    response = client.post("/api/v1/media/upload", headers=student_auth_headers, files=files)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert "url" in data
    assert data["url"].startswith("/uploads/")
    assert data["url"].endswith(".jpg")

    # Verify the uploaded file is servable directly
    get_res = client.get(data["url"])
    assert get_res.status_code == status.HTTP_200_OK
    assert get_res.content == file_content


def test_media_upload_success_png(client, vendor_auth_headers):
    file_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
    files = {"file": ("menu_item.png", io.BytesIO(file_content), "image/png")}

    response = client.post("/api/v1/media/upload", headers=vendor_auth_headers, files=files)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["url"].startswith("/uploads/")
    assert data["url"].endswith(".png")


def test_media_upload_invalid_content_type(client, student_auth_headers):
    file_content = b"console.log('malicious script');"
    files = {"file": ("script.js", io.BytesIO(file_content), "application/javascript")}

    response = client.post("/api/v1/media/upload", headers=student_auth_headers, files=files)
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "invalid file type" in response.json()["detail"].lower()


def test_media_upload_oversized_file(client, student_auth_headers):
    # 6MB file (exceeds default 5MB limit)
    big_content = b"0" * (6 * 1024 * 1024)
    files = {"file": ("huge_photo.jpg", io.BytesIO(big_content), "image/jpeg")}

    response = client.post("/api/v1/media/upload", headers=student_auth_headers, files=files)
    assert response.status_code == status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
    assert "exceeds maximum allowed size" in response.json()["detail"].lower()


def test_media_upload_unauthenticated(client):
    file_content = b"\xFF\xD8\xFF"
    files = {"file": ("anon.jpg", io.BytesIO(file_content), "image/jpeg")}

    response = client.post("/api/v1/media/upload", files=files)
    assert response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]
