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
VIDEO_UPLOAD_DIR = UPLOAD_DIR / "videos"
API_PUBLIC_BASE_URL = os.getenv(
    "API_PUBLIC_BASE_URL",
    "/_/backend" if os.getenv("VERCEL") else "http://127.0.0.1:8000",
).rstrip("/")

# Vercel Functions limit request bodies to ~4.5 MB on server uploads.
VERCEL_MAX_UPLOAD_BYTES = 4 * 1024 * 1024


def blob_storage_enabled() -> bool:
    return bool(os.getenv("BLOB_READ_WRITE_TOKEN"))


def on_vercel() -> bool:
    return bool(os.getenv("VERCEL"))


def max_video_bytes() -> int:
    return VERCEL_MAX_UPLOAD_BYTES if on_vercel() else 100 * 1024 * 1024


async def store_public_file(
    *,
    content: bytes,
    blob_path: str,
    content_type: str,
    local_dir: Path,
    public_url_path: str,
) -> str:
    """Persist file to Vercel Blob (production) or local uploads/ (development)."""
    if blob_storage_enabled():
        from vercel.blob import AsyncBlobClient

        async with AsyncBlobClient() as client:
            uploaded = await client.put(
                blob_path,
                content,
                access="public",
                content_type=content_type,
            )
            return uploaded.url

    local_dir.mkdir(parents=True, exist_ok=True)
    local_name = f"{uuid4().hex}{Path(blob_path).suffix}"
    destination = local_dir / local_name
    destination.write_bytes(content)
    return f"{API_PUBLIC_BASE_URL}{public_url_path}/{local_name}"


async def upload_avatar_or_course_image(
    content: bytes, extension: str, content_type: str, *, blob_folder: str
) -> str:
    blob_path = f"{blob_folder}/{uuid4().hex}{extension}"
    return await store_public_file(
        content=content,
        blob_path=blob_path,
        content_type=content_type,
        local_dir=UPLOAD_DIR,
        public_url_path="/uploads",
    )


async def upload_lesson_video(content: bytes, extension: str, content_type: str) -> str:
    blob_path = f"lesson-videos/{uuid4().hex}{extension}"
    return await store_public_file(
        content=content,
        blob_path=blob_path,
        content_type=content_type,
        local_dir=VIDEO_UPLOAD_DIR,
        public_url_path="/uploads/videos",
    )
