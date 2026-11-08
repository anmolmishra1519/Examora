from __future__ import annotations

import os

from app.config import get_settings

settings = get_settings()

ALLOWED_EXTENSIONS = {"pdf", "docx", "jpg", "jpeg", "png"}
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
}


class UploadValidationError(ValueError):
    pass


def validate_upload(filename: str, content_type: str, size_bytes: int) -> None:
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise UploadValidationError(f"Unsupported file extension: .{ext}. Allowed: PDF, DOCX, JPG, PNG.")
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise UploadValidationError(f"Unsupported file type: {content_type}.")
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    if size_bytes > max_bytes:
        raise UploadValidationError(f"File exceeds the {settings.MAX_UPLOAD_MB}MB upload limit.")
    if size_bytes == 0:
        raise UploadValidationError("The uploaded file is empty or corrupted.")


def save_upload(exam_id: str, file_bytes: bytes, filename: str) -> str:
    os.makedirs(settings.STORAGE_PATH, exist_ok=True)
    ext = filename.lower().rsplit(".", 1)[-1]
    path = os.path.join(settings.STORAGE_PATH, f"{exam_id}.{ext}")
    with open(path, "wb") as f:
        f.write(file_bytes)
    return path


def load_file(path: str) -> bytes:
    with open(path, "rb") as f:
        return f.read()
