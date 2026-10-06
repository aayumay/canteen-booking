from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.core.config import get_settings
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.media import MediaUploadResponse
from app.services.storage_service import get_storage_service

router = APIRouter(prefix="/media", tags=["media"])

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}


@router.post("/upload", response_model=MediaUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_media(
    file: Annotated[UploadFile, File(...)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    settings = get_settings()

    # Validate MIME type
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type '{file.content_type}'. Allowed types: image/jpeg, image/png, image/webp.",
        )

    # Read content
    contents = await file.read()

    # Validate file size
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(contents) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum allowed size of {settings.max_upload_size_mb}MB.",
        )

    storage = get_storage_service()
    url = storage.save_file(
        file_bytes=contents,
        original_filename=file.filename or "upload.jpg",
        content_type=file.content_type,
    )

    return MediaUploadResponse(url=url)
