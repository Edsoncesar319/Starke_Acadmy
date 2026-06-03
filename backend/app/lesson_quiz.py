"""Questões contextualizadas por capítulo (aula)."""

from __future__ import annotations

import json

from sqlalchemy.orm import Session

from .models import Lesson, LessonQuizQuestion

QUIZ_SIZE = 10
OPTIONS_PER_QUESTION = 4


def default_questions() -> list[dict]:
    return [
        {
            "prompt": "Qual é a melhor atitude ao iniciar o estudo de um novo capítulo?",
            "options": ["Ignorar o objetivo", "Definir objetivo claro", "Estudar sem foco", "Pular exemplos"],
            "correct_index": 1,
        },
        {
            "prompt": "Para fixar o conteúdo, a prática recomendada é:",
            "options": ["Apenas assistir", "Repetir sem entender", "Aplicar em exercícios", "Memorizar sem contexto"],
            "correct_index": 2,
        },
        {
            "prompt": "Ao encontrar dificuldade em um tópico, o ideal é:",
            "options": ["Abandonar o capítulo", "Rever o conceito-base", "Ignorar e avançar", "Trocar de curso"],
            "correct_index": 1,
        },
        {
            "prompt": "Qual estratégia melhora retenção de longo prazo?",
            "options": ["Revisão espaçada", "Estudo único e longo", "Sem anotações", "Somente leitura passiva"],
            "correct_index": 0,
        },
        {
            "prompt": "No contexto do capítulo, exemplos práticos servem para:",
            "options": [
                "Confundir o aluno",
                "Substituir teoria",
                "Conectar teoria e aplicação",
                "Aumentar tempo sem ganho",
            ],
            "correct_index": 2,
        },
        {
            "prompt": "Ao final de cada seção, o aluno deve principalmente:",
            "options": ["Checar entendimento", "Pular para prova", "Encerrar sem revisão", "Copiar tudo sem filtrar"],
            "correct_index": 0,
        },
        {
            "prompt": "Um bom indicador de domínio do capítulo é:",
            "options": ["Saber explicar o conteúdo", "Apenas reconhecer termos", "Ter visto o vídeo uma vez", "Não errar nunca"],
            "correct_index": 0,
        },
        {
            "prompt": "Quando revisar erro em exercício, o foco correto é:",
            "options": ["Só ver o gabarito", "Entender causa do erro", "Refazer sem analisar", "Ignorar o resultado"],
            "correct_index": 1,
        },
        {
            "prompt": "Para evoluir no capítulo, feedback deve ser:",
            "options": ["Específico e acionável", "Genérico e vago", "Raro e tardio", "Sem relação com conteúdo"],
            "correct_index": 0,
        },
        {
            "prompt": "A melhor forma de concluir o capítulo é:",
            "options": [
                "Passar para o próximo sem validar",
                "Atingir desempenho mínimo na avaliação",
                "Assistir novamente sem prática",
                "Parar no meio do conteúdo",
            ],
            "correct_index": 1,
        },
    ]


def _parse_options(raw: str) -> list[str]:
    try:
        options = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(options, list):
        return []
    return [str(item) for item in options]


def _serialize_options(options: list[str]) -> str:
    return json.dumps(options, ensure_ascii=False)


def ensure_lesson_quiz(db: Session, lesson_id: int) -> list[LessonQuizQuestion]:
    rows = (
        db.query(LessonQuizQuestion)
        .filter(LessonQuizQuestion.lesson_id == lesson_id)
        .order_by(LessonQuizQuestion.position.asc())
        .all()
    )
    if len(rows) >= QUIZ_SIZE:
        return rows[:QUIZ_SIZE]

    if rows:
        db.query(LessonQuizQuestion).filter(LessonQuizQuestion.lesson_id == lesson_id).delete()
        db.flush()

    defaults = default_questions()
    created: list[LessonQuizQuestion] = []
    for index, item in enumerate(defaults):
        row = LessonQuizQuestion(
            lesson_id=lesson_id,
            position=index,
            prompt=item["prompt"],
            options_json=_serialize_options(item["options"]),
            correct_index=item["correct_index"],
        )
        db.add(row)
        created.append(row)
    db.commit()
    for row in created:
        db.refresh(row)
    return created


def get_lesson_quiz_rows(db: Session, lesson_id: int) -> list[LessonQuizQuestion]:
    return ensure_lesson_quiz(db, lesson_id)


def question_to_student_dict(row: LessonQuizQuestion) -> dict:
    return {
        "position": row.position,
        "prompt": row.prompt,
        "options": _parse_options(row.options_json),
    }


def question_to_admin_dict(row: LessonQuizQuestion) -> dict:
    data = question_to_student_dict(row)
    data["correct_index"] = row.correct_index
    return data


def validate_questions_payload(questions: list[dict]) -> list[dict]:
    if len(questions) != QUIZ_SIZE:
        raise ValueError(f"A avaliação deve ter exatamente {QUIZ_SIZE} questões.")

    normalized: list[dict] = []
    for index, item in enumerate(questions):
        prompt = (item.get("prompt") or "").strip()
        if not prompt:
            raise ValueError(f"Questão {index + 1}: enunciado obrigatório.")

        options = item.get("options") or []
        if not isinstance(options, list) or len(options) != OPTIONS_PER_QUESTION:
            raise ValueError(f"Questão {index + 1}: informe {OPTIONS_PER_QUESTION} alternativas.")

        clean_options = [str(option).strip() for option in options]
        if any(not option for option in clean_options):
            raise ValueError(f"Questão {index + 1}: alternativas não podem ficar vazias.")

        correct_index = item.get("correct_index")
        if isinstance(correct_index, bool) or correct_index is None:
            raise ValueError(f"Questão {index + 1}: selecione a alternativa correta.")
        try:
            correct_index = int(correct_index)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Questão {index + 1}: selecione a alternativa correta.") from exc
        if correct_index < 0 or correct_index >= OPTIONS_PER_QUESTION:
            raise ValueError(f"Questão {index + 1}: selecione a alternativa correta.")

        normalized.append(
            {
                "position": index,
                "prompt": prompt,
                "options": clean_options,
                "correct_index": correct_index,
            }
        )
    return normalized


def save_lesson_quiz(db: Session, lesson_id: int, questions: list[dict]) -> list[LessonQuizQuestion]:
    normalized = validate_questions_payload(questions)
    db.query(LessonQuizQuestion).filter(LessonQuizQuestion.lesson_id == lesson_id).delete()
    db.flush()

    saved: list[LessonQuizQuestion] = []
    for item in normalized:
        row = LessonQuizQuestion(
            lesson_id=lesson_id,
            position=item["position"],
            prompt=item["prompt"],
            options_json=_serialize_options(item["options"]),
            correct_index=item["correct_index"],
        )
        db.add(row)
        saved.append(row)
    db.commit()
    for row in saved:
        db.refresh(row)
    return saved


def score_quiz_answers(rows: list[LessonQuizQuestion], answers: list[int]) -> tuple[int, bool]:
    if len(answers) != QUIZ_SIZE:
        raise ValueError(f"Envie respostas para as {QUIZ_SIZE} questões.")
    if any(answer < 0 or answer >= OPTIONS_PER_QUESTION for answer in answers):
        raise ValueError("Respostas inválidas.")

    score = sum(1 for row, answer in zip(rows, answers, strict=True) if answer == row.correct_index)
    passed = score >= 8
    return score, passed


def seed_quizzes_for_existing_lessons(db: Session) -> None:
    lesson_ids = [lesson_id for (lesson_id,) in db.query(Lesson.id).all()]
    for lesson_id in lesson_ids:
        count = db.query(LessonQuizQuestion).filter(LessonQuizQuestion.lesson_id == lesson_id).count()
        if count < QUIZ_SIZE:
            ensure_lesson_quiz(db, lesson_id)
