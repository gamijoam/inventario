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
    echo "Verificando BD de test (Docker puerto 5434)..."

    # Levantar BD de test si no está corriendo
    if ! docker ps --format '{{.Names}}' | grep -q "invensoft_db_test"; then
        echo "  BD de test no está corriendo. Levantando..."
        docker compose -f docker-compose.test.yml up -d
        echo "  Esperando 5 segundos para que la BD inicie..."
        sleep 5
    else
        echo "  BD de test ya está corriendo. OK."
    fi

    # Activate venv if exists
    if [ -f ".venv/bin/activate" ]; then
        source .venv/bin/activate
    fi

    REPO_ROOT="$(pwd)"
    cd ferreteria_refactor

    echo ""
    echo "Ejecutando suite de tests (~305 tests: 45 integridad BD + ~260 funcionales)..."
    echo ""

    set +e
    python -m pytest \
        backend_api/tests/test_cat1_caja_pg.py \
        backend_api/tests/test_cat2_ventas_pg.py \
        backend_api/tests/test_cat3_inventario_pg.py \
        backend_api/tests/test_cat4_auth_pg.py \
        backend_api/tests/test_cat5_tenants_pg.py \
        backend_api/tests/test_func_ventas_pg.py \
        backend_api/tests/test_func_caja_pg.py \
        backend_api/tests/test_func_inventario_pg.py \
        backend_api/tests/test_func_traslados_pg.py \
        backend_api/tests/test_func_auth_pg.py \
        backend_api/tests/test_func_config_pg.py \
        backend_api/tests/test_func_compras_pg.py \
        backend_api/tests/test_func_creditos_pg.py \
        backend_api/tests/test_func_clientes.py \
        backend_api/tests/test_func_devoluciones.py \
        backend_api/tests/test_func_tasas_cambio.py \
        backend_api/tests/test_func_ventas_avanzado.py \
        backend_api/tests/test_func_ordenes_servicio.py \
        backend_api/tests/test_func_compras_avanzado.py \
        backend_api/tests/test_func_comisiones.py \
        backend_api/tests/test_func_cotizaciones.py \
        backend_api/tests/test_func_productos.py \
        backend_api/tests/test_func_proveedores.py \
        backend_api/tests/test_func_usuarios.py \
        backend_api/tests/test_func_bodegas.py \
        backend_api/tests/test_func_categorias.py \
        backend_api/tests/test_func_metodos_pago.py \
        backend_api/tests/test_func_listas_precio.py \
        backend_api/tests/test_func_garantias.py \
        backend_api/tests/test_func_ajustes_inventario.py \
        backend_api/tests/test_func_traslados_internos.py \
        backend_api/tests/test_func_empleados.py \
        -v --no-cov --tb=short 2>&1
    TEST_EXIT=$?
    set -e

    cd "$REPO_ROOT"

    if [ $TEST_EXIT -ne 0 ]; then
        echo ""
        echo "================================================"
        echo "TESTS FALLARON. Deploy abortado."
        echo ""
        echo "Si los fallos son datos historicos conocidos,"
        echo "vuelve a correr y elige opcion 2 (Saltar tests)."
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
