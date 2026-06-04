"""Resolução de credenciais Vercel Blob (store padrão ou nomeado, ex. Uploads)."""
from __future__ import annotations

import os


def _trim(value: str | None) -> str:
    return value.strip() if value else ""


def _first_env(*names: str) -> str:
    for name in names:
        value = _trim(os.getenv(name))
        if value:
            return value
    return ""


def _named_store_prefix() -> str:
    explicit = _trim(os.getenv("BLOB_STORE_NAME"))
    if explicit:
        return explicit
    if _trim(os.getenv("Uploads_STORE_ID")) or _trim(os.getenv("UPLOADS_STORE_ID")):
        return "Uploads"
    return ""


def resolve_blob_store_id() -> str:
    uploads = _first_env("Uploads_STORE_ID", "UPLOADS_STORE_ID")
    if uploads:
        return uploads

    prefix = _named_store_prefix()
    named = (
        [f"{prefix}_STORE_ID", f"{prefix.upper()}_STORE_ID"]
        if prefix
        else []
    )
    return _first_env("BLOB_STORE_ID", "VERCEL_BLOB_STORE_ID", *named)


def resolve_blob_read_write_token() -> str:
    uploads_store = _first_env("Uploads_STORE_ID", "UPLOADS_STORE_ID")
    uploads_token = _first_env("Uploads_READ_WRITE_TOKEN", "UPLOADS_READ_WRITE_TOKEN")
    if uploads_store and uploads_token:
        return uploads_token
    if uploads_token:
        return uploads_token

    prefix = _named_store_prefix()
    named = (
        [
            f"{prefix}_READ_WRITE_TOKEN",
            f"{prefix.upper()}_READ_WRITE_TOKEN",
        ]
        if prefix
        else []
    )
    direct = _first_env("BLOB_READ_WRITE_TOKEN", "VERCEL_BLOB_READ_WRITE_TOKEN", *named)
    if direct:
        return direct

    for key, value in os.environ.items():
        if key.endswith("_READ_WRITE_TOKEN") and _trim(value):
            return _trim(value)
    return ""


def blob_storage_enabled() -> bool:
    return bool(resolve_blob_read_write_token() or resolve_blob_store_id())


def resolve_blob_access() -> str:
    """Espelha access: 'public' + storeId da documentação Vercel."""
    pref = _trim(os.getenv("BLOB_ACCESS")).lower()
    if pref == "private":
        return "private"
    if pref == "public":
        return "public"
    if resolve_blob_store_id():
        return "public"
    return "private"
