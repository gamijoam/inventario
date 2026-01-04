#!/bin/bash
set -e  # Exit immediately if a command exits with a non-zero status

echo "🚀 =========================================="
echo "🚀 FERRETERÍA API - INICIO DE CONTENEDOR"
echo "🚀 =========================================="

# ============================================
# 1. HEALTHCHECK: ESPERAR A POSTGRESQL
# ============================================
echo ""
echo "⏳ [1/3] Esperando a que PostgreSQL esté listo..."

MAX_RETRIES=30
RETRY_COUNT=0

until PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c '\q' 2>/dev/null; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "❌ ERROR: PostgreSQL no respondió después de $MAX_RETRIES intentos"
    echo "❌ Verifica la configuración de DB_HOST, DB_USER, DB_PASSWORD"
    exit 1
  fi
  
  echo "   PostgreSQL no disponible (intento $RETRY_COUNT/$MAX_RETRIES) - esperando 2s..."
  sleep 2
done

echo "✅ PostgreSQL está listo y aceptando conexiones!"

# ============================================
# 2. MIGRACIONES DE ALEMBIC (ÚNICA FUENTE DE VERDAD)
# ============================================
echo ""
echo "📦 [2/3] Aplicando migraciones de Alembic..."

# Ejecutar migraciones
alembic upgrade head

# Verificar resultado
if [ $? -ne 0 ]; then
  echo "❌ ERROR CRÍTICO: Las migraciones de Alembic fallaron"
  echo "❌ Revisa los logs arriba para más detalles"
  echo "❌ La aplicación NO puede iniciar con un esquema incorrecto"
  exit 1
fi

echo "✅ Migraciones aplicadas correctamente"

# ============================================
# 3. INICIAR SERVIDOR UVICORN
# ============================================
echo ""
echo "🌐 [3/3] Iniciando servidor Uvicorn..."
echo "🌐 Host: 0.0.0.0:8000"
echo "🌐 Workers: 1 (desarrollo) / 4 (producción recomendado)"
echo ""

# Detectar entorno
if [ "$ENVIRONMENT" = "production" ]; then
  echo "🔒 Modo: PRODUCCIÓN"
  exec uvicorn backend_api.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers 4 \
    --log-level info
else
  echo "🔧 Modo: DESARROLLO"
  exec uvicorn backend_api.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload \
    --log-level debug
fi
