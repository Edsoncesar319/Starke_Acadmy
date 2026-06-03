import os

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import NullPool

_default_sqlite = (
    "sqlite:////tmp/starke_elite.db"
    if os.getenv("VERCEL")
    else "sqlite:///./starke_elite.db"
)


def resolve_database_url() -> str:
    url = (
        os.getenv("POSTGRES_URL")
        or os.getenv("POSTGRES_URL_NON_POOLING")
        or os.getenv("DATABASE_URL")
        or _default_sqlite
    )
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    if url.startswith("postgresql://") and "+psycopg" not in url.split("://", 1)[0]:
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


DATABASE_URL = resolve_database_url()


def create_db_engine(url: str):
    kwargs: dict = {"pool_pre_ping": True}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
    else:
        kwargs["poolclass"] = NullPool
    return create_engine(url, **kwargs)


engine = create_db_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_schema_updates() -> None:
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("users")}
    dialect = engine.dialect.name
    is_sqlite = dialect == "sqlite"
    default_false = "0" if is_sqlite else "FALSE"

    migrations: list[tuple[str, str]] = []
    if "is_admin" not in columns:
        migrations.append(("is_admin", default_false))
    if "is_instructor" not in columns:
        migrations.append(("is_instructor", default_false))

    if not migrations:
        pass

    with engine.begin() as connection:
        for column_name, default in migrations:
            connection.execute(
                text(f"ALTER TABLE users ADD COLUMN {column_name} BOOLEAN DEFAULT {default}")
            )

    # Lessons table migrations
    if "lessons" not in inspector.get_table_names():
        return

    lesson_columns = {col["name"] for col in inspector.get_columns("lessons")}
    if "pdf_url" not in lesson_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE lessons ADD COLUMN pdf_url VARCHAR(1024)"))

    # Legacy SQLite DBs created before payment tables existed.
    table_names = set(inspector.get_table_names())
    payment_tables = [name for name in ("purchases", "payment_events") if name not in table_names]
    if payment_tables:
        from . import models as _models  # noqa: F401

        tables = [Base.metadata.tables[name] for name in payment_tables if name in Base.metadata.tables]
        if tables:
            Base.metadata.create_all(bind=engine, tables=tables)

    if "lesson_quiz_questions" not in table_names:
        from . import models as _models  # noqa: F401

        if "lesson_quiz_questions" in Base.metadata.tables:
            Base.metadata.create_all(bind=engine, tables=[Base.metadata.tables["lesson_quiz_questions"]])

    table_names = set(inspect(engine).get_table_names())
    if "lesson_progress" not in table_names:
        from . import models as _models  # noqa: F401

        if "lesson_progress" in Base.metadata.tables:
            Base.metadata.create_all(bind=engine, tables=[Base.metadata.tables["lesson_progress"]])
