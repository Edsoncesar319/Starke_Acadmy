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


def _sanitize_ascii(text: str, max_len: int) -> str:
    normalized = unicodedata.normalize("NFKD", text)
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    cleaned = re.sub(r"[^A-Za-z0-9 ]", "", ascii_only).strip().upper()
    return (cleaned or "STARKE ACADEMY")[:max_len]


def _sanitize_txid(txid: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9]", "", txid)[:25]
    return cleaned or "COMPRA"


def build_pix_copia_cola(
    *,
    pix_key: str,
    amount_brl: float,
    merchant_name: str,
    merchant_city: str,
    txid: str,
) -> str:
    key = pix_key.strip()
    if not key:
        raise ValueError("Chave PIX não configurada")

    name = _sanitize_ascii(merchant_name, 25)
    city = _sanitize_ascii(merchant_city, 15)
    reference = _sanitize_txid(txid)
    amount = max(0.01, float(amount_brl))
    amount_str = f"{amount:.2f}"

    merchant_account = _tlv("00", "br.gov.bcb.pix") + _tlv("01", key)
    additional_data = _tlv("05", reference)

    payload_without_crc = (
        _tlv("00", "01")
        + _tlv("26", merchant_account)
        + _tlv("52", "0000")
        + _tlv("53", "986")
        + _tlv("54", amount_str)
        + _tlv("58", "BR")
        + _tlv("59", name)
        + _tlv("60", city)
        + _tlv("62", additional_data)
        + "6304"
    )
    return payload_without_crc + _crc16_ccitt(payload_without_crc)


def pix_qr_code_base64(copia_cola: str) -> str:
    try:
        import qrcode

        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=8,
            border=2,
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
        segno.make(copia_cola, error="m").save(buffer, kind="png", scale=6, border=2)
        return base64.b64encode(buffer.getvalue()).decode("ascii")
