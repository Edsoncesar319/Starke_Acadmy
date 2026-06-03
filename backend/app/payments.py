"""Confirmação de pagamento e envio de comprovante ao aluno."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from .models import Course, Enrollment, Purchase, StudentMessage, User


def _format_brl(amount_cents: int) -> str:
    value = (amount_cents or 0) / 100.0
    formatted = f"{value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {formatted}"


def _system_admin_id(db: Session) -> int | None:
    admin = db.query(User).filter(User.is_admin.is_(True)).order_by(User.id.asc()).first()
    return admin.id if admin else None


def _build_receipt_message(purchase: Purchase, course: Course | None) -> tuple[str, str]:
    course_title = course.title if course else f"Curso #{purchase.course_id}"
    paid_at = purchase.paid_at or datetime.utcnow()
    paid_label = paid_at.strftime("%d/%m/%Y %H:%M")
    reference = purchase.provider_reference or f"COMPRA{purchase.id}"
    amount = _format_brl(purchase.amount_cents)

    subject = f"Comprovante de pagamento #{purchase.id} — {course_title}"
    details = (
        f"Pagamento confirmado com sucesso.\n\n"
        f"Comprovante nº {purchase.id}\n"
        f"Curso: {course_title}\n"
        f"Valor pago: {amount}\n"
        f"Referência PIX: {reference}\n"
        f"Data da confirmação: {paid_label}\n"
        f"Status: PAGO\n\n"
        f"Sua matrícula neste curso foi liberada. Acesse o catálogo ou a área de aulas "
        f"para começar a estudar.\n\n"
        f"— Starke Academy"
    )
    return subject, details


def _ensure_enrollment(db: Session, purchase: Purchase) -> None:
    existing = (
        db.query(Enrollment)
        .filter(
            Enrollment.user_id == purchase.user_id,
            Enrollment.course_id == purchase.course_id,
        )
        .first()
    )
    if existing:
        return

    db.add(
        Enrollment(
            user_id=purchase.user_id,
            course_id=purchase.course_id,
            progress_percentage=0,
            last_accessed=datetime.utcnow(),
        )
    )


def finalize_purchase_as_paid(db: Session, purchase: Purchase) -> StudentMessage | None:
    """
    Marca compra como paga, matricula o aluno (se necessário) e envia comprovante no chat.
    Idempotente se já estiver paga.
    """
    already_paid = purchase.status == "paid"

    if not already_paid:
        purchase.status = "paid"
        purchase.paid_at = datetime.utcnow()

    course = db.query(Course).filter(Course.id == purchase.course_id).first()
    _ensure_enrollment(db, purchase)

    admin_id = _system_admin_id(db)
    if not admin_id:
        db.commit()
        db.refresh(purchase)
        return None

    subject, details = _build_receipt_message(purchase, course)

    existing_receipt = (
        db.query(StudentMessage)
        .filter(
            StudentMessage.user_id == purchase.user_id,
            StudentMessage.subject == subject,
        )
        .order_by(StudentMessage.id.desc())
        .first()
    )
    if already_paid and existing_receipt:
        db.commit()
        db.refresh(purchase)
        return existing_receipt

    message = StudentMessage(
        user_id=purchase.user_id,
        sent_by_admin_id=admin_id,
        course_id=purchase.course_id,
        subject=subject,
        details=details,
    )
    db.add(message)
    db.commit()
    db.refresh(purchase)
    db.refresh(message)
    return message
