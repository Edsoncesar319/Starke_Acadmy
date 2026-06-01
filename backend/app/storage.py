import os
from pathlib import Path
from uuid import uuid4

UPLOAD_DIR = Path(
    os.getenv(
        "UPLOAD_DIR",
        str(
            Path("/tmp/starke-uploads")
            if os.getenv("VERCEL")
            else Path(__file__).resolve().parent.parent / "uploads"
        ),
    )
)
API_PUBLIC_BASE_URL = os.getenv(
    "API_PUBLIC_BASE_URL",
    "/_/backend" if os.getenv("VERCEL") else "http://127.0.0.1:8000",
).rstrip("/")


def blob_storage_enabled() -> bool:
    return bool(os.getenv("BLOB_READ_WRITE_TOKEN"))


async def upload_course_image(content: bytes, extension: str, content_type: str) -> str:
    """Upload course hero image to Vercel Blob (prod) or local disk (dev)."""
    filename = f"course-images/{uuid4().hex}{extension}"

    if blob_storage_enabled():
        from vercel.blob import AsyncBlobClient

        async with AsyncBlobClient() as client:
            uploaded = await client.put(
                filename,
                content,
                access="public",
                content_type=content_type,
            )
            return uploaded.url

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    local_name = f"{uuid4().hex}{extension}"
    destination = UPLOAD_DIR / local_name
    destination.write_bytes(content)
    return f"{API_PUBLIC_BASE_URL}/uploads/{local_name}"
