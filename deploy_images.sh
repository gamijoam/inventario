#!/bin/bash
set -e

USER="gamijoam"

echo "================================================"
echo "     SISTEMA DE DESPLIEGUE VERSIONADO"
echo "================================================"

# Generar tag basado en fecha/hora (Ej: 20231024-1530)
DATETAG=$(date +%Y%m%d-%H%M)

echo "1) Entorno QA (Tag sugerido: qa-$DATETAG)"
echo "2) Entorno PRODUCCION (Tag sugerido: prod-$DATETAG)"
read -p "Elige entorno (1 o 2): " ENV_CHOICE

if [ "$ENV_CHOICE" = "1" ]; then
    PREFIX="qa"
    API_URL="https://api-qa.miinventariofacil.com/api/v1"
else
    PREFIX="prod"
    API_URL="https://api.miinventariofacil.com/api/v1"
fi

read -p "Ingresa sufijo de version (ej: 1, fix-login, o presiona enter para usar fecha): " VERSION
if [ -z "$VERSION" ]; then
    TAG="${PREFIX}-${DATETAG}"
else
    TAG="${PREFIX}-${VERSION}"
fi

echo ""
echo "================================================"
echo "     SELECCIONAR MODO DE CONSTRUCCION"
echo "================================================"
echo "1) FAST MODE (Recomendado): Solo codigo, ignora .exe, .iso, bridges (Rapido)"
echo "2) FULL MODE: Incluye TODO (Invensoft Bridge, Hardware Bridge, .exe)"
echo ""
read -p "Elige modo (1 o 2) [Default 1]: " BUILD_MODE

if [ "$BUILD_MODE" = "2" ]; then
    echo "[MODO] FULL MODE SELECCIONADO - Se incluiran binarios."
    cp -f .dockerignore.full .dockerignore
else
    echo "[MODO] FAST MODE SELECCIONADO - Se ignoraran binarios pesados."
    cp -f .dockerignore.fast .dockerignore
fi

echo ""
echo "[CONFIRMACION] Se usara el TAG: $TAG"
echo "[CONFIRMACION] API URL: $API_URL"
read -p "Presiona Enter para continuar..." _

# --- PRE-FLIGHT: TESTS ---
echo ""
echo "================================================"
echo "     EJECUTANDO TESTS PRE-DEPLOY"
echo "================================================"
echo "1) Ejecutar tests (Recomendado)"
echo "2) Saltar tests (Solo si es urgente)"
echo ""
read -p "Elige opcion (1 o 2) [Default 1]: " TEST_CHOICE

if [ "$TEST_CHOICE" != "2" ]; then
    echo "Ejecutando pytest..."

    # Activate venv if exists
    if [ -f ".venv/bin/activate" ]; then
        source .venv/bin/activate
    fi

    # Run tests from the ferreteria_refactor directory
    REPO_ROOT="$(pwd)"
    cd ferreteria_refactor

    set +e
    python -m pytest tests/ -v --tb=short 2>&1
    TEST_EXIT=$?
    set -e

    cd "$REPO_ROOT"

    if [ $TEST_EXIT -ne 0 ]; then
        echo ""
        echo "================================================"
        echo "TESTS FALLARON. Deploy abortado."
        echo "Corrige los errores y vuelve a intentar."
        echo "================================================"
        exit 1
    fi

    echo ""
    echo "Tests pasaron. Continuando con el build..."
else
    echo "[SKIP] Tests omitidos por el usuario."
fi

# --- PROCESO DE BUILD ---

# 1. Backend
echo "🏗️ Construyendo Backend..."
docker build --network host -f ./ferreteria_refactor/backend_api/Dockerfile -t "${USER}/ferreteria-backend:${TAG}" .

# 2. Frontend App
echo "🏗️ Construyendo Frontend App..."
docker build --network host --no-cache --build-arg VITE_API_URL="${API_URL}" -f ./ferreteria_refactor/frontend_web/Dockerfile.prod -t "${USER}/ferreteria-app:${TAG}" ./ferreteria_refactor/frontend_web

# 3. Landing
echo "🏗️ Construyendo Landing..."
docker build --network host --no-cache --build-arg VITE_API_URL="${API_URL}" -t "${USER}/ferreteria-landing:${TAG}" ./landing_page

# 4. Admin Panel
echo "🏗️ Construyendo Admin Panel..."
docker build --network host --no-cache --build-arg VITE_API_URL="${API_URL}" -f ./ferreteria_refactor/saas_admin/Dockerfile -t "${USER}/ferreteria-admin-panel:${TAG}" ./ferreteria_refactor/saas_admin

# --- PUSH ---
echo "☁️ Subiendo imagenes..."
docker push "${USER}/ferreteria-backend:${TAG}"
docker push "${USER}/ferreteria-app:${TAG}"
docker push "${USER}/ferreteria-landing:${TAG}"
docker push "${USER}/ferreteria-admin-panel:${TAG}"

echo ""
echo "================================================"
echo "✅ PROCESO EXITOSO"
echo "TAG PARA EL VPS: $TAG"
echo "================================================"
