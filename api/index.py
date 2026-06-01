import sys
from pathlib import Path

# Allow imports from backend/app when running on Vercel.
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.main import app  # noqa: E402
