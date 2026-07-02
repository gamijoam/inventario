#!/usr/bin/env python3
"""
Build incremental offline update packages.

The full offline installer remains the base runtime. This script publishes small
packages for normal releases: frontend, backend and updater. The generated
manifest is consumed by local/updater/update_offline.py.
"""

from __future__ import annotations

import argparse
import datetime as dt
import fnmatch
import hashlib
import json
import os
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[1]
LOCAL_DIR = ROOT / "local"
DEFAULT_OUTPUTS = [
    ROOT / "frontend_web" / "public" / "downloads" / "offline",
    ROOT / "frontend_web" / "dist" / "downloads" / "offline",
]
EXCLUDE_PATTERNS = {
    "common": [
        "__pycache__/*",
        "*.pyc",
        ".env",
        ".env.*",
        "*.log",
        "venv/*",
        ".venv/*",
        "node_modules/*",
    ],
    "backend": [
        "media/*",
        "backups/*",
        "tests/*",
        "frontend/*",
    ],
}


def run_git(args: list[str], fallback: str = "N/A") -> str:
    try:
        return subprocess.check_output(["git", "-C", str(ROOT), *args], text=True).strip()
    except Exception:
        return fallback


def default_version() -> str:
    stamp = dt.datetime.now().strftime("%Y%m%d%H%M")
    commit = run_git(["rev-parse", "--short", "HEAD"], "nogit")
    return f"{stamp}-{commit}"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def should_skip(rel: str, patterns: Iterable[str]) -> bool:
    normalized = rel.replace(os.sep, "/")
    return any(fnmatch.fnmatch(normalized, pattern) for pattern in patterns)


def add_tree(archive: zipfile.ZipFile, source: Path, package_root: str, excludes: list[str]) -> int:
    count = 0
    for path in sorted(source.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(source).as_posix()
        if should_skip(rel, [*EXCLUDE_PATTERNS["common"], *excludes]):
            continue
        archive.write(path, f"{package_root}/{rel}")
        count += 1
    return count


def make_zip(output_dir: Path, name: str, version: str, builder) -> dict:
    zip_path = output_dir / f"{name}-{version}.zip"
    if zip_path.exists():
        zip_path.unlink()
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        file_count = builder(archive)
    return {
        "version": version,
        "url": f"./{zip_path.name}",
        "sha256": sha256_file(zip_path),
        "size": zip_path.stat().st_size,
        "files": file_count,
    }


def build_manifest(output_dir: Path, channel: str, version: str) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    packages: dict[str, dict] = {}

    frontend_dist = ROOT / "frontend_web" / "dist"
    if frontend_dist.exists():
        frontend_excludes = [
            "downloads/*",
            "**/downloads/*",
            "*.zip",
        ]
        packages["frontend"] = make_zip(
            output_dir,
            "frontend",
            version,
            lambda archive: add_tree(archive, frontend_dist, "frontend", frontend_excludes),
        )
    else:
        print("WARN: frontend_web/dist no existe. Se omite frontend.")

    backend_source = ROOT / "backend_api"
    packages["backend"] = make_zip(
        output_dir,
        "backend",
        version,
        lambda archive: add_tree(archive, backend_source, "backend", EXCLUDE_PATTERNS["backend"]),
    )

    def add_updater(archive: zipfile.ZipFile) -> int:
        count = 0
        updater_source = LOCAL_DIR / "updater"
        count += add_tree(archive, updater_source, "updater", [])
        archive.write(LOCAL_DIR / "update.bat", "update.bat")
        return count + 1

    packages["updater"] = make_zip(output_dir, "updater", version, add_updater)

    manifest = {
        "format": "miinventario-offline-update-v1",
        "channel": channel,
        "version": version,
        "commit": run_git(["rev-parse", "--short", "HEAD"]),
        "created_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "min_updater_version": "1.0.0",
        "base_installer_required_for": ["postgresql", "python", "redist"],
        "packages": packages,
    }
    (output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return manifest


def copy_release(source: Path, target: Path) -> None:
    target.mkdir(parents=True, exist_ok=True)
    for path in source.iterdir():
        if path.is_file():
            shutil.copy2(path, target / path.name)


def main() -> int:
    parser = argparse.ArgumentParser(description="Genera paquetes incrementales offline")
    parser.add_argument("--channel", default="qa", choices=["qa", "prod"], help="Canal de actualizacion")
    parser.add_argument("--version", default=default_version(), help="Version del release incremental")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUTS[0]), help="Directorio principal de salida")
    parser.add_argument("--mirror", action="append", default=[], help="Directorio extra para copiar el release")
    args = parser.parse_args()

    output = Path(args.output).resolve()
    manifest = build_manifest(output, args.channel, args.version)

    mirrors = [Path(value).resolve() for value in args.mirror]
    if not args.mirror and args.output == str(DEFAULT_OUTPUTS[0]) and DEFAULT_OUTPUTS[1].exists():
        mirrors.append(DEFAULT_OUTPUTS[1])
    for mirror in mirrors:
        copy_release(output, mirror)

    print("Release incremental listo")
    print(f"  canal: {manifest['channel']}")
    print(f"  version: {manifest['version']}")
    print(f"  salida: {output}")
    for name, package in manifest["packages"].items():
        print(f"  - {name}: {package['size']} bytes, {package['files']} archivos")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
