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
# Python embebido (solo para uvicorn — launcher es C# nativo)
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
unzip -qo "$SCRIPT_DIR/cache/$PY_ZIP" -d "$DIST_DIR/python/"

# Habilitar pip
PY_PTH="$DIST_DIR/python/python312._pth"
if [ -f "$PY_PTH" ]; then
    sed -i 's/#import site/import site/' "$PY_PTH"
fi

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
# 3b. Pre-descargar wheels de pip para instalación offline
# ============================================================
echo "[3b/6] Pre-descargando wheels de pip (instalación offline)..."
WHEELS_DIR="$DIST_DIR/wheels"
mkdir -p "$WHEELS_DIR"
WHEELS_CACHE="$SCRIPT_DIR/cache/wheels"
mkdir -p "$WHEELS_CACHE"

# Descargar wheels para Windows x86_64 / cp312
pip download \
    --platform win_amd64 \
    --python-version 312 \
    --implementation cp \
    --abi cp312 \
    --only-binary=:all: \
    --dest "$WHEELS_CACHE" \
    -r "$ROOT_DIR/../requirements.txt" \
    --quiet 2>&1 | grep -v "^$" || true

# Algunos paquetes solo tienen source dist — descargarlos también
pip download \
    --no-deps \
    --dest "$WHEELS_CACHE" \
    -r "$ROOT_DIR/../requirements.txt" \
    --quiet 2>&1 | grep -v "^$" || true

cp "$WHEELS_CACHE"/*.whl "$WHEELS_DIR/" 2>/dev/null || true
cp "$WHEELS_CACHE"/*.tar.gz "$WHEELS_DIR/" 2>/dev/null || true
WHEEL_COUNT=$(ls "$WHEELS_DIR" 2>/dev/null | wc -l)
echo "  ✅ $WHEEL_COUNT wheels listos en wheels/"

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
# 5. Copiar launcher C# compilado
# ============================================================
echo "[5/6] Launcher C# + scripts..."

LAUNCHER_PUBLISH="$SCRIPT_DIR/launcher/publish"

if [ -f "$LAUNCHER_PUBLISH/MiInventarioFacil.exe" ]; then
    # Copiar todos los archivos del publish (exe + DLLs nativas requeridas)
    cp "$LAUNCHER_PUBLISH"/*.exe "$DIST_DIR/" 2>/dev/null || true
    cp "$LAUNCHER_PUBLISH"/*.dll "$DIST_DIR/" 2>/dev/null || true
    echo "  ✅ Launcher copiado desde publish/"
else
    echo "  ⚠️  Launcher C# no encontrado en launcher/publish/"
    echo "     Compilar con:"
    echo "       cd local/launcher"
    echo "       dotnet publish -c Release -r win-x64 --self-contained true /p:PublishSingleFile=true -o publish"
fi

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

# Scripts de respaldo (por si el usuario prefiere línea de comandos)
cp "$SCRIPT_DIR/start.bat" "$DIST_DIR/"
cp "$SCRIPT_DIR/stop.bat" "$DIST_DIR/"

# setup.bat — inicializa la BD (ejecutado por InnoSetup en instalación)
cp "$SCRIPT_DIR/setup.bat" "$DIST_DIR/"

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
echo "  Para generar el instalador .exe:"
echo "    1. Compilar el launcher (si no está en launcher/publish/):"
echo "       cd local/launcher"
echo "       dotnet publish -c Release -r win-x64 --self-contained true \\"
echo "         /p:PublishSingleFile=true -o publish"
echo "    2. Copiar dist/MiInventarioFacil/ a Windows"
echo "    3. Abrir innosetup.iss con InnoSetup 6 y compilar (Ctrl+F9)"
echo "       → genera local/output/MiInventarioFacil-Setup.exe"
echo "============================================================"
