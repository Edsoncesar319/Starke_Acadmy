"""Build Angular into /public for the composite FastAPI + SPA deployment."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FRONTEND = ROOT / "frontend"


def main() -> None:
    subprocess.run(["npm", "install"], cwd=FRONTEND, check=True)
    subprocess.run(["npm", "run", "build"], cwd=FRONTEND, check=True)

    public = ROOT / "public"
    browser = public / "browser"
    if not (public / "index.html").is_file() and (browser / "index.html").is_file():
        import shutil

        for item in browser.iterdir():
            target = public / item.name
            if item.is_dir():
                shutil.copytree(item, target, dirs_exist_ok=True)
            else:
                shutil.copy2(item, target)

    if not (public / "index.html").is_file():
        print("Missing public/index.html after Angular build", file=sys.stderr)
        sys.exit(1)
    print("SPA ready at", public)


if __name__ == "__main__":
    main()
