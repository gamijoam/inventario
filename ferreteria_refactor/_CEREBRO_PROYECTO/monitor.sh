#!/bin/bash
# =============================================================
# monitor.sh — Mi Inventario Fácil
# Monitoreo interno — corre cada minuto via cron
#
# CONFIGURACIÓN: editar /root/deploy/monitor.conf
#   ADMIN_PHONE → número que recibe las alertas
#
# CÓMO FUNCIONA EL WHATSAPP DEL MONITOR:
#   No usa el WhatsApp de ningún tenant específico.
#   Consulta la BD de producción y encuentra automáticamente
#   cualquier tenant que tenga WhatsApp conectado (CONNECTED)
#   y tenga configurado un admin_phone. Usa ese para enviar.
#   Si ningún tenant tiene WhatsApp conectado → solo loguea.
# =============================================================

# ── Cargar configuración ──────────────────────────────────────
CONF="/root/deploy/monitor.conf"
if [ -f "$CONF" ]; then
  source "$CONF"
else
  echo "⚠️ No existe $CONF — usando valores por defecto"
fi

ADMIN_PHONE="${ADMIN_PHONE:-}"
ALERT_COOLDOWN="${ALERT_COOLDOWN:-300}"
DISK_ALERT_THRESHOLD="${DISK_ALERT_THRESHOLD:-85}"

LOG="/var/log/mi-inventario-monitor.log"
COOLDOWN_DIR="/tmp/monitor_cooldowns"
WA_SERVICE_URL="http://whatsapp_service:3000"
mkdir -p "$COOLDOWN_DIR"

log()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG"; }

# ── Encontrar instancia WhatsApp disponible ───────────────────
# Busca en la BD cualquier tenant con WhatsApp CONNECTED
# No depende de un tenant específico
find_wa_instance() {
  docker exec db_prod_server psql -U postgres -d invensoft_prod -t -A -F'|' -c "
    SELECT DISTINCT
      bc_inst.value AS instance_name
    FROM public.tenants t
    JOIN LATERAL (
      SELECT value FROM information_schema.tables it
      WHERE it.table_schema = t.schema_name
        AND it.table_name = 'business_config'
      LIMIT 1
    ) chk ON true
    CROSS JOIN LATERAL (
      SELECT value FROM information_schema.columns ic
      WHERE ic.table_schema = t.schema_name
        AND ic.table_name = 'business_config'
      LIMIT 1
    ) chk2
    JOIN LATERAL (
      SELECT value FROM unnest(ARRAY[
        (SELECT bc.value FROM business_config bc
         WHERE bc.key = 'whatsapp_instance_status'
         LIMIT 1)
      ]) AS val(value)
      WHERE val.value = 'CONNECTED'
    ) status_check ON true
    CROSS JOIN LATERAL (
      SELECT bc_i.value FROM business_config bc_i
      WHERE bc_i.key = 'whatsapp_instance_name'
      LIMIT 1
    ) bc_inst
    WHERE t.is_active = true
    LIMIT 1
  " 2>/dev/null | head -1
}

# Método más simple y directo
find_wa_instance_simple() {
  # Buscar en cada schema activo cuál tiene WhatsApp conectado
  local schemas
  schemas=$(docker exec db_prod_server psql -U postgres -d invensoft_prod -t -A -c \
    "SELECT schema_name FROM public.tenants WHERE is_active=true;" 2>/dev/null)

  for schema in $schemas; do
    local status inst
    status=$(docker exec db_prod_server psql -U postgres -d invensoft_prod -t -A -c \
      "SELECT value FROM ${schema}.business_config WHERE key='whatsapp_instance_status' LIMIT 1;" 2>/dev/null)
    if [ "$status" = "CONNECTED" ]; then
      inst=$(docker exec db_prod_server psql -U postgres -d invensoft_prod -t -A -c \
        "SELECT value FROM ${schema}.business_config WHERE key='whatsapp_instance_name' LIMIT 1;" 2>/dev/null)
      if [ -n "$inst" ]; then
        echo "$inst"
        return 0
      fi
    fi
  done
  return 1
}

# ── Enviar alerta WhatsApp ────────────────────────────────────
send_alert() {
  local MSG="$1"
  local KEY="$2"
  local COOLDOWN_FILE="$COOLDOWN_DIR/$KEY"

  # Respetar cooldown
  if [ -f "$COOLDOWN_FILE" ]; then
    local LAST NOW
    LAST=$(cat "$COOLDOWN_FILE")
    NOW=$(date +%s)
    if [ $((NOW - LAST)) -lt $ALERT_COOLDOWN ]; then
      return 0
    fi
  fi

  # Necesitamos número de destino
  if [ -z "$ADMIN_PHONE" ]; then
    log "⚠️ ADMIN_PHONE no configurado en $CONF — solo logueando"
    return 0
  fi

  # Buscar instancia WhatsApp disponible
  local WA_INST
  WA_INST=$(find_wa_instance_simple 2>/dev/null)

  if [ -z "$WA_INST" ]; then
    log "⚠️ Sin WhatsApp conectado en ningún tenant — solo logueando: $MSG"
    date +%s > "$COOLDOWN_FILE"
    return 0
  fi

  # Enviar
  local RESULT
  RESULT=$(curl -s --max-time 5 -X POST "$WA_SERVICE_URL/instance/$WA_INST/send" \
    -H "Content-Type: application/json" \
    -d "{\"phone\":\"$ADMIN_PHONE\",\"message\":\"$MSG\"}" 2>/dev/null)

  if echo "$RESULT" | grep -q '"ok":true'; then
    log "✅ Alerta enviada vía $WA_INST → $ADMIN_PHONE"
  else
    log "⚠️ Error enviando alerta: $RESULT"
  fi

  date +%s > "$COOLDOWN_FILE"
}

send_recovery() {
  local MSG="$1"
  local KEY="$2"
  if [ -f "$COOLDOWN_DIR/$KEY" ]; then
    send_alert "$MSG" "${KEY}_recovery"
    rm -f "$COOLDOWN_DIR/$KEY"
  fi
}

# ── Verificar contenedor ──────────────────────────────────────
check_container() {
  local NAME="$1"
  local KEY="cont_${NAME//_/-}"

  if ! docker ps --filter "name=^/${NAME}$" --filter "status=running" | grep -q "$NAME"; then
    log "CAÍDO: $NAME — intentando reiniciar..."
    send_alert "⚠️ *Mi Inventario*\n\nServicio *$NAME* caído.\nIntentando reiniciar automáticamente..." "$KEY"

    docker restart "$NAME" > /dev/null 2>&1
    sleep 15

    if docker ps --filter "name=^/${NAME}$" --filter "status=running" | grep -q "$NAME"; then
      log "RECUPERADO: $NAME"
      send_alert "✅ *Mi Inventario*\n\n*$NAME* se recuperó automáticamente. Todo OK." "${KEY}_ok"
      rm -f "$COOLDOWN_DIR/$KEY"
    else
      log "CRÍTICO: $NAME no pudo reiniciarse"
      send_alert "🚨 *Mi Inventario — CRÍTICO*\n\n*$NAME* no pudo reiniciarse.\n\n⚡ Requiere intervención manual urgente." "${KEY}_critical"
    fi
  else
    send_recovery "✅ *Mi Inventario*\n\n*$NAME* se recuperó." "$KEY"
  fi
}

# ── Verificar endpoint HTTP interno ──────────────────────────
check_backend() {
  local IP KEY="backend_http"
  IP=$(docker inspect backend_prod_server \
    --format '{{.NetworkSettings.Networks.web_publica.IPAddress}}' 2>/dev/null)
  [ -z "$IP" ] && return 0

  local CODE
  CODE=$(curl -s --max-time 8 "http://$IP:8000/api/v1/health" \
    -o /dev/null -w "%{http_code}" 2>/dev/null || echo "000")

  if [ "$CODE" != "200" ]; then
    log "BACKEND HTTP FALLO: $CODE"
    send_alert "⚠️ *Mi Inventario*\n\nBackend API no responde (HTTP $CODE)\nVerificar contenedor backend_prod_server" "$KEY"
  else
    send_recovery "✅ *Mi Inventario*\n\nBackend API recuperado." "$KEY"
  fi
}

# ── Verificar disco ───────────────────────────────────────────
check_disk() {
  local USAGE
  USAGE=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
  if [ "$USAGE" -gt "$DISK_ALERT_THRESHOLD" ]; then
    log "DISCO ALTO: ${USAGE}%"
    send_alert "⚠️ *Mi Inventario — Disco*\n\nCapacidad: *${USAGE}%*\n\nLimpiar imágenes Docker antiguas:\ndocker image prune -a" "disk_${USAGE}"
  fi
}

# ── Verificar BD ──────────────────────────────────────────────
check_db() {
  local KEY="db_prod"
  if ! docker exec db_prod_server pg_isready -U postgres -q 2>/dev/null; then
    log "BD CAÍDA"
    send_alert "🚨 *Mi Inventario — CRÍTICO*\n\n*Base de datos* no responde.\n\nIntervención URGENTE requerida." "$KEY"
  else
    send_recovery "✅ *Mi Inventario*\n\nBase de datos recuperada." "$KEY"
  fi
}

# ── Ejecutar todas las verificaciones ────────────────────────
log "--- Ciclo de monitoreo ---"
check_container "backend_prod_server"
check_container "frontend_prod_server"
check_container "db_prod_server"
check_container "whatsapp_service"
check_backend
check_disk
check_db
log "--- Fin ciclo ---"
