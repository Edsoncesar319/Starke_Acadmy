"""Geração de payload PIX (copia e cola) e QR Code conforme padrão EMV BR Code."""

from __future__ import annotations

import base64
import io
import re
import unicodedata


def _crc16_ccitt(payload: str) -> str:
    crc = 0xFFFF
    for byte in payload.encode("utf-8"):
        crc ^= byte << 8
        for _ in range(8):
            if crc & 0x8000:
                crc = (crc << 1) ^ 0x1021
            else:
                crc <<= 1
            crc &= 0xFFFF
    return f"{crc:04X}"


def _tlv(tag: str, value: str) -> str:
    return f"{tag}{len(value):02d}{value}"


def _sanitize_text(text: str, max_len: int, *, fallback: str) -> str:
    normalized = unicodedata.normalize("NFKD", text or "")
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    cleaned = re.sub(r"[\x00-\x1f]", "", ascii_only).strip()
    return (cleaned or fallback)[:max_len]


def _sanitize_txid(txid: str) -> str:
    value = (txid or "").strip()
    if value == "***":
        return "***"
    cleaned = re.sub(r"[^A-Za-z0-9]", "", value)[:25]
    return cleaned or "***"


def _normalize_pix_key(pix_key: str) -> str:
    key = pix_key.strip()
    if not key:
        raise ValueError("Chave PIX não configurada")

    if "@" in key:
        return key.lower()

    digits = re.sub(r"\D", "", key)
    if len(digits) == 11 and key.replace(".", "").replace("-", "").isdigit():
        return digits
    if len(digits) == 14 and key.replace(".", "").replace("/", "").replace("-", "").isdigit():
        return digits

    if re.match(r"^[\d\s()+-]+$", key) and len(digits) >= 10:
        if key.startswith("+"):
            return f"+{digits}" if not key.startswith("+55") else f"+{digits}"
        if len(digits) in (10, 11):
            return f"+55{digits}"
        return f"+{digits}"

    if re.match(
        r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
        key,
        re.I,
    ):
        return key.lower()

    return key


def build_pix_copia_cola(
    *,
    pix_key: str,
    amount_brl: float,
    merchant_name: str,
    merchant_city: str,
    txid: str,
    description: str | None = None,
) -> str:
    key = _normalize_pix_key(pix_key)
    name = _sanitize_text(merchant_name, 25, fallback="Starke Academy")
    city = _sanitize_text(merchant_city, 15, fallback="Sao Paulo")
    reference = _sanitize_txid(txid)

    merchant_account = _tlv("00", "br.gov.bcb.pix") + _tlv("01", key)
    info = _sanitize_text(description or "", 72, fallback="")
    merchant_account += _tlv("02", info)

    additional_data = _tlv("05", reference)

    payload_parts = [
        _tlv("00", "01"),
        _tlv("26", merchant_account),
        _tlv("52", "0000"),
        _tlv("53", "986"),
    ]

    amount = float(amount_brl or 0)
    if amount > 0:
        payload_parts.append(_tlv("54", f"{amount:.2f}"))

    payload_parts.extend(
        [
            _tlv("58", "BR"),
            _tlv("59", name),
            _tlv("60", city),
            _tlv("62", additional_data),
            "6304",
        ]
    )

    payload_without_crc = "".join(payload_parts)
    return payload_without_crc + _crc16_ccitt(payload_without_crc)


def pix_qr_code_base64(copia_cola: str) -> str:
    try:
        import qrcode

        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=10,
            border=4,
        )
        qr.add_data(copia_cola)
        qr.make(fit=True)
        image = qr.make_image(fill_color="black", back_color="white")
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode("ascii")
    except Exception:
        import segno

        buffer = io.BytesIO()
        segno.make(copia_cola, error="m").save(buffer, kind="png", scale=8, border=4)
        return base64.b64encode(buffer.getvalue()).decode("ascii")
