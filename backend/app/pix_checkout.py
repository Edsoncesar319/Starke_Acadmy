"""Checkout PIX: Mercado Pago (webhook), chave estática ou mock em dev."""

from __future__ import annotations

import json
import os
from decimal import Decimal, ROUND_HALF_UP
from typing import Any
from uuid import uuid4

from fastapi import HTTPException, Request
from sqlalchemy.orm import Session

from .models import Course, PaymentEvent, Purchase, User
from .payments import finalize_purchase_as_paid
from .pix_brcode import build_pix_direct_key_brcode, pix_qr_code_base64
from .storage import on_vercel

_MOCK_PIX_QR_BASE64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


def _pix_receiver_key() -> str | None:
    key = os.getenv("PIX_RECEIVER_KEY", "").strip()
    return key or None


def _pix_merchant_name() -> str:
    return os.getenv("PIX_MERCHANT_NAME", "Starke Academy").strip() or "Starke Academy"


def _pix_merchant_city() -> str:
    return os.getenv("PIX_MERCHANT_CITY", "Sao Paulo").strip() or "Sao Paulo"


def mercadopago_enabled() -> bool:
    return bool(os.getenv("MERCADOPAGO_ACCESS_TOKEN") or os.getenv("MP_ACCESS_TOKEN"))


def payment_status() -> dict[str, Any]:
    provider = "none"
    try:
        provider = resolve_pix_provider()
    except HTTPException as exc:
        provider = f"error:{exc.detail}"

    return {
        "provider": provider,
        "mercadopago_configured": mercadopago_enabled(),
        "pix_receiver_configured": bool(_pix_receiver_key()),
        "mock_enabled": _pix_mock_enabled(),
        "webhook_url": webhook_url(),
    }


def _pix_mock_enabled() -> bool:
    if _pix_receiver_key():
        return False
    flag = os.getenv("PIX_CHECKOUT_MOCK", "").strip().lower()
    if flag in ("1", "true", "yes"):
        return True
    if flag in ("0", "false", "no"):
        return False
    if on_vercel():
        return False
    return not mercadopago_enabled()


def resolve_pix_provider() -> str:
    explicit = os.getenv("PIX_PAYMENT_PROVIDER", "").strip().lower()
    if explicit in ("mercadopago", "mp"):
        if not mercadopago_enabled():
            raise HTTPException(
                status_code=503,
                detail="PIX_PAYMENT_PROVIDER=mercadopago, mas MERCADOPAGO_ACCESS_TOKEN não está definido.",
            )
        return "mercadopago"
    if explicit in ("static", "pix"):
        if not _pix_receiver_key():
            raise HTTPException(
                status_code=503,
                detail="PIX_PAYMENT_PROVIDER=static, mas PIX_RECEIVER_KEY não está definido.",
            )
        return "static"
    if explicit in ("mock",):
        return "mock"

    if mercadopago_enabled():
        return "mercadopago"
    if _pix_receiver_key():
        return "static"
    if _pix_mock_enabled():
        return "mock"
    return "none"


def public_site_base_url() -> str:
    custom = os.getenv("SITE_PUBLIC_URL", "").strip().rstrip("/")
    if custom:
        return custom
    vercel_url = os.getenv("VERCEL_URL", "").strip()
    if vercel_url:
        return f"https://{vercel_url}"
    api_base = os.getenv("API_PUBLIC_BASE_URL", "").strip().rstrip("/")
    if api_base.startswith("http"):
        return api_base.removesuffix("/api")
    return "http://127.0.0.1:8000"


def webhook_url() -> str:
    return f"{public_site_base_url()}/api/payments/webhook"


def get_mp_sdk():
    token = os.getenv("MERCADOPAGO_ACCESS_TOKEN") or os.getenv("MP_ACCESS_TOKEN")
    if not token:
        raise HTTPException(
            status_code=503,
            detail=(
                "Mercado Pago não configurado. Defina MERCADOPAGO_ACCESS_TOKEN na Vercel "
                "ou use PIX_RECEIVER_KEY / PIX_CHECKOUT_MOCK=true em dev."
            ),
        )
    import mercadopago  # type: ignore

    return mercadopago.SDK(token)


def _get_mp_sdk_optional():
    if not mercadopago_enabled():
        return None
    try:
        return get_mp_sdk()
    except HTTPException:
        return None


def _checkout_payload(
    purchase: Purchase,
    *,
    provider: str,
    provider_reference: str,
    qr_code_base64: str,
    qr_code: str,
    ticket_url: str | None = None,
    pix_key: str | None = None,
    amount_brl: float | None = None,
    merchant_name: str | None = None,
) -> dict[str, Any]:
    return {
        "purchase": purchase,
        "provider": provider,
        "provider_reference": provider_reference,
        "qr_code_base64": qr_code_base64,
        "qr_code": qr_code,
        "ticket_url": ticket_url,
        "pix_key": pix_key,
        "amount_brl": amount_brl,
        "merchant_name": merchant_name,
    }


def _static_pix_checkout_response(purchase: Purchase, course: Course, db: Session) -> dict[str, Any]:
    pix_key = _pix_receiver_key()
    if not pix_key:
        raise HTTPException(status_code=503, detail="Chave PIX não configurada (PIX_RECEIVER_KEY).")

    merchant_name = _pix_merchant_name()
    txid = f"COMPRA{purchase.id}"
    amount_brl = float(
        (Decimal(purchase.amount_cents) / Decimal(100)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    )
    copia_cola = build_pix_direct_key_brcode(
        pix_key=pix_key,
        merchant_name=merchant_name,
        merchant_city=_pix_merchant_city(),
    )
    try:
        qr_base64 = pix_qr_code_base64(copia_cola)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Não foi possível gerar o QR Code PIX: {exc}",
        ) from exc

    purchase.provider = "pix"
    purchase.provider_reference = txid
    db.commit()
    db.refresh(purchase)
    return _checkout_payload(
        purchase,
        provider="pix",
        provider_reference=txid,
        qr_code_base64=qr_base64,
        qr_code=copia_cola,
        pix_key=pix_key.strip(),
        amount_brl=amount_brl,
        merchant_name=merchant_name,
    )


def _mock_pix_checkout_response(purchase: Purchase, db: Session) -> dict[str, Any]:
    ref = f"mock-{purchase.id}"
    purchase.provider = "mock"
    purchase.provider_reference = ref
    db.commit()
    db.refresh(purchase)
    return _checkout_payload(
        purchase,
        provider="mock",
        provider_reference=ref,
        qr_code_base64=_MOCK_PIX_QR_BASE64,
        qr_code=f"PIX-DEV-MOCK-{purchase.id}",
    )


def _split_payer_name(name: str | None) -> tuple[str, str]:
    parts = [part for part in (name or "Aluno Starke").split() if part]
    if not parts:
        return "Aluno", "Starke"
    if len(parts) == 1:
        return parts[0], "Starke"
    return parts[0], " ".join(parts[1:])


def _mp_payment_to_checkout(purchase: Purchase, payment: dict[str, Any]) -> dict[str, Any]:
    tx = ((payment.get("point_of_interaction") or {}).get("transaction_data") or {})
    qr_code_base64 = str(tx.get("qr_code_base64") or "")
    qr_code = str(tx.get("qr_code") or "")
    ticket_url = tx.get("ticket_url")
    if not qr_code_base64 or not qr_code:
        raise HTTPException(status_code=502, detail="Mercado Pago não retornou dados do PIX.")
    mp_payment_id = str(payment.get("id") or purchase.provider_reference or "")
    return _checkout_payload(
        purchase,
        provider="mercadopago",
        provider_reference=mp_payment_id,
        qr_code_base64=qr_code_base64,
        qr_code=qr_code,
        ticket_url=str(ticket_url) if ticket_url else None,
    )


def _create_mercadopago_payment(
    db: Session,
    purchase: Purchase,
    course: Course,
    user: User,
) -> dict[str, Any]:
    sdk = get_mp_sdk()
    first_name, last_name = _split_payer_name(user.name)
    payment_data = {
        "transaction_amount": float(purchase.amount_cents) / 100.0,
        "description": f"Curso: {course.title}",
        "payment_method_id": "pix",
        "external_reference": str(purchase.id),
        "notification_url": webhook_url(),
        "payer": {
            "email": user.email,
            "first_name": first_name,
            "last_name": last_name,
        },
    }

    try:
        from mercadopago.config import RequestOptions  # type: ignore

        request_options = RequestOptions()
        request_options.custom_headers = {"x-idempotency-key": uuid4().hex}
        result = sdk.payment().create(payment_data, request_options)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Falha ao criar cobrança PIX no Mercado Pago: {exc}",
        ) from exc

    status_code = result.get("status")
    if status_code and status_code >= 400:
        message = (result.get("response") or {}).get("message") or result
        raise HTTPException(status_code=502, detail=f"Mercado Pago recusou o PIX: {message}")

    payment = result.get("response") or {}
    mp_payment_id = str(payment.get("id") or "")
    purchase.provider = "mercadopago"
    purchase.provider_reference = mp_payment_id or None
    db.commit()
    db.refresh(purchase)
    return _mp_payment_to_checkout(purchase, payment)


def _refresh_mercadopago_checkout(purchase: Purchase) -> dict[str, Any] | None:
    if purchase.provider != "mercadopago" or not purchase.provider_reference:
        return None
    sdk = _get_mp_sdk_optional()
    if not sdk:
        return None
    try:
        result = sdk.payment().get(str(purchase.provider_reference))
        payment = result.get("response") or {}
        status_mp = str(payment.get("status") or "")
        if status_mp == "approved":
            return None
        if status_mp in {"cancelled", "rejected"}:
            return None
        return _mp_payment_to_checkout(purchase, payment)
    except Exception:
        return None


def _find_reusable_pending_purchase(db: Session, user_id: int, course_id: int) -> Purchase | None:
    return (
        db.query(Purchase)
        .filter(
            Purchase.user_id == user_id,
            Purchase.course_id == course_id,
            Purchase.status == "pending",
        )
        .order_by(Purchase.created_at.desc())
        .first()
    )


def create_pix_checkout(db: Session, user: User, course: Course) -> dict[str, Any]:
    provider = resolve_pix_provider()
    if provider == "none":
        raise HTTPException(
            status_code=503,
            detail=(
                "Pagamento PIX indisponível. Configure MERCADOPAGO_ACCESS_TOKEN na Vercel "
                "(recomendado) ou PIX_RECEIVER_KEY. Em dev local: PIX_CHECKOUT_MOCK=true."
            ),
        )

    existing = _find_reusable_pending_purchase(db, user.id, course.id)
    if existing:
        if existing.provider == "mercadopago":
            refreshed = _refresh_mercadopago_checkout(existing)
            if refreshed:
                return refreshed
        elif existing.provider == "pix":
            return _static_pix_checkout_response(existing, course, db)
        elif existing.provider == "mock":
            return _mock_pix_checkout_response(existing, db)

    purchase = Purchase(
        user_id=user.id,
        course_id=course.id,
        amount_cents=max(0, int(round((course.price or 0) * 100))),
        currency="BRL",
        status="pending",
        provider=provider,
    )
    db.add(purchase)
    db.commit()
    db.refresh(purchase)

    if provider == "static":
        return _static_pix_checkout_response(purchase, course, db)
    if provider == "mock":
        return _mock_pix_checkout_response(purchase, db)
    return _create_mercadopago_payment(db, purchase, course, user)


def apply_mercadopago_payment(db: Session, payment: dict[str, Any], event: PaymentEvent | None = None) -> bool:
    external_ref = str(payment.get("external_reference") or "")
    purchase_id = int(external_ref) if external_ref.isdigit() else 0
    if not purchase_id:
        return False

    purchase = db.query(Purchase).filter(Purchase.id == purchase_id).first()
    if not purchase:
        return False

    status_mp = str(payment.get("status") or "")
    if event:
        event.purchase_id = purchase.id
        event.provider = "mercadopago"
        event.event_type = f"payment.{status_mp}"

    purchase.provider = "mercadopago"
    purchase.provider_reference = str(payment.get("id") or purchase.provider_reference or "")

    if status_mp == "approved":
        if purchase.status != "paid":
            purchase.status = "approved"
            db.commit()
        return True

    if status_mp in {"cancelled", "rejected", "refunded", "charged_back"}:
        purchase.status = status_mp
        db.commit()
        return True

    purchase.status = "pending"
    db.commit()
    return True


def _extract_payment_id_from_body(body: dict[str, Any]) -> str | None:
    payment_id = (body.get("data") or {}).get("id")
    if payment_id:
        return str(payment_id)
    if body.get("id"):
        return str(body.get("id"))
    return None


async def process_payment_webhook(request: Request, db: Session) -> dict[str, bool]:
    raw = await request.body()
    payload_text = raw.decode("utf-8", errors="replace")

    event = PaymentEvent(
        purchase_id=0,
        provider="unknown",
        event_type="webhook",
        payload=payload_text or request.url.query,
    )
    db.add(event)
    db.commit()

    payment_id: str | None = None
    body: dict[str, Any] = {}

    if payload_text.strip():
        try:
            body = json.loads(payload_text)
        except json.JSONDecodeError:
            body = {}
        payment_id = _extract_payment_id_from_body(body)

    if not payment_id:
        topic = request.query_params.get("topic") or request.query_params.get("type")
        query_id = request.query_params.get("id") or request.query_params.get("data.id")
        if topic in {"payment", "merchant_order"} and query_id:
            payment_id = str(query_id)

    if not payment_id:
        return {"ok": True}

    sdk = _get_mp_sdk_optional()
    if not sdk:
        return {"ok": True}

    try:
        result = sdk.payment().get(str(payment_id))
        payment = result.get("response") or {}
        if payment:
            apply_mercadopago_payment(db, payment, event)
            db.commit()
    except Exception:
        return {"ok": True}

    return {"ok": True}


def student_may_confirm_payment(purchase: Purchase) -> bool:
    return purchase.provider in {"pix", "mock"}


def confirm_payment_manually(db: Session, purchase: Purchase) -> Purchase:
    if not student_may_confirm_payment(purchase):
        raise HTTPException(
            status_code=400,
            detail=(
                "Este PIX será confirmado automaticamente após o pagamento. "
                "Aguarde alguns instantes — a matrícula é liberada assim que o Mercado Pago notificar o sistema."
            ),
        )
    finalize_purchase_as_paid(db, purchase)
    return purchase
