"""Controle de acesso a cursos pagos: matrícula e aulas só após pagamento confirmado."""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Session

from .models import Course, Enrollment, Purchase, User


def has_paid_purchase(db: Session, user_id: int, course_id: int) -> bool:
    return (
        db.query(Purchase)
        .filter(
            Purchase.user_id == user_id,
            Purchase.course_id == course_id,
            Purchase.status == "paid",
        )
        .first()
        is not None
    )


def is_free_course(course: Course | None) -> bool:
    return course is not None and (course.price or 0) <= 0


def has_course_access(db: Session, user: User, course_id: int) -> bool:
    if user.is_admin or user.is_instructor:
        return True

    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        return False

    enrolled = (
        db.query(Enrollment)
        .filter(Enrollment.user_id == user.id, Enrollment.course_id == course_id)
        .first()
    )
    if not enrolled:
        return False

    if is_free_course(course):
        return True

    return has_paid_purchase(db, user.id, course_id)


def assert_student_course_access(db: Session, user: User, course_id: int) -> None:
    if user.is_admin or user.is_instructor:
        return

    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Curso não encontrado")

    enrolled = (
        db.query(Enrollment)
        .filter(Enrollment.user_id == user.id, Enrollment.course_id == course_id)
        .first()
    )
    if not enrolled:
        raise HTTPException(
            status_code=403,
            detail="Matricule-se no curso para acessar as aulas.",
        )

    if not is_free_course(course) and not has_paid_purchase(db, user.id, course_id):
        raise HTTPException(
            status_code=402,
            detail="Pagamento pendente. Conclua o PIX para liberar as aulas deste curso.",
        )
