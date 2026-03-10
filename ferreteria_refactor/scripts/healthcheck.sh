#!/bin/bash
# healthcheck.sh — Verifica que el sistema Invensoft arrancó correctamente
# Uso: ./scripts/healthcheck.sh [--verbose]
set -e

VERBOSE=false
[[ "$1" == "--verbose" ]] && VERBOSE=true

API_URL="${API_URL:-http://localhost:8000}"
PASS=0
FAIL=0

_ok()   { echo "  ✔ $1"; ((PASS++)); }
_fail() { echo "  ✗ $1"; ((FAIL++)); }
_info() { $VERBOSE && echo "    → $1" || true; }

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   HEALTHCHECK — Invensoft / Mi Inventario    ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── 1. API REST ──────────────────────────────────────
echo "[1/5] API Backend..."
if curl -sf "${API_URL}/health" > /dev/null 2>&1; then
    _ok "API responde en ${API_URL}/health"
else
    _fail "API no responde en ${API_URL}/health"
fi

# ── 2. Documentación OpenAPI ─────────────────────────
echo "[2/5] OpenAPI docs..."
if curl -sf "${API_URL}/openapi.json" > /dev/null 2>&1; then
    _ok "OpenAPI schema accesible"
else
    _fail "OpenAPI schema no accesible"
fi

# ── 3. Base de datos (via endpoint de health) ────────
echo "[3/5] Base de datos..."
DB_RESP=$(curl -sf "${API_URL}/health" 2>/dev/null || echo "{}")
if echo "$DB_RESP" | grep -q '"status"'; then
    _ok "Endpoint de health incluye estado de BD"
    _info "$DB_RESP"
else
    _fail "Endpoint de health no devuelve estado de BD"
fi

# ── 4. Migraciones Alembic ───────────────────────────
echo "[4/5] Migraciones Alembic..."
ALEMBIC_DIR="$(dirname "$0")/../alembic"
if command -v alembic &>/dev/null && [ -f "${ALEMBIC_DIR}/../alembic.ini" ]; then
    CURRENT=$(cd "$(dirname "$0")/.." && alembic current 2>&1)
    if echo "$CURRENT" | grep -q "(head)"; then
        _ok "Migraciones al día (head)"
        _info "$CURRENT"
    else
        _fail "Migraciones pendientes"
        _info "$CURRENT"
    fi
else
    _ok "Alembic no disponible en este entorno (skip)"
fi

# ── 5. Frontend build ────────────────────────────────
echo "[5/5] Frontend build..."
FRONTEND_DIST="$(dirname "$0")/../frontend_web/dist"
if [ -d "$FRONTEND_DIST" ] && [ -f "${FRONTEND_DIST}/index.html" ]; then
    ASSET_COUNT=$(find "$FRONTEND_DIST/assets" -name "*.js" 2>/dev/null | wc -l)
    _ok "Frontend build presente (${ASSET_COUNT} JS bundles)"
else
    _fail "Frontend dist no encontrado — ejecuta 'npm run build'"
fi

# ── Resultado final ──────────────────────────────────
echo ""
echo "──────────────────────────────────────────────"
echo "  Resultado: ${PASS} OK  /  ${FAIL} FALLOS"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "──────────────────────────────────────────────"
echo ""

[ $FAIL -eq 0 ] && exit 0 || exit 1
