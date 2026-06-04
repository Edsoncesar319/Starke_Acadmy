"""Vercel Blob client upload (browser → Blob) for large lesson videos."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from typing import Any

from fastapi import HTTPException, Request

from .storage import lesson_video_blob_access

VIDEO_TYPES = [
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "application/octet-stream",
    "binary/octet-stream",
]

MAX_VIDEO_BYTES = 100 * 1024 * 1024


def _blob_read_write_token() -> str:
    return os.getenv("BLOB_READ_WRITE_TOKEN", "").strip()


def _parse_store_id(token: str) -> str | None:
    parts = token.split("_")
    return parts[3] if len(parts) > 3 else None


def _sign_payload(payload: str, token: str) -> str:
    return hmac.new(token.encode(), payload.encode(), hashlib.sha256).hexdigest()


def _generate_client_token(*, read_write_token: str, options: dict[str, Any]) -> str:
    store_id = _parse_store_id(read_write_token)
    if not store_id:
        raise HTTPException(status_code=503, detail="Token do Vercel Blob inválido")

    payload_obj = dict(options)
    payload_obj.setdefault("validUntil", int(time.time() * 1000) + 3600 * 1000)
    payload_json = json.dumps(payload_obj, separators=(",", ":"))
    payload_b64 = base64.b64encode(payload_json.encode()).decode()
    secured_key = _sign_payload(payload_b64, read_write_token)
    token_blob = base64.b64encode(f"{secured_key}.{payload_b64}".encode()).decode()
    return f"vercel_blob_client_{store_id}_{token_blob}"


def _verify_callback_signature(*, read_write_token: str, signature: str, body: str) -> bool:
    if not signature:
        return False
    digest = hmac.new(read_write_token.encode(), body.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, signature)


def _lesson_video_pathname(pathname: str) -> str:
    safe_path = str(pathname or "lesson-video.mp4").lstrip("/")
    if safe_path.startswith("lesson-videos/"):
        return safe_path
    return f"lesson-videos/{safe_path}"


async def handle_blob_client_upload(
    request: Request,
    body: dict[str, Any],
    raw_body: bytes,
) -> dict[str, Any]:
    read_write_token = _blob_read_write_token()
    if not read_write_token:
        raise HTTPException(status_code=503, detail="Upload indisponível: Vercel Blob não configurado")

    event_type = body.get("type")
    if event_type == "blob.generate-client-token":
        return _handle_generate_client_token(body)
    if event_type == "blob.upload-completed":
        return _handle_upload_completed(request, raw_body, read_write_token)
    raise HTTPException(status_code=400, detail="Tipo de evento inválido")


def _handle_generate_client_token(body: dict[str, Any]) -> dict[str, Any]:
    payload = body.get("payload") or {}
    pathname = _lesson_video_pathname(str(payload.get("pathname") or "lesson-video.mp4"))
    read_write_token = _blob_read_write_token()
    client_token = _generate_client_token(
        read_write_token=read_write_token,
        options={
            "access": lesson_video_blob_access(),
            "allowedContentTypes": VIDEO_TYPES,
            "maximumSizeInBytes": MAX_VIDEO_BYTES,
            "addRandomSuffix": True,
            "pathname": pathname,
            "cacheControlMaxAge": 31536000,
        },
    )
    return {"type": "blob.generate-client-token", "clientToken": client_token}


def _handle_upload_completed(
    request: Request,
    raw_body: bytes,
    read_write_token: str,
) -> dict[str, Any]:
    signature = request.headers.get("x-vercel-signature") or ""
    body_text = raw_body.decode()
    if not _verify_callback_signature(
        read_write_token=read_write_token,
        signature=signature,
        body=body_text,
    ):
        raise HTTPException(status_code=400, detail="Assinatura de callback inválida")
    return {"type": "blob.upload-completed", "response": "ok"}
