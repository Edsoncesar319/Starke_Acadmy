"""Build Angular and prepare /public for Vercel (SPA at site root)."""
from __future__ import annotations

import platform
import shutil
import subprocess
import sys
from pathlib import Path

NPM = "npm.cmd" if platform.system() == "Windows" else "npm"

ROOT = Path(__file__).resolve().parents[2]
FRONTEND = ROOT / "frontend"
PUBLIC = ROOT / "public"


def run(cmd: list[str], cwd: Path) -> None:
    print(f">>> {' '.join(cmd)}  (cwd={cwd})", flush=True)
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if result.stdout:
        print(result.stdout, flush=True)
    if result.returncode != 0:
        if result.stderr:
            print(result.stderr, file=sys.stderr, flush=True)
        raise subprocess.CalledProcessError(result.returncode, cmd)


def install_frontend() -> None:
    lock = FRONTEND / "package-lock.json"
    if lock.is_file():
        try:
            run([NPM, "ci", "--no-audit", "--no-fund"], FRONTEND)
            return
        except subprocess.CalledProcessError:
            print("npm ci failed, falling back to npm install", flush=True)
    run([NPM, "install", "--no-audit", "--no-fund"], FRONTEND)


def find_build_output() -> Path:
    """Return directory that contains index.html after ng build."""
    candidates = [
        PUBLIC,
        PUBLIC / "browser",
        FRONTEND / "dist" / "elite-portal",
        FRONTEND / "dist" / "elite-portal" / "browser",
    ]
    for path in candidates:
        if path.is_dir() and (path / "index.html").is_file():
            return path

    if PUBLIC.is_dir():
        for index in PUBLIC.rglob("index.html"):
            return index.parent

    return PUBLIC


def flatten_browser_subfolder() -> None:
    """Angular application builder may emit assets under public/browser/."""
    browser = PUBLIC / "browser"
    if not (browser / "index.html").is_file():
        return
    if (PUBLIC / "index.html").is_file():
        return

    for item in browser.iterdir():
        target = PUBLIC / item.name
        if item.is_dir():
            shutil.copytree(item, target, dirs_exist_ok=True)
        else:
            shutil.copy2(item, target)
    shutil.rmtree(browser)


def publish_to_public(source: Path) -> None:
    """Ensure index.html and assets end up at /public root."""
    if not (source / "index.html").is_file():
        raise FileNotFoundError(f"No index.html in {source}")

    # ng build with outputPath ../public writes directly into PUBLIC — do not delete it.
    if source.resolve() == PUBLIC.resolve():
        flatten_browser_subfolder()
        return

    staging = ROOT / ".vercel-spa-staging"
    if staging.exists():
        shutil.rmtree(staging)
    shutil.copytree(source, staging)

    if PUBLIC.exists():
        shutil.rmtree(PUBLIC)
    shutil.move(str(staging), str(PUBLIC))
    flatten_browser_subfolder()


def main() -> None:
    if not (FRONTEND / "package.json").is_file():
        print(f"Missing {FRONTEND / 'package.json'}", file=sys.stderr)
        sys.exit(1)

    try:
        install_frontend()
        run([NPM, "run", "build"], FRONTEND)
        source = find_build_output()
        publish_to_public(source)
    except subprocess.CalledProcessError as exc:
        print(f"Build command failed (exit {exc.returncode})", file=sys.stderr)
        sys.exit(1)
    except FileNotFoundError as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)

    if not (PUBLIC / "index.html").is_file():
        print("Missing public/index.html after publish step", file=sys.stderr)
        sys.exit(1)

    print(f"SPA ready: {PUBLIC / 'index.html'}", flush=True)


if __name__ == "__main__":
    main()
