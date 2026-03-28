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
PY_ZIP="python-${PY_VERSION}-embed-amd64.zip"
PY_URL="https://www.python.org/ftp/python/${PY_VERSION}/${PY_ZIP}"
PIP_URL="https://bootstrap.pypa.io/get-pip.py"

echo "[2/6] Python embebido ${PY_VERSION}..."
if [ ! -f "$SCRIPT_DIR/cache/$PY_ZIP" ]; then
    mkdir -p "$SCRIPT_DIR/cache"
    echo "  Descargando (~12MB)..."
    wget -q --show-progress -O "$SCRIPT_DIR/cache/$PY_ZIP" "$PY_URL"
fi
mkdir -p "$DIST_DIR/python"
unzip -q "$SCRIPT_DIR/cache/$PY_ZIP" -d "$DIST_DIR/python/"

# Habilitar pip: descomentar import site en python312._pth
PY_PTH="$DIST_DIR/python/python312._pth"
if [ -f "$PY_PTH" ]; then
    sed -i 's/#import site/import site/' "$PY_PTH"
fi

# Descargar get-pip.py
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
cat > "$DIST_DIR/backend/.env" << 'ENVEOF'
# Mi Inventario Fácil — Modo Offline
DATABASE_URL=postgresql://postgres:@localhost:5432/miinventariofacil
SECRET_KEY=offline-local-cambiar-en-produccion-$(openssl rand -hex 32)
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

# start.bat
cp "$SCRIPT_DIR/start.bat" "$DIST_DIR/"
cp "$SCRIPT_DIR/stop.bat" "$DIST_DIR/"

# setup.bat — primera ejecución
cat > "$DIST_DIR/setup.bat" << 'SETUPEOF'
@echo off
title Mi Inventario Facil - Setup Inicial
color 0A
cd /d "%~dp0"

echo ============================================================
echo   Mi Inventario Facil - Configuracion Inicial
echo ============================================================
echo.

:: 0. Instalar Visual C++ Redistributable (requerido por PostgreSQL)
echo [1/5] Verificando Visual C++ Redistributable...
reg query "HKLM\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo   Instalando Visual C++ Redistributable...
    if exist "redist\vc_redist.x64.exe" (
        redist\vc_redist.x64.exe /install /quiet /norestart
        echo   OK - Instalado
    ) else (
        echo   [AVISO] No se encontro vc_redist.x64.exe
        echo   Descargue de: https://aka.ms/vs/17/release/vc_redist.x64.exe
        echo   e instalelo manualmente antes de continuar.
        pause
    )
) else (
    echo   OK - Ya instalado
)

:: 1. Instalar pip en Python embebido
echo [2/5] Instalando pip...
python\python.exe python\get-pip.py --no-warn-script-location >nul 2>&1
echo   OK

:: 2. Instalar dependencias Python
echo [3/5] Instalando dependencias (puede tardar unos minutos)...
python\python.exe -m pip install --no-warn-script-location -r backend\requirements.txt >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo   [ERROR] Fallo instalando dependencias.
    echo   Ejecute manualmente: python\python.exe -m pip install -r backend\requirements.txt
    pause
    exit /b 1
)
echo   OK

:: 3. Inicializar PostgreSQL
echo [4/5] Inicializando base de datos...
if not exist "postgresql\data\PG_VERSION" (
    postgresql\bin\initdb.exe -D postgresql\data -U postgres -E UTF8 --locale=C >nul 2>&1
)

:: Iniciar PostgreSQL temporalmente
start /B postgresql\bin\pg_ctl.exe start -D postgresql\data -l postgresql\log.txt -w >nul 2>&1
timeout /t 4 /nobreak >nul

:: Crear base de datos
postgresql\bin\psql.exe -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='miinventariofacil'" 2>nul | findstr "1" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    postgresql\bin\createdb.exe -U postgres miinventariofacil
)
echo   OK

:: 4. Crear tenant por defecto
echo [5/5] Configurando empresa por defecto...
set PYTHONPATH=%~dp0
python\python.exe -m backend.setup_offline 2>nul
if %ERRORLEVEL% NEQ 0 (
    :: Intentar con cd al directorio
    cd backend
    ..\python\python.exe setup_offline.py 2>nul
    cd ..
)

:: Detener PostgreSQL
postgresql\bin\pg_ctl.exe stop -D postgresql\data -m fast >nul 2>&1

echo.
echo ============================================================
echo   Setup completado!
echo.
echo   Ejecute start.bat para iniciar la aplicacion.
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
