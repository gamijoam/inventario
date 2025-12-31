# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['run_backend.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('ferreteria_refactor/backend_api/.env', '.'),
        ('ferreteria_refactor/backend_api/data', 'data'),
        ('ferreteria_refactor/alembic', 'alembic'),
        ('ferreteria_refactor/alembic.ini', '.'),
    ],
    hiddenimports=[
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
        'sqlalchemy.ext.baked',
        'alembic',
        'aiofiles',
        'passlib.handlers.bcrypt',
        'passlib.handlers',
        'password_strength',
        'httpx',
        'httpcore',
        'bcrypt',
        'websockets',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='ferreteria_backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,  # True para ver logs, False para producción
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
