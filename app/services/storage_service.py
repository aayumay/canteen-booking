import os
import uuid
from abc import ABC, abstractmethod
from pathlib import Path

from app.core.config import get_settings


class StorageService(ABC):
    @abstractmethod
    def save_file(self, file_bytes: bytes, original_filename: str, content_type: str) -> str:
        """
        Saves file bytes and returns a servable URL.
        """
        pass

    @abstractmethod
    def delete_file(self, url: str) -> None:
        """
        Deletes a file given its servable URL.
        """
        pass


class LocalDiskStorage(StorageService):
    def __init__(self, upload_dir: str | None = None):
        settings = get_settings()
        self.upload_dir = Path(upload_dir or settings.upload_dir)
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    def save_file(self, file_bytes: bytes, original_filename: str, content_type: str) -> str:
        # Extract original extension safely
        ext = Path(original_filename).suffix.lower()
        if not ext:
            # Infer standard extensions from content-type
            mime_ext_map = {
                "image/jpeg": ".jpg",
                "image/png": ".png",
                "image/webp": ".webp",
            }
            ext = mime_ext_map.get(content_type, ".jpg")

        unique_filename = f"{uuid.uuid4().hex}{ext}"
        destination = self.upload_dir / unique_filename

        with open(destination, "wb") as f:
            f.write(file_bytes)

        return f"/uploads/{unique_filename}"

    def delete_file(self, url: str) -> None:
        if not url:
            return
        filename = Path(url).name
        target = self.upload_dir / filename
        if target.exists() and target.is_file():
            try:
                target.unlink()
            except OSError:
                pass


def get_storage_service() -> StorageService:
    settings = get_settings()
    backend = (settings.storage_backend or "local").lower()
    if backend == "local":
        return LocalDiskStorage(settings.upload_dir)
    # Placeholder seam for future cloud storage backends (e.g. S3, Cloudinary)
    raise NotImplementedError(f"Storage backend '{backend}' is not supported yet.")
