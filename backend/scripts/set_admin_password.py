"""Atualiza a senha do administrador principal (admin@starke.academy)."""
from __future__ import annotations

import os
import sys
from pathlib import Path

_backend = Path(__file__).resolve().parents[1]
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))

try:
    from dotenv import load_dotenv

    for candidate in (
        os.getenv("DOTENV_PATH"),
        _backend / ".env",
        _backend.parent / ".env.vercel.production",
    ):
        if not candidate:
            continue
        path = Path(candidate)
        if path.is_file():
            load_dotenv(path)
            break
except ImportError:
    pass

from app.auth import get_password_hash
from app.database import SessionLocal
from app.models import User

ADMIN_EMAIL = "admin@starke.academy"


def main() -> None:
    if len(sys.argv) < 2:
        print("Uso: python scripts/set_admin_password.py <nova_senha>")
        raise SystemExit(1)

    new_password = sys.argv[1]
    if len(new_password) < 6:
        print("A senha deve ter pelo menos 6 caracteres.")
        raise SystemExit(1)

    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.email == ADMIN_EMAIL).first()
        if not admin:
            print(f"Admin não encontrado: {ADMIN_EMAIL}")
            raise SystemExit(1)

        admin.password_hash = get_password_hash(new_password)
        db.commit()
        print(f"Senha atualizada para {ADMIN_EMAIL}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
