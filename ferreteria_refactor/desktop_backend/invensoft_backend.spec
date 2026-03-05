# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec para compilar el backend de Invensoft Desktop.

Salida:   ferreteria_refactor/dist/invensoft-backend.exe
Tamaño:   ~80-120 MB (incluye Python + FastAPI + SQLAlchemy + psycopg2)

Uso:
    cd ferreteria_refactor/
    pyinstaller desktop_backend/invensoft_backend.spec --clean

Luego copiar el .exe a:
    frontend_web/src-tauri/binaries/invensoft-backend-x86_64-pc-windows-msvc.exe
"""
import sys
import os
from pathlib import Path

# Raíz del proyecto (ferreteria_refactor/)
ROOT = Path(SPECPATH)

# ─── Análisis ────────────────────────────────────────────────────────────────
a = Analysis(
    # Entry point: desktop_backend/entry.py (wrapper que llama a run.py)
    [str(ROOT / 'desktop_backend' / 'entry.py')],

    pathex=[str(ROOT)],

    binaries=[],

    datas=[
        # Migraciones Alembic
        (str(ROOT / 'alembic'),         'alembic'),
        (str(ROOT / 'alembic.ini'),     '.'),
        # Configuración uvicorn / FastAPI
        (str(ROOT / 'backend_api'),     'backend_api'),
        (str(ROOT / 'desktop_backend'), 'desktop_backend'),
    ],

    hiddenimports=[
        # FastAPI / Starlette
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'starlette.middleware.sessions',
        'starlette.routing',
        # SQLAlchemy
        'sqlalchemy.dialects.postgresql',
        'sqlalchemy.dialects.postgresql.psycopg2',
        # psycopg2
        'psycopg2',
        'psycopg2._psycopg',
        # Alembic
        'alembic.runtime.migration',
        'alembic.operations',
        'alembic.operations.ops',
        # Pydantic
        'pydantic',
        'pydantic.v1',
        'pydantic_settings',
        # Email-validator (usado por pydantic)
        'email_validator',
        # Passlib / bcrypt
        'passlib.handlers.bcrypt',
        'bcrypt',
        # Python-jose
        'jose',
        'jose.jwt',
        # Backend API modules (importados dinámicamente)
        'backend_api.models.models',
        'backend_api.models.restaurant',
        'backend_api.models.tenant',
        'backend_api.models.desktop_license',
        'backend_api.routers.products',
        'backend_api.routers.customers',
        'backend_api.routers.cash',
        'backend_api.routers.auth',
        'backend_api.routers.config',
        'backend_api.routers.payment_methods',
        'backend_api.routers.warehouses',
        'backend_api.routers.categories',
        'backend_api.routers.inventory',
        'backend_api.routers.sales',
        'backend_api.routers.reports',
        'backend_api.routers.desktop_licenses',
        'desktop_backend.main',
        'desktop_backend.startup',
        'desktop_backend.middleware',
        'desktop_backend.config',
    ],

    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Excluir módulos pesados innecesarios
        'tkinter', 'matplotlib', 'numpy', 'pandas',
        'PIL', 'cv2', 'torch',
    ],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='invensoft-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,           # Mostrar consola (útil para debug en cliente)
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    # Icono (opcional)
    # icon=str(ROOT / 'frontend_web' / 'src-tauri' / 'icons' / 'icon.ico'),
)
