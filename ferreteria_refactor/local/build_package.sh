#!/bin/bash
# ============================================================
#  Mi Inventario Fácil — Build del paquete offline para Windows
#
#  Este script prepara la carpeta dist/ con todo lo necesario
#  para correr la app en Windows sin internet ni Docker.
#
#  Uso: bash build_package.sh
#  Luego: copiar dist/ a Windows y ejecutar start.bat
#  O compilar dist/ con InnoSetup para generar el .exe instalador
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$SCRIPT_DIR/dist/MiInventarioFacil"

PG_VERSION="16.8-1"
PY_VERSION="3.12.9"

echo "============================================================"
echo "  Mi Inventario Fácil — Build Paquete Offline"
echo "============================================================"
echo ""

# Limpiar dist anterior
rm -rf "$SCRIPT_DIR/dist"
mkdir -p "$DIST_DIR"

# ============================================================
# 1. Descargar PostgreSQL portable para Windows
# ============================================================
PG_ZIP="postgresql-${PG_VERSION}-windows-x64-binaries.zip"
PG_URL="https://get.enterprisedb.com/postgresql/${PG_ZIP}"

echo "[1/6] PostgreSQL portable ${PG_VERSION}..."
if [ ! -f "$SCRIPT_DIR/cache/$PG_ZIP" ]; then
    mkdir -p "$SCRIPT_DIR/cache"
    echo "  Descargando (~200MB)..."
    wget -q --show-progress -O "$SCRIPT_DIR/cache/$PG_ZIP" "$PG_URL"
fi
echo "  Extrayendo..."
unzip -q "$SCRIPT_DIR/cache/$PG_ZIP" -d "$SCRIPT_DIR/cache/pg_temp"
# Solo copiar bin y lib (sin docs, include, etc.)
mkdir -p "$DIST_DIR/postgresql/bin" "$DIST_DIR/postgresql/lib" "$DIST_DIR/postgresql/share"
cp -r "$SCRIPT_DIR/cache/pg_temp/pgsql/bin/"* "$DIST_DIR/postgresql/bin/"
cp -r "$SCRIPT_DIR/cache/pg_temp/pgsql/lib/"* "$DIST_DIR/postgresql/lib/"
cp -r "$SCRIPT_DIR/cache/pg_temp/pgsql/share/"* "$DIST_DIR/postgresql/share/"
rm -rf "$SCRIPT_DIR/cache/pg_temp"
echo "  ✅ PostgreSQL listo"

# ============================================================
# 2. Descargar Python embebido para Windows
# ============================================================
# Python embebido + instalador completo para tkinter
PY_ZIP="python-${PY_VERSION}-embed-amd64.zip"
PY_URL="https://www.python.org/ftp/python/${PY_VERSION}/${PY_ZIP}"
PY_INSTALLER="python-${PY_VERSION}-amd64.exe"
PY_INSTALLER_URL="https://www.python.org/ftp/python/${PY_VERSION}/${PY_INSTALLER}"
PIP_URL="https://bootstrap.pypa.io/get-pip.py"

echo "[2/6] Python ${PY_VERSION}..."

# Python embebido (base)
if [ ! -f "$SCRIPT_DIR/cache/$PY_ZIP" ]; then
    mkdir -p "$SCRIPT_DIR/cache"
    echo "  Descargando embebido (~12MB)..."
    wget -q --show-progress -O "$SCRIPT_DIR/cache/$PY_ZIP" "$PY_URL"
fi
mkdir -p "$DIST_DIR/python"
unzip -qo "$SCRIPT_DIR/cache/$PY_ZIP" -d "$DIST_DIR/python/"

# Habilitar pip + paths
cat > "$DIST_DIR/python/python312._pth" << 'PTHEOF'
python312.zip
.
Lib
DLLs
import site
PTHEOF

# Instalador de Python (para que setup.bat instale tkinter en Windows)
if [ ! -f "$SCRIPT_DIR/cache/$PY_INSTALLER" ]; then
    echo "  Descargando instalador completo (~26MB, para tkinter)..."
    wget -q --show-progress -O "$SCRIPT_DIR/cache/$PY_INSTALLER" "$PY_INSTALLER_URL"
fi
mkdir -p "$DIST_DIR/redist"
cp "$SCRIPT_DIR/cache/$PY_INSTALLER" "$DIST_DIR/redist/"

# get-pip.py
if [ ! -f "$SCRIPT_DIR/cache/get-pip.py" ]; then
    wget -q -O "$SCRIPT_DIR/cache/get-pip.py" "$PIP_URL"
fi
cp "$SCRIPT_DIR/cache/get-pip.py" "$DIST_DIR/python/"
echo "  ✅ Python listo"

# ============================================================
# 2b. Descargar Visual C++ Redistributable (requerido por PostgreSQL)
# ============================================================
VCREDIST_URL="https://aka.ms/vs/17/release/vc_redist.x64.exe"
echo "[2b/6] Visual C++ Redistributable..."
if [ ! -f "$SCRIPT_DIR/cache/vc_redist.x64.exe" ]; then
    echo "  Descargando (~25MB)..."
    wget -q --show-progress -O "$SCRIPT_DIR/cache/vc_redist.x64.exe" "$VCREDIST_URL"
fi
mkdir -p "$DIST_DIR/redist"
cp "$SCRIPT_DIR/cache/vc_redist.x64.exe" "$DIST_DIR/redist/"
echo "  ✅ VC++ Redistributable listo"

# ============================================================
# 3. Copiar backend
# ============================================================
echo "[3/6] Backend (FastAPI)..."
mkdir -p "$DIST_DIR/backend"
# Copiar código del backend (sin venv, __pycache__, tests, .env)
rsync -a --exclude='venv/' --exclude='__pycache__/' --exclude='*.pyc' \
    --exclude='.env' --exclude='.env.backup*' --exclude='tests/' \
    --exclude='media/' --exclude='backups/' --exclude='frontend/' \
    "$ROOT_DIR/backend_api/" "$DIST_DIR/backend/"

# Crear directorios necesarios que el backend espera
mkdir -p "$DIST_DIR/backend/media"
mkdir -p "$DIST_DIR/backend/backups"

# Copiar requirements.txt
cp "$ROOT_DIR/../requirements.txt" "$DIST_DIR/backend/requirements.txt"

# Copiar alembic
if [ -d "$ROOT_DIR/alembic" ]; then
    cp -r "$ROOT_DIR/alembic" "$DIST_DIR/backend/alembic"
fi
echo "  ✅ Backend listo"

# ============================================================
# 4. Build frontend
# ============================================================
echo "[4/6] Frontend (Vite build)..."
cd "$ROOT_DIR/frontend_web"
VITE_API_URL=http://localhost:8000 npx vite build --mode production 2>&1 | tail -3
mkdir -p "$DIST_DIR/frontend"
cp -r dist/* "$DIST_DIR/frontend/"
cd "$SCRIPT_DIR"
echo "  ✅ Frontend listo"

# ============================================================
# 5. Copiar scripts y configs
# ============================================================
echo "[5/6] Scripts y configuración..."

# .env para modo offline
GENERATED_KEY=$(openssl rand -hex 32)
cat > "$DIST_DIR/backend/.env" << ENVEOF
# Mi Inventario Fácil — Modo Offline
DATABASE_URL=postgresql://postgres:@localhost:5432/miinventariofacil
SECRET_KEY=${GENERATED_KEY}
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
SINGLE_TENANT=true
SINGLE_TENANT_SCHEMA=default
ENVIRONMENT=production
APP_DOMAIN=localhost
PROTOCOL=http
FRONTEND_URL=http://localhost:8000
MEDIA_ROOT=./media
TIMEZONE=America/Caracas
ENVEOF

# Scripts de respaldo (por si el launcher falla)
cp "$SCRIPT_DIR/start.bat" "$DIST_DIR/"
cp "$SCRIPT_DIR/stop.bat" "$DIST_DIR/"

# Launcher Python (se compila a .exe en Windows con PyInstaller)
cp "$SCRIPT_DIR/launcher.py" "$DIST_DIR/"

# setup.bat — primera ejecución (reescrito con todos los fixes)
cat > "$DIST_DIR/setup.bat" << 'SETUPEOF'
@echo off
title Mi Inventario Facil - Setup Inicial
color 0A
cd /d "%~dp0"

:: Encoding UTF-8 para evitar errores con emojis del backend
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1
chcp 65001 >nul 2>&1

echo.
echo  ============================================================
echo   Mi Inventario Facil - Configuracion Inicial
echo   Esto puede tardar unos minutos. No cierre esta ventana.
echo  ============================================================
echo.

:: ── PASO 1: Visual C++ Redistributable ──
echo  [1/6] Verificando Visual C++ Redistributable...
reg query "HKLM\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo         Instalando...
    if exist "redist\vc_redist.x64.exe" (
        redist\vc_redist.x64.exe /install /quiet /norestart
        echo         OK
    ) else (
        echo         [!] vc_redist.x64.exe no encontrado
        pause
        exit /b 1
    )
) else (
    echo         OK
)

:: ── PASO 2: Python completo (borrar embebido, instalar con tkinter) ──
echo  [2/6] Verificando Python...
python\python.exe -c "import tkinter" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo         Instalando Python completo...
    if exist "redist\python-3.12.9-amd64.exe" (
        :: Borrar Python embebido para que el instalador pueda escribir
        if exist "python\python312._pth" (
            rmdir /S /Q python >nul 2>&1
            mkdir python >nul 2>&1
        )
        :: Instalar Python completo en la carpeta python\
        redist\python-3.12.9-amd64.exe /quiet TargetDir="%~dp0python" Include_launcher=0 Include_test=0 AssociateFiles=0 Shortcuts=0 Include_doc=0 InstallAllUsers=0
        :: Esperar a que termine
        timeout /t 10 /nobreak >nul
        :: Verificar
        python\python.exe -c "import tkinter" >nul 2>&1
        if %ERRORLEVEL% NEQ 0 (
            echo         [!] Python se instalo pero tkinter no disponible.
            echo         El launcher usara la consola como alternativa.
        ) else (
            echo         OK
        )
    ) else (
        echo         [!] Instalador de Python no encontrado. Usando version basica.
    )
) else (
    echo         OK
)

:: ── PASO 3: pip ──
echo  [3/6] Instalando pip...
python\python.exe -m pip --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    python\python.exe python\get-pip.py --no-warn-script-location >nul 2>&1
    if exist "%~dp0python\get-pip.py" (
        python\python.exe "%~dp0python\get-pip.py" --no-warn-script-location >nul 2>&1
    )
)
echo         OK

:: ── PASO 4: Dependencias Python ──
echo  [4/6] Instalando dependencias (puede tardar unos minutos)...
python\python.exe -m pip install --no-warn-script-location -r backend\requirements.txt >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo         [ERROR] Fallo instalando dependencias.
    echo         Ejecute: python\python.exe -m pip install -r backend\requirements.txt
    pause
    exit /b 1
)
echo         OK

:: ── PASO 5: PostgreSQL ──
echo  [5/6] Inicializando base de datos...

:: Matar PostgreSQL si quedo corriendo de antes
taskkill /f /im postgres.exe >nul 2>&1
timeout /t 2 /nobreak >nul

:: Inicializar data directory
if not exist "postgresql\data\PG_VERSION" (
    postgresql\bin\initdb.exe -D postgresql\data -U postgres -E UTF8 --locale=C >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo         [ERROR] initdb fallo. Revise que VC++ este instalado.
        pause
        exit /b 1
    )
)

:: Iniciar PostgreSQL
postgresql\bin\pg_ctl.exe start -D postgresql\data -l postgresql\log.txt -w
timeout /t 2 /nobreak >nul

:: Verificar que esta corriendo
postgresql\bin\pg_isready.exe -h localhost -p 5432 -U postgres >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo         [ERROR] PostgreSQL no inicio. Revise postgresql\log.txt
    pause
    exit /b 1
)

:: Crear base de datos
postgresql\bin\psql.exe -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='miinventariofacil'" 2>nul | findstr "1" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    postgresql\bin\createdb.exe -U postgres miinventariofacil >nul 2>&1
)
echo         OK

:: ── PASO 6: Crear empresa ──
echo  [6/6] Configurando empresa por defecto...

:: Crear directorio media
if not exist "backend\media" mkdir backend\media

:: Ejecutar setup_offline.py
set PYTHONPATH=%~dp0
python\python.exe -m backend.setup_offline 2>nul
if %ERRORLEVEL% NEQ 0 (
    cd backend
    ..\python\python.exe setup_offline.py 2>nul
    cd ..
)

:: Detener PostgreSQL
postgresql\bin\pg_ctl.exe stop -D postgresql\data -m fast >nul 2>&1

echo.
echo  ============================================================
echo   Setup completado!
echo.
echo   Para iniciar: doble click en MiInventarioFacil.exe
echo   O ejecute start.bat
echo.
echo   Credenciales:
echo     Usuario: admin
echo     Clave:   admin123
echo  ============================================================
echo ============================================================
pause
SETUPEOF

echo "  ✅ Scripts listos"

# ============================================================
# 6. Generar información de versión
# ============================================================
echo "[6/6] Finalizando..."

cat > "$DIST_DIR/VERSION.txt" << EOF
Mi Inventario Fácil — Versión Offline
Build: $(date '+%Y-%m-%d %H:%M')
Commit: $(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || echo "N/A")

Componentes:
  - PostgreSQL ${PG_VERSION}
  - Python ${PY_VERSION}
  - FastAPI + uvicorn

Credenciales por defecto:
  Usuario: admin
  Email: admin@local.com
  Clave: admin123

Instrucciones:
  1. Ejecute setup.bat (solo la primera vez)
  2. Ejecute start.bat para iniciar
  3. Abra http://localhost:8000 en su navegador
  4. Para detener: cierre la ventana o ejecute stop.bat
EOF

echo ""
echo "============================================================"
echo "  ✅ Paquete listo en: $DIST_DIR"
echo ""
echo "  Contenido:"
du -sh "$DIST_DIR"/* 2>/dev/null | sed 's|.*/||'
echo ""
echo "  Siguiente paso:"
echo "    1. Copiar dist/MiInventarioFacil/ a Windows"
echo "    2. Ejecutar setup.bat (primera vez)"
echo "    3. Ejecutar start.bat"
echo ""
echo "  O para generar .exe instalador:"
echo "    Abrir innosetup.iss con InnoSetup en Windows y compilar"
echo "============================================================"
