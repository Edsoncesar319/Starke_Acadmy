"""Progresso por capítulo: cada capítulo vale 10% do curso (5% vídeo + 5% avaliação)."""

from __future__ import annotations

from sqlalchemy.orm import Session

from .models import Enrollment, Lesson, LessonProgress

# Cada capítulo representa no máximo 10% do progresso total do curso.
CHAPTER_COURSE_WEIGHT = 10
CHAPTER_HALF_WEIGHT = CHAPTER_COURSE_WEIGHT // 2  # 5% vídeo ou 5% avaliação


def chapter_progress_percent(video_completed: bool, quiz_passed: bool) -> int:
    """Progresso interno do capítulo (0–100%): 50% vídeo + 50% avaliação."""
    pct = 0
    if video_completed:
        pct += 50
    if quiz_passed:
        pct += 50
    return pct


def chapter_course_contribution(video_completed: bool, quiz_passed: bool) -> int:
    """Quanto este capítulo soma no curso (0–10%)."""
    contrib = 0
    if video_completed:
        contrib += CHAPTER_HALF_WEIGHT
    if quiz_passed:
        contrib += CHAPTER_HALF_WEIGHT
    return contrib


def get_or_create_lesson_progress(db: Session, user_id: int, lesson_id: int) -> LessonProgress:
    row = (
        db.query(LessonProgress)
        .filter(LessonProgress.user_id == user_id, LessonProgress.lesson_id == lesson_id)
        .first()
    )
    if row:
        return row

    row = LessonProgress(user_id=user_id, lesson_id=lesson_id, video_completed=False, quiz_passed=False)
    db.add(row)
    db.flush()
    return row


def compute_course_progress(db: Session, user_id: int, course_id: int) -> int:
    lessons = db.query(Lesson).filter(Lesson.course_id == course_id).order_by(Lesson.id.asc()).all()
    if not lessons:
        return 0

    total = 0
    for lesson in lessons:
        progress = (
            db.query(LessonProgress)
            .filter(LessonProgress.user_id == user_id, LessonProgress.lesson_id == lesson.id)
            .first()
        )
        if progress:
            total += chapter_course_contribution(progress.video_completed, progress.quiz_passed)

    return min(100, total)


def sync_enrollment_progress(db: Session, user_id: int, course_id: int) -> Enrollment | None:
    enrollment = (
        db.query(Enrollment)
        .filter(Enrollment.user_id == user_id, Enrollment.course_id == course_id)
        .first()
    )
    if not enrollment:
        return None

    enrollment.progress_percentage = compute_course_progress(db, user_id, course_id)
    db.commit()
    db.refresh(enrollment)
    return enrollment


def mark_video_completed(db: Session, user_id: int, lesson_id: int) -> tuple[LessonProgress, int, int, int]:
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise ValueError("Aula não encontrada.")

    progress = get_or_create_lesson_progress(db, user_id, lesson_id)
    progress.video_completed = True
    db.flush()

    enrollment = sync_enrollment_progress(db, user_id, lesson.course_id)
    chapter_pct = chapter_progress_percent(progress.video_completed, progress.quiz_passed)
    course_contrib = chapter_course_contribution(progress.video_completed, progress.quiz_passed)
    course_pct = enrollment.progress_percentage if enrollment else 0
    return progress, chapter_pct, course_contrib, course_pct


def mark_quiz_passed(db: Session, user_id: int, lesson_id: int) -> tuple[LessonProgress, int, int, int]:
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise ValueError("Aula não encontrada.")

    progress = get_or_create_lesson_progress(db, user_id, lesson_id)
    progress.quiz_passed = True
    db.flush()

    enrollment = sync_enrollment_progress(db, user_id, lesson.course_id)
    chapter_pct = chapter_progress_percent(progress.video_completed, progress.quiz_passed)
    course_contrib = chapter_course_contribution(progress.video_completed, progress.quiz_passed)
    course_pct = enrollment.progress_percentage if enrollment else 0
    return progress, chapter_pct, course_contrib, course_pct


def lesson_progress_dict(progress: LessonProgress | None) -> dict:
    if not progress:
        return {
            "lesson_id": 0,
            "video_completed": False,
            "quiz_passed": False,
            "chapter_progress": 0,
            "course_contribution": 0,
        }
    return {
        "lesson_id": progress.lesson_id,
        "video_completed": progress.video_completed,
        "quiz_passed": progress.quiz_passed,
        "chapter_progress": chapter_progress_percent(progress.video_completed, progress.quiz_passed),
        "course_contribution": chapter_course_contribution(progress.video_completed, progress.quiz_passed),
    }


def course_lesson_progress_list(db: Session, user_id: int, course_id: int) -> dict:
    lessons = db.query(Lesson).filter(Lesson.course_id == course_id).order_by(Lesson.id.asc()).all()
    items: list[dict] = []
    for lesson in lessons:
        progress = (
            db.query(LessonProgress)
            .filter(LessonProgress.user_id == user_id, LessonProgress.lesson_id == lesson.id)
            .first()
        )
        data = lesson_progress_dict(progress)
        data["lesson_id"] = lesson.id
        items.append(data)

    return {
        "course_id": course_id,
        "course_progress": compute_course_progress(db, user_id, course_id),
        "chapter_weight_percent": CHAPTER_COURSE_WEIGHT,
        "lessons": items,
    }
