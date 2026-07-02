#!/usr/bin/env python3
"""
Incremental updater for Mi Inventario Facil offline installs.

This updater is intentionally stdlib-only because it runs with the embedded
Python included in the offline package. It downloads a signed-by-hash manifest,
fetches only the changed packages, validates sha256, creates backups, applies
files, and rolls back when an apply step fails.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import shutil
import sys
import tempfile
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path
from typing import Any

APP_ROOT = Path(__file__).resolve().parents[1]
UPDATER_DIR = APP_ROOT / "updater"
STATE_FILE = UPDATER_DIR / "update_state.json"
CONFIG_FILE = UPDATER_DIR / "update_config.json"
LOG_DIR = UPDATER_DIR / "logs"
LOG_FILE = LOG_DIR / "update.log"
BACKUP_DIR = UPDATER_DIR / "backups"
CACHE_DIR = UPDATER_DIR / "cache"
DEFAULT_MANIFEST_URL = "https://qa.miinventariofacil.com/downloads/offline/manifest.json"
PACKAGE_TARGETS = {
    "frontend": "frontend",
    "backend": "backend",
    "updater": "updater",
    "launcher": ".",
}


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def log(message: str) -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    line = f"[{now_iso()}] {message}"
    print(message)
    with LOG_FILE.open("a", encoding="utf-8") as handle:
        handle.write(line + "\n")


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def parse_version_file() -> dict[str, str]:
    version_file = APP_ROOT / "VERSION.txt"
    data: dict[str, str] = {}
    if not version_file.exists():
        return data
    for raw in version_file.read_text(encoding="utf-8", errors="ignore").splitlines():
        if ":" not in raw:
            continue
        key, value = raw.split(":", 1)
        data[key.strip().lower()] = value.strip()
    return data


def resolve_manifest_url(args: argparse.Namespace) -> str:
    if args.manifest_url:
        return args.manifest_url
    config = load_json(CONFIG_FILE, {})
    if config.get("manifest_url"):
        return str(config["manifest_url"])
    env_url = os.environ.get("MIF_UPDATE_MANIFEST_URL")
    if env_url:
        return env_url
    if sys.stdin.isatty():
        prompt = f"URL del manifest [{DEFAULT_MANIFEST_URL}]: "
        typed = input(prompt).strip()
        return typed or DEFAULT_MANIFEST_URL
    return DEFAULT_MANIFEST_URL


def url_join(base_url: str, maybe_relative: str) -> str:
    if maybe_relative.startswith("http://") or maybe_relative.startswith("https://"):
        return maybe_relative
    return urllib.parse.urljoin(base_url, maybe_relative)


def download(url: str, target: Path, timeout: int = 60) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    log(f"Descargando {url}")
    with urllib.request.urlopen(url, timeout=timeout) as response:
        with target.open("wb") as handle:
            shutil.copyfileobj(response, handle)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def assert_safe_zip(zip_path: Path) -> None:
    with zipfile.ZipFile(zip_path) as archive:
        for info in archive.infolist():
            name = info.filename.replace("\\", "/")
            if name.startswith("/") or "../" in name or name == "..":
                raise RuntimeError(f"Zip inseguro: {info.filename}")


def copytree_or_file(source: Path, target: Path) -> None:
    if source.is_dir():
        if target.exists():
            if target.is_dir():
                shutil.rmtree(target)
            else:
                target.unlink()
        shutil.copytree(source, target)
    elif source.exists():
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            target.unlink()
        shutil.copy2(source, target)


def backup_targets(package_names: list[str]) -> Path:
    stamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_root = BACKUP_DIR / stamp
    backup_root.mkdir(parents=True, exist_ok=True)
    for package_name in package_names:
        rel_target = PACKAGE_TARGETS.get(package_name)
        if not rel_target:
            continue
        source = APP_ROOT / rel_target
        if source.exists():
            copytree_or_file(source, backup_root / rel_target)
    return backup_root


def restore_backup(backup_root: Path) -> None:
    if not backup_root.exists():
        return
    log("Restaurando respaldo por error de actualizacion...")
    for item in backup_root.iterdir():
        copytree_or_file(item, APP_ROOT / item.name)


def package_needs_update(package_name: str, package: dict[str, Any], state: dict[str, Any]) -> bool:
    if not package or not package.get("url"):
        return False
    installed = state.get("packages", {}).get(package_name, {})
    return installed.get("version") != package.get("version") or installed.get("sha256") != package.get("sha256")


def extract_package(zip_path: Path, staging_root: Path) -> None:
    assert_safe_zip(zip_path)
    with zipfile.ZipFile(zip_path) as archive:
        archive.extractall(staging_root)


def apply_staging(staging_root: Path) -> None:
    for child in staging_root.iterdir():
        target = APP_ROOT / child.name
        if child.name in {"postgresql", "python", "redist"}:
            raise RuntimeError(f"El paquete incremental no puede reemplazar runtime: {child.name}")
        copytree_or_file(child, target)


def apply_updates(manifest: dict[str, Any], manifest_url: str, args: argparse.Namespace) -> int:
    state = load_json(STATE_FILE, {"packages": {}})
    packages = manifest.get("packages") or {}
    selected: list[tuple[str, dict[str, Any]]] = []

    for package_name in ("frontend", "backend", "updater", "launcher"):
        package = packages.get(package_name) or {}
        if package_needs_update(package_name, package, state):
            selected.append((package_name, package))

    if not selected:
        log("No hay actualizaciones pendientes.")
        return 0

    names = [name for name, _ in selected]
    log("Actualizaciones pendientes: " + ", ".join(names))
    if args.check_only:
        return 0

    backup_root = backup_targets(names)
    staging_parent = Path(tempfile.mkdtemp(prefix="mif-update-"))
    try:
        for package_name, package in selected:
            url = url_join(manifest_url, str(package["url"]))
            zip_name = f"{package_name}-{package.get('version', 'latest')}.zip"
            cache_file = CACHE_DIR / zip_name
            download(url, cache_file, timeout=args.timeout)

            expected_sha = str(package.get("sha256") or "").lower()
            actual_sha = sha256_file(cache_file).lower()
            if expected_sha and actual_sha != expected_sha:
                raise RuntimeError(f"SHA256 invalido para {package_name}: {actual_sha} != {expected_sha}")

            package_staging = staging_parent / package_name
            package_staging.mkdir(parents=True, exist_ok=True)
            extract_package(cache_file, package_staging)
            apply_staging(package_staging)

            state.setdefault("packages", {})[package_name] = {
                "version": package.get("version"),
                "sha256": actual_sha,
                "installed_at": now_iso(),
            }

        state["channel"] = manifest.get("channel")
        state["manifest_version"] = manifest.get("version")
        state["manifest_commit"] = manifest.get("commit")
        state["last_update_at"] = now_iso()
        state["manifest_url"] = manifest_url
        save_json(STATE_FILE, state)

        config = load_json(CONFIG_FILE, {})
        config["manifest_url"] = manifest_url
        save_json(CONFIG_FILE, config)

        version_file = APP_ROOT / "VERSION.txt"
        current = parse_version_file()
        lines = [
            "Mi Inventario Facil - Version Offline",
            f"Build: {current.get('build', now_iso())}",
            f"Commit: {manifest.get('commit', current.get('commit', 'N/A'))}",
            f"Offline update: {manifest.get('version', 'N/A')}",
            f"Updated at: {now_iso()}",
            "",
            "Use update.bat para buscar actualizaciones incrementales.",
        ]
        version_file.write_text("\n".join(lines) + "\n", encoding="utf-8")

        log("Actualizacion aplicada correctamente.")
        return 0
    except Exception as exc:
        log(f"ERROR: {exc}")
        restore_backup(backup_root)
        return 1
    finally:
        shutil.rmtree(staging_parent, ignore_errors=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Actualizador offline de Mi Inventario Facil")
    parser.add_argument("--manifest-url", help="URL del manifest.json de actualizaciones")
    parser.add_argument("--check-only", action="store_true", help="Solo verifica si hay actualizaciones")
    parser.add_argument("--timeout", type=int, default=120, help="Timeout de descarga en segundos")
    args = parser.parse_args()

    manifest_url = resolve_manifest_url(args)
    manifest_path = CACHE_DIR / "manifest.json"
    try:
        download(manifest_url, manifest_path, timeout=args.timeout)
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if manifest.get("format") != "miinventario-offline-update-v1":
            raise RuntimeError("Manifest no compatible")
        return apply_updates(manifest, manifest_url, args)
    except Exception as exc:
        log(f"ERROR: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
