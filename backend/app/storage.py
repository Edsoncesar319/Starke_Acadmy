import os
from pathlib import Path
from uuid import uuid4

from .blob_config import resolve_blob_access, resolve_blob_read_write_token

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
    "/api" if os.getenv("VERCEL") else "http://127.0.0.1:8000/api",
).rstrip("/")

# Vercel Functions limit request bodies to ~4.5 MB on server uploads.
VERCEL_MAX_UPLOAD_BYTES = 4 * 1024 * 1024


def blob_storage_enabled() -> bool:
    return bool(resolve_blob_read_write_token())


def on_vercel() -> bool:
    return bool(os.getenv("VERCEL"))


def max_video_bytes() -> int:
    return VERCEL_MAX_UPLOAD_BYTES if on_vercel() else 100 * 1024 * 1024


def _blob_access_preference() -> str:
    value = os.getenv("BLOB_ACCESS", "auto").strip().lower()
    if value in {"public", "private"}:
        return value
    return "auto"


def lesson_video_blob_access() -> str:
    return resolve_blob_access()


def resolve_blob_redirect_url(pathname: str) -> str | None:
    """Return a CDN URL when the blob is publicly readable (skip API proxy)."""
    if not blob_storage_enabled():
        return None
    from vercel.blob import BlobClient

    clean = pathname.lstrip("/")
    token = resolve_blob_read_write_token()
    with BlobClient(token=token) as client:
        try:
            meta = client.head(clean)
        except Exception:
            return None
    if ".public.blob.vercel-storage.com" in meta.url:
        return meta.url
    return None


def _public_media_url(pathname: str) -> str:
    clean = pathname.lstrip("/")
    return f"{API_PUBLIC_BASE_URL}/media/{clean}"


def _upload_to_blob(*, blob_path: str, content: bytes, content_type: str) -> str:
    from vercel.blob import BlobClient

    access = resolve_blob_access()
    token = resolve_blob_read_write_token()
    if not token:
        raise RuntimeError(
            "BLOB_READ_WRITE_TOKEN ou Uploads_READ_WRITE_TOKEN ausente. "
            "Conecte o store Uploads na Vercel."
        )

    try:
        with BlobClient(token=token) as client:
            uploaded = client.put(
                blob_path,
                content,
                access=access,  # type: ignore[arg-type]
                content_type=content_type,
                add_random_suffix=True,
            )
    except Exception as exc:
        raise RuntimeError("Falha ao enviar arquivo para o Vercel Blob.") from exc

    if access == "private" or ".private.blob." in uploaded.url:
        return _public_media_url(uploaded.pathname)
    return uploaded.url


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
        try:
            return _upload_to_blob(blob_path=blob_path, content=content, content_type=content_type)
        except Exception as exc:
            if on_vercel():
                raise RuntimeError(
                    "Falha ao enviar arquivo para o Vercel Blob. "
                    "Verifique se o store Blob está conectado ao projeto."
                ) from exc
            raise

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


async def upload_lesson_pdf(content: bytes, extension: str, content_type: str) -> str:
    blob_path = f"lesson-pdfs/{uuid4().hex}{extension}"
    return await store_public_file(
        content=content,
        blob_path=blob_path,
        content_type=content_type,
        local_dir=UPLOAD_DIR,
        public_url_path="/uploads",
    )


def list_blob_prefix(*, prefix: str, limit: int = 20) -> list[dict[str, str | int]]:
    """Lista objetos no store (diagnóstico)."""
    if not blob_storage_enabled():
        return []
    from vercel.blob import BlobClient

    items: list[dict[str, str | int]] = []
    token = resolve_blob_read_write_token()
    with BlobClient(token=token) as client:
        result = client.list_objects(prefix=prefix, limit=limit)
        for blob in result.blobs:
            items.append(
                {
                    "pathname": blob.pathname,
                    "size": blob.size,
                    "url": blob.url,
                }
            )
    return items


def fetch_blob_bytes(pathname: str) -> tuple[bytes, str]:
    from vercel.blob import BlobClient

    clean = pathname.lstrip("/")
    token = resolve_blob_read_write_token()
    with BlobClient(token=token) as client:
        for access in ("private", "public"):
            try:
                result = client.get(clean, access=access)  # type: ignore[arg-type]
                return result.content, result.content_type or "application/octet-stream"
            except Exception:
                continue
    raise FileNotFoundError(clean)
