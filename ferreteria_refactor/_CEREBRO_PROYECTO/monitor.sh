#!/bin/bash
# =============================================================
# monitor.sh — Mi Inventario Fácil
# Monitoreo interno — corre cada minuto via cron
# Si detecta caída: intenta auto-recuperar y notifica por WhatsApp
# =============================================================

LOG="/var/log/mi-inventario-monitor.log"
ALERT_COOLDOWN=300  # segundos entre alertas del mismo servicio
COOLDOWN_DIR="/tmp/monitor_cooldowns"
mkdir -p "$COOLDOWN_DIR"

# Config WhatsApp admin (número del dueño)
WA_ADMIN_PHONE="584148529805"
WA_INSTANCE="solucionescodecraft"
WA_SERVICE_URL="http://172.18.0.18:3000"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG"; }

# ── Enviar alerta WhatsApp ────────────────────────────────────
send_alert() {
  local MSG="$1"
  local KEY="$2"
  local COOLDOWN_FILE="$COOLDOWN_DIR/$KEY"

  # No enviar si ya se envió una alerta reciente
  if [ -f "$COOLDOWN_FILE" ]; then
    local LAST=$(cat "$COOLDOWN_FILE")
    local NOW=$(date +%s)
    if [ $((NOW - LAST)) -lt $ALERT_COOLDOWN ]; then
      return 0
    fi
  fi

  # Enviar mensaje
  curl -s --max-time 5 -X POST "$WA_SERVICE_URL/instance/$WA_INSTANCE/send" \
    -H "Content-Type: application/json" \
    -d "{\"phone\":\"$WA_ADMIN_PHONE\",\"message\":\"$MSG\"}" \
    > /dev/null 2>&1

  date +%s > "$COOLDOWN_FILE"
  log "ALERT enviada: $MSG"
}

send_ok() {
  local MSG="$1"
  local KEY="$2"
  # Solo enviar "recuperado" si hubo una alerta previa
  if [ -f "$COOLDOWN_DIR/$KEY" ]; then
    send_alert "$MSG" "${KEY}_ok"
    rm -f "$COOLDOWN_DIR/$KEY"
  fi
}

# ── Verificar contenedor ──────────────────────────────────────
check_container() {
  local NAME="$1"
  local KEY="${NAME//_/-}"

  if ! docker ps --filter "name=^/${NAME}$" --filter "status=running" | grep -q "$NAME"; then
    log "CAÍDO: $NAME"
    send_alert "⚠️ *Mi Inventario*\n\nServicio *$NAME* está caído.\n\nIntentando reiniciar..." "cont_$KEY"

    # Intentar reiniciar
    docker restart "$NAME" > /dev/null 2>&1
    sleep 10

    if docker ps --filter "name=^/${NAME}$" --filter "status=running" | grep -q "$NAME"; then
      log "RECUPERADO: $NAME"
      send_alert "✅ *Mi Inventario*\n\nServicio *$NAME* se recuperó automáticamente." "cont_${KEY}_ok"
      rm -f "$COOLDOWN_DIR/cont_$KEY"
    else
      log "FALLO CRÍTICO: $NAME no pudo reiniciarse"
      send_alert "🚨 *Mi Inventario — CRÍTICO*\n\nServicio *$NAME* NO pudo reiniciarse.\n\nRequiere intervención manual." "cont_${KEY}_critical"
    fi
    return 1
  fi
  return 0
}

# ── Verificar endpoint HTTP ───────────────────────────────────
check_http() {
  local URL="$1"
  local NAME="$2"
  local KEY="${NAME// /_}"

  local CODE
  CODE=$(curl -s --max-time 8 "$URL" -o /dev/null -w "%{http_code}" 2>/dev/null || echo "000")

  if [ "$CODE" != "200" ]; then
    log "HTTP FALLO: $NAME → $CODE"
    send_alert "⚠️ *Mi Inventario*\n\n*$NAME* no responde (HTTP $CODE)\nURL: $URL" "http_$KEY"
    return 1
  else
    send_ok "✅ *Mi Inventario*\n\n*$NAME* se recuperó (HTTP $CODE)" "http_$KEY"
    return 0
  fi
}

# ── Verificar disco ───────────────────────────────────────────
check_disk() {
  local USAGE
  USAGE=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
  if [ "$USAGE" -gt 85 ]; then
    log "DISCO ALTO: ${USAGE}%"
    send_alert "⚠️ *Mi Inventario*\n\nDisco al *${USAGE}%* de capacidad.\n\nConsiderar limpiar imágenes Docker antiguas." "disk_usage"
  fi
}

# ── Verificar BD ──────────────────────────────────────────────
check_db() {
  if ! docker exec db_prod_server pg_isready -U postgres > /dev/null 2>&1; then
    log "BD CAÍDA: db_prod_server"
    send_alert "🚨 *Mi Inventario — CRÍTICO*\n\n*Base de datos de producción* no responde.\n\nRequiere intervención URGENTE." "db_prod"
    return 1
  fi
  send_ok "✅ *Mi Inventario*\n\nBase de datos se recuperó." "db_prod"
  return 0
}

# ── Ejecutar todas las verificaciones ────────────────────────
log "--- Ciclo de monitoreo ---"

# Contenedores críticos
check_container "backend_prod_server"
check_container "frontend_prod_server"
check_container "db_prod_server"
check_container "whatsapp_service"

# Endpoints HTTP (vía IP interna para evitar depender de Cloudflare)
BACKEND_IP=$(docker inspect backend_prod_server \
  --format '{{.NetworkSettings.Networks.web_publica.IPAddress}}' 2>/dev/null)

if [ -n "$BACKEND_IP" ]; then
  check_http "http://$BACKEND_IP:8000/api/v1/health" "Backend API"
fi

# Disco
check_disk

# BD
check_db

log "--- Fin ciclo ---"
