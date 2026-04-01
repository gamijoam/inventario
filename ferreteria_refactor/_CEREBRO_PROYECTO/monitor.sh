#!/bin/bash
# =============================================================
# monitor.sh — Mi Inventario Fácil
# Monitoreo interno — corre cada minuto via cron
# Alertas vía Telegram Bot (independiente de los tenants)
# Configuración: /root/deploy/monitor.conf
# =============================================================
set -uo pipefail

CONF="/root/deploy/monitor.conf"
[ -f "$CONF" ] && source "$CONF" || { echo "ERROR: No existe $CONF"; exit 1; }

TELEGRAM_TOKEN="${TELEGRAM_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"
ALERT_COOLDOWN="${ALERT_COOLDOWN:-300}"
DISK_ALERT_THRESHOLD="${DISK_ALERT_THRESHOLD:-85}"

LOG="/var/log/mi-inventario-monitor.log"
COOLDOWN_DIR="/tmp/monitor_cooldowns"
mkdir -p "$COOLDOWN_DIR"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG"; }

# ── Enviar mensaje Telegram ───────────────────────────────────
send_telegram() {
  local MSG="$1"
  [ -z "$TELEGRAM_TOKEN" ] || [ -z "$TELEGRAM_CHAT_ID" ] && {
    log "⚠️ Telegram no configurado — solo log"
    return 0
  }
  curl -s --max-time 8 -X POST \
    "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
    -H "Content-Type: application/json" \
    -d "{\"chat_id\":\"$TELEGRAM_CHAT_ID\",\"text\":\"$MSG\",\"parse_mode\":\"Markdown\"}" \
    > /dev/null 2>&1
}

# ── Enviar con cooldown ───────────────────────────────────────
send_alert() {
  local MSG="$1" KEY="$2"
  local FILE="$COOLDOWN_DIR/$KEY"
  if [ -f "$FILE" ]; then
    local LAST NOW
    LAST=$(cat "$FILE"); NOW=$(date +%s)
    [ $((NOW - LAST)) -lt "$ALERT_COOLDOWN" ] && return 0
  fi
  send_telegram "$MSG"
  date +%s > "$FILE"
  log "ALERTA: $MSG"
}

send_recovery() {
  local MSG="$1" KEY="$2"
  if [ -f "$COOLDOWN_DIR/$KEY" ]; then
    send_telegram "$MSG"
    rm -f "$COOLDOWN_DIR/$KEY"
    log "RECUPERADO: $KEY"
  fi
}

# ── Verificar contenedor ──────────────────────────────────────
check_container() {
  local NAME="$1" KEY="cont_${1//_/-}"

  if ! docker ps --filter "name=^/${NAME}$" --filter "status=running" \
       --format "{{.Names}}" | grep -q "^${NAME}$"; then

    log "CAÍDO: $NAME"
    send_alert "⚠️ *Mi Inventario*\n\nServicio *${NAME}* caído\nIntentando reiniciar automáticamente..." "$KEY"

    docker restart "$NAME" > /dev/null 2>&1
    sleep 15

    if docker ps --filter "name=^/${NAME}$" --filter "status=running" \
        --format "{{.Names}}" | grep -q "^${NAME}$"; then
      send_telegram "✅ *Mi Inventario*\n\n*${NAME}* se recuperó automáticamente"
      rm -f "$COOLDOWN_DIR/$KEY"
      log "AUTO-RECUPERADO: $NAME"
    else
      send_alert "🚨 *Mi Inventario — CRÍTICO*\n\n*${NAME}* NO pudo reiniciarse\nRequiere intervención manual urgente" "${KEY}_critical"
    fi
  else
    send_recovery "✅ *Mi Inventario*\n\n*${NAME}* se recuperó" "$KEY"
  fi
}

# ── Verificar backend HTTP ────────────────────────────────────
check_backend() {
  local KEY="backend_http"
  local IP CODE
  IP=$(docker inspect backend_prod_server \
    --format '{{.NetworkSettings.Networks.web_publica.IPAddress}}' 2>/dev/null)
  [ -z "$IP" ] && return 0

  CODE=$(curl -s --max-time 8 "http://${IP}:8000/api/v1/health" \
    -o /dev/null -w "%{http_code}" 2>/dev/null || echo "000")

  if [ "$CODE" != "200" ]; then
    send_alert "⚠️ *Mi Inventario*\n\nBackend API no responde (HTTP $CODE)\nContenedor: backend_prod_server" "$KEY"
    log "BACKEND HTTP: $CODE"
  else
    send_recovery "✅ *Mi Inventario*\n\nBackend API recuperado" "$KEY"
  fi
}

# ── Verificar disco ───────────────────────────────────────────
check_disk() {
  local USAGE
  USAGE=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
  if [ "$USAGE" -gt "$DISK_ALERT_THRESHOLD" ]; then
    send_alert "⚠️ *Mi Inventario — Disco*\n\nCapacidad: *${USAGE}%* de ${DISK_ALERT_THRESHOLD}% límite\n\nLiberar espacio:\n\`docker image prune -a\`" "disk_high"
    log "DISCO: ${USAGE}%"
  fi
}

# ── Verificar base de datos ───────────────────────────────────
check_db() {
  local KEY="db_prod"
  if ! docker exec db_prod_server pg_isready -U postgres -q 2>/dev/null; then
    send_alert "🚨 *Mi Inventario — CRÍTICO*\n\nBase de datos *NO responde*\n\nIntervención URGENTE requerida" "$KEY"
    log "BD CAÍDA"
  else
    send_recovery "✅ *Mi Inventario*\n\nBase de datos recuperada" "$KEY"
  fi
}

# ── Ciclo principal ───────────────────────────────────────────
log "--- Ciclo de monitoreo ---"
check_container "backend_prod_server"
check_container "frontend_prod_server"
check_container "db_prod_server"
check_container "whatsapp_service"
check_backend
check_disk
check_db
log "--- Fin ciclo ---"
