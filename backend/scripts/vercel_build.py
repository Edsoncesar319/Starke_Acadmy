"""Build Angular into /public (Vercel CDN) and mirror to backend/app/public."""
from __future__ import annotations

import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path

NPM = "npm.cmd" if platform.system() == "Windows" else "npm"

ROOT = Path(__file__).resolve().parents[2]
FRONTEND = ROOT / "frontend"
# Vercel FastAPI serves static files from public/ at the repo root (CDN).
PUBLIC = ROOT / "public"
APP_PUBLIC = ROOT / "backend" / "app" / "public"


def _node_env() -> dict[str, str]:
    env = os.environ.copy()
    env.setdefault("NODE_OPTIONS", "--max-old-space-size=4096")
    env.setdefault("CI", "true")
    return env


def run(cmd: list[str], cwd: Path, *, env: dict[str, str] | None = None) -> None:
    print(f">>> {' '.join(cmd)}  (cwd={cwd})", flush=True)
    result = subprocess.run(
        cmd,
        cwd=cwd,
        capture_output=True,
        text=True,
        env=env or _node_env(),
    )
    if result.stdout:
        print(result.stdout, flush=True)
    if result.stderr:
        print(result.stderr, flush=True)
    if result.returncode != 0:
        raise subprocess.CalledProcessError(result.returncode, cmd)


def ensure_toolchain() -> None:
    for tool in (NPM, "node"):
        try:
            run([tool, "--version"], ROOT)
        except (subprocess.CalledProcessError, FileNotFoundError):
            print(
                f"ERROR: '{tool}' não encontrado. A Vercel precisa de Node.js no build.\n"
                "Defina Node 20 no projeto (Settings → General → Node.js Version) "
                "ou adicione .nvmrc na raiz.",
                file=sys.stderr,
            )
            sys.exit(1)


def clean_stale_outputs() -> None:
    for path in (
        PUBLIC,
        APP_PUBLIC,
        ROOT / "backend" / "public",
        FRONTEND / "dist",
        ROOT / ".vercel-spa-staging",
    ):
        if path.exists():
            print(f"Removing stale output: {path}", flush=True)
            shutil.rmtree(path, ignore_errors=True)


def install_frontend() -> None:
    lock = FRONTEND / "package-lock.json"
    on_vercel = os.environ.get("VERCEL") == "1"
    env = _node_env()

    if on_vercel or not lock.is_file():
        print("Using npm install for frontend dependencies", flush=True)
        run([NPM, "install", "--no-audit", "--no-fund"], FRONTEND, env=env)
        return

    try:
        run([NPM, "ci", "--no-audit", "--no-fund"], FRONTEND, env=env)
    except subprocess.CalledProcessError:
        print("npm ci failed, falling back to npm install", flush=True)
        run([NPM, "install", "--no-audit", "--no-fund"], FRONTEND, env=env)


def find_build_output() -> Path:
    """Return directory that contains index.html after ng build."""
    legacy_backend_public = ROOT / "backend" / "public"
    candidates = [
        PUBLIC,
        PUBLIC / "browser",
        legacy_backend_public,
        legacy_backend_public / "browser",
        FRONTEND / "dist" / "elite-portal",
        FRONTEND / "dist" / "elite-portal" / "browser",
    ]
    for path in candidates:
        if path.is_dir() and (path / "index.html").is_file():
            return path

    if PUBLIC.is_dir():
        for index in PUBLIC.rglob("index.html"):
            return index.parent

    raise FileNotFoundError(
        "Angular build did not produce index.html. "
        f"Checked: {', '.join(str(p) for p in candidates)}"
    )


def flatten_browser_subfolder(target: Path = PUBLIC) -> None:
    """Angular application builder may emit assets under public/browser/."""
    browser = target / "browser"
    if not (browser / "index.html").is_file():
        return
    if (target / "index.html").is_file():
        return

    for item in browser.iterdir():
        dest = target / item.name
        if item.is_dir():
            shutil.copytree(item, dest, dirs_exist_ok=True)
        else:
            shutil.copy2(item, dest)
    shutil.rmtree(browser)


def publish_to_public(source: Path) -> None:
    """Ensure index.html and assets end up at repo /public root."""
    if not (source / "index.html").is_file():
        raise FileNotFoundError(f"No index.html in {source}")

    if source.resolve() == PUBLIC.resolve():
        flatten_browser_subfolder(PUBLIC)
        return

    staging = ROOT / ".vercel-spa-staging"
    if staging.exists():
        shutil.rmtree(staging)
    shutil.copytree(source, staging)

    if PUBLIC.exists():
        shutil.rmtree(PUBLIC)
    shutil.move(str(staging), str(PUBLIC))
    flatten_browser_subfolder(PUBLIC)


def mirror_to_app_package() -> None:
    """Copy SPA beside main.py so it ships inside the Python bundle if needed."""
    if APP_PUBLIC.exists():
        shutil.rmtree(APP_PUBLIC)
    shutil.copytree(PUBLIC, APP_PUBLIC)
    print(f"Mirrored SPA to {APP_PUBLIC}", flush=True)


def main() -> None:
    if not (FRONTEND / "package.json").is_file():
        print(f"Missing {FRONTEND / 'package.json'}", file=sys.stderr)
        sys.exit(1)

    try:
        ensure_toolchain()
        clean_stale_outputs()
        install_frontend()
        run([NPM, "run", "build"], FRONTEND, env=_node_env())
        source = find_build_output()
        publish_to_public(source)
    except subprocess.CalledProcessError as exc:
        print(f"Build command failed (exit {exc.returncode})", file=sys.stderr)
        sys.exit(1)
    except FileNotFoundError as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)

    flatten_browser_subfolder(PUBLIC)

    if not (PUBLIC / "index.html").is_file():
        print("Missing public/index.html after publish step", file=sys.stderr)
        sys.exit(1)

    mirror_to_app_package()
    assets = list(PUBLIC.glob("*.js"))
    print(
        f"SPA ready: {PUBLIC / 'index.html'} "
        f"({len(assets)} JS bundles; Vercel CDN serves /public)",
        flush=True,
    )


if __name__ == "__main__":
    main()
