from sqlalchemy.orm import Session

from .auth import get_password_hash
from .models import Course, Lesson, User


def seed_data(db: Session) -> None:
    admin = db.query(User).filter(User.email == "admin@starke.academy").first()
    if not admin:
        admin = User(
            name="Super Admin",
            email="admin@starke.academy",
            password_hash=get_password_hash("admin123"),
            student_level="Administrador",
            avatar_url="https://example.com/admin-avatar.jpg",
            is_admin=True,
        )
        db.add(admin)
        db.commit()

    instructor = db.query(User).filter(User.email == "instructor@starke.academy").first()
    if not instructor:
        instructor = User(
            name="Instrutor Starke",
            email="instructor@starke.academy",
            password_hash=get_password_hash("instructor123"),
            student_level="Instrutor",
            is_admin=False,
            is_instructor=True,
        )
        db.add(instructor)
        db.commit()

    if db.query(User).filter(User.email == "evelyn@starke.academy").first():
        return

    user = User(
        name="Evelyn Costa",
        email="evelyn@starke.academy",
        password_hash=get_password_hash("elite123"),
        student_level="Aluno Platina",
        avatar_url="https://example.com/avatar.jpg",
        is_admin=False,
    )
    db.add(user)

    courses = [
        Course(
            title="Arquitetura de Produtos com IA",
            description="Projete, lance e governe produtos avançados com inteligência artificial.",
            price=1299.0,
            category="Tecnologia",
            rating=4.9,
            hero_image_url="https://images.unsplash.com/photo-1518770660439-4636190af475",
        ),
        Course(
            title="Posicionamento de Marca Premium",
            description="Domine segmentos premium com posicionamento claro e estratégico.",
            price=890.0,
            category="Marketing",
            rating=4.8,
            hero_image_url="https://images.unsplash.com/photo-1552664730-d307ca884978",
        ),
    ]
    db.add_all(courses)
    db.flush()

    lessons = [
        Lesson(
            course_id=courses[0].id,
            module_name="Módulo 1",
            title="Visão e mapeamento de oportunidades",
            video_url="https://example.com/video-1",
            content_md="# Visão\nDefina resultados de elite e estratégia.",
        ),
        Lesson(
            course_id=courses[0].id,
            module_name="Módulo 2",
            title="Plataforma e design de dados",
            video_url="https://example.com/video-2",
            content_md="# Dados\nModele fluxos de dados seguros e escaláveis.",
        ),
    ]
    db.add_all(lessons)
    db.commit()
