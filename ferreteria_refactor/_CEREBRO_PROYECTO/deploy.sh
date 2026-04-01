#!/bin/bash
# =============================================================
# deploy.sh — Mi Inventario Fácil
# Uso: ./deploy.sh "descripcion-del-deploy"
# Ejemplo: ./deploy.sh "whatsapp-sprint4"
# =============================================================
set -euo pipefail

# ── Colores ──────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

log()     { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
warn()    { echo -e "${YELLOW}⚠️  $1${NC}"; }
error()   { echo -e "${RED}❌ $1${NC}"; }
title()   { echo -e "\n${BOLD}${BLUE}══ $1 ══${NC}"; }

# ── Validaciones iniciales ────────────────────────────────────
if [ $# -eq 0 ]; then
  error "Falta descripción del deploy"
  echo "  Uso: ./deploy.sh \"descripcion-del-deploy\""
  echo "  Ejemplo: ./deploy.sh \"reportes-excel\""
  exit 1
fi

DESCRIPCION="$1"
VERSION="prod-${DESCRIPCION}-$(date +%Y%m%d)"
DEPLOY_DIR="/root/deploy"
CODE_DIR="$DEPLOY_DIR/qa/code"
PROD_ENV="$DEPLOY_DIR/prod/.env"
ROLLBACK_FILE="/tmp/deploy_rollback_tag.txt"
LOG_FILE="/tmp/deploy_$(date +%Y%m%d_%H%M%S).log"

title "Mi Inventario Deploy — $VERSION"
log "Log guardado en: $LOG_FILE"

# Guardar TAG anterior para rollback
OLD_TAG=$(grep "^TAG=" "$PROD_ENV" | cut -d= -f2 || echo "ninguno")
echo "$OLD_TAG" > "$ROLLBACK_FILE"
log "TAG anterior guardado: $OLD_TAG"

# ── Función de rollback ───────────────────────────────────────
rollback() {
  error "Deploy fallido — ejecutando rollback a $OLD_TAG"
  if [ "$OLD_TAG" != "ninguno" ] && [ -n "$OLD_TAG" ]; then
    sed -i "s/^TAG=.*/TAG=$OLD_TAG/" "$PROD_ENV"
    bash "$0" --only-restart 2>/dev/null || true
    error "Rollback completado. Revisar logs manualmente."
  fi
  exit 1
}
trap rollback ERR

# Modo solo reinicio (usado por rollback)
if [ "${1:-}" = "--only-restart" ]; then
  source "$PROD_ENV"
  VERSION=$(grep "^TAG=" "$PROD_ENV" | cut -d= -f2)
  bash "$0" --restart-containers "$VERSION"
  exit 0
fi

# ── PASO 1: Verificar estado de QA ───────────────────────────
title "PASO 1 — Verificar QA"
cd "$CODE_DIR"

if [ -n "$(git status --porcelain)" ]; then
  error "Hay cambios sin commitear en QA"
  git status --short
  exit 1
fi
success "Git limpio"

QA_HEALTH=$(curl -s --max-time 5 "https://api-qa.miinventariofacil.com/api/v1/health" -o /dev/null -w "%{http_code}" || echo "000")
if [ "$QA_HEALTH" != "200" ]; then
  error "Backend QA no responde (HTTP $QA_HEALTH)"
  exit 1
fi
success "Backend QA responde (200)"

# ── PASO 2: Verificar Docker Hub ─────────────────────────────
title "PASO 2 — Verificar DockerHub"
if ! docker info 2>/dev/null | grep -q "Username"; then
  if [ -f /root/.docker/config.json ] && grep -q "gamijoam" /root/.docker/config.json; then
    success "Credenciales DockerHub OK"
  else
    error "No autenticado en DockerHub"
    echo "  Ejecuta: echo TOKEN | docker login -u gamijoam --password-stdin"
    exit 1
  fi
else
  success "Docker autenticado"
fi

# ── PASO 3: Build de imágenes ─────────────────────────────────
title "PASO 3 — Build de imágenes ($VERSION)"
cd "$CODE_DIR"

PROD_API_URL="https://api.miinventariofacil.com/api/v1"

log "Building backend..."
docker build --network host \
  -f ferreteria_refactor/backend_api/Dockerfile \
  -t gamijoam/ferreteria-backend:$VERSION \
  . >> "$LOG_FILE" 2>&1
success "Backend built"

log "Building frontend..."
docker build --network host \
  --build-arg VITE_API_URL="$PROD_API_URL" \
  -f ferreteria_refactor/frontend_web/Dockerfile.prod \
  -t gamijoam/ferreteria-app:$VERSION \
  ferreteria_refactor/frontend_web >> "$LOG_FILE" 2>&1
success "Frontend built"

log "Building landing..."
docker build --network host \
  --build-arg VITE_API_URL="$PROD_API_URL" \
  -t gamijoam/ferreteria-landing:$VERSION \
  landing_page >> "$LOG_FILE" 2>&1
success "Landing built"

log "Building admin panel..."
docker build --network host \
  --build-arg VITE_API_URL="$PROD_API_URL" \
  -f ferreteria_refactor/saas_admin/Dockerfile \
  -t gamijoam/ferreteria-admin-panel:$VERSION \
  ferreteria_refactor/saas_admin >> "$LOG_FILE" 2>&1
success "Admin panel built"

# ── PASO 4: Push a DockerHub ──────────────────────────────────
title "PASO 4 — Push a DockerHub"
for img in ferreteria-backend ferreteria-app ferreteria-landing ferreteria-admin-panel; do
  log "Subiendo $img..."
  docker push gamijoam/$img:$VERSION >> "$LOG_FILE" 2>&1
  success "$img pushed"
done

# ── PASO 5: Actualizar TAG ────────────────────────────────────
title "PASO 5 — Actualizar TAG en prod"
sed -i "s/^TAG=.*/TAG=$VERSION/" "$PROD_ENV"
success "TAG actualizado a $VERSION"
echo "$VERSION" > /tmp/deploy_version.txt

# ── PASO 6: Recrear contenedores ─────────────────────────────
title "PASO 6 — Recrear contenedores prod"

recreate_container() {
  local NAME=$1; local IMAGE=$2; local EXTRA_ARGS=$3
  local LABELS=$4; local SECONDARY_NET=${5:-""}

  log "Recreando $NAME..."
  docker stop "$NAME" 2>/dev/null || true
  docker rm "$NAME"   2>/dev/null || true

  eval docker run -d \
    --name "$NAME" \
    --restart always \
    --network web_publica \
    --env-file "$PROD_ENV" \
    $EXTRA_ARGS \
    $LABELS \
    "$IMAGE"

  if [ -n "$SECONDARY_NET" ]; then
    sleep 3
    docker network connect "$SECONDARY_NET" "$NAME"
  fi
  success "$NAME recreado"
}

# Backend (necesita red interna para la BD)
recreate_container "backend_prod_server" \
  "gamijoam/ferreteria-backend:$VERSION" \
  "-v /root/deploy/prod/data/media:/app/media" \
  '--label "traefik.enable=true"
   --label "traefik.http.routers.backend-prod.rule=Host(\`api.miinventariofacil.com\`)"
   --label "traefik.http.routers.backend-prod.entrypoints=websecure"
   --label "traefik.http.routers.backend-prod.tls.certresolver=myresolver"
   --label "traefik.http.services.backend-prod.loadbalancer.server.port=8000"
   --label "traefik.docker.network=web_publica"' \
  "prod_prod_internal"

# Frontend
recreate_container "frontend_prod_server" \
  "gamijoam/ferreteria-app:$VERSION" \
  "" \
  '--label "traefik.enable=true"
   --label "traefik.http.routers.frontend-prod.rule=HostRegexp(\`{subdomain:[a-z0-9-]+}.miinventariofacil.com\`)"
   --label "traefik.http.routers.frontend-prod.entrypoints=websecure"
   --label "traefik.http.routers.frontend-prod.tls.certresolver=myresolver"
   --label "traefik.http.services.frontend-prod.loadbalancer.server.port=80"
   --label "traefik.http.routers.frontend-prod.priority=1"
   --label "traefik.docker.network=web_publica"'

# Landing
recreate_container "landing_prod_server" \
  "gamijoam/ferreteria-landing:$VERSION" \
  "" \
  '--label "traefik.enable=true"
   --label "traefik.http.routers.landing-prod.rule=Host(\`miinventariofacil.com\`,\`www.miinventariofacil.com\`)"
   --label "traefik.http.routers.landing-prod.entrypoints=websecure"
   --label "traefik.http.routers.landing-prod.tls.certresolver=myresolver"
   --label "traefik.http.services.landing-prod.loadbalancer.server.port=80"
   --label "traefik.docker.network=web_publica"'

# Admin Panel
recreate_container "admin_panel_prod_server" \
  "gamijoam/ferreteria-admin-panel:$VERSION" \
  "" \
  '--label "traefik.enable=true"
   --label "traefik.http.routers.admin-prod.rule=Host(\`admin.miinventariofacil.com\`)"
   --label "traefik.http.routers.admin-prod.entrypoints=websecure"
   --label "traefik.http.routers.admin-prod.tls.certresolver=myresolver"
   --label "traefik.http.services.admin-prod.loadbalancer.server.port=80"
   --label "traefik.http.routers.admin-prod.priority=100"
   --label "traefik.docker.network=web_publica"'

# ── PASO 7: Smoke tests ───────────────────────────────────────
title "PASO 7 — Smoke tests"
log "Esperando que los servicios arranquen (30s)..."
sleep 30

FAILED=0
for url in \
  "https://api.miinventariofacil.com/api/v1/health:Backend API" \
  "https://oscarcell.miinventariofacil.com:Frontend" \
  "https://admin.miinventariofacil.com:Admin Panel"; do
  URL="${url%%:*}"; NAME="${url##*:}"
  CODE=$(curl -s --max-time 10 "$URL" -o /dev/null -w "%{http_code}" || echo "000")
  if [ "$CODE" = "200" ]; then
    success "$NAME → HTTP $CODE"
  else
    error "$NAME → HTTP $CODE ❌"
    FAILED=$((FAILED + 1))
  fi
done

if [ $FAILED -gt 0 ]; then
  error "$FAILED servicios fallaron — ejecutando rollback"
  rollback
fi

# ── PASO 8: Push a GitHub ─────────────────────────────────────
title "PASO 8 — Push a GitHub"
cd "$CODE_DIR"
git push origin main >> "$LOG_FILE" 2>&1
success "GitHub actualizado"

# ── Resumen final ─────────────────────────────────────────────
title "DEPLOY COMPLETADO"
echo ""
success "Versión desplegada: $VERSION"
success "Log completo: $LOG_FILE"
echo ""
echo "  Backend:    https://api.miinventariofacil.com/api/v1/health"
echo "  Frontend:   https://oscarcell.miinventariofacil.com"
echo "  Admin:      https://admin.miinventariofacil.com"
echo ""
echo -e "${YELLOW}Para rollback:${NC}"
echo "  sed -i 's/^TAG=.*/TAG=$OLD_TAG/' $PROD_ENV && ./deploy.sh --only-restart"
