#!/bin/bash
set -e

echo "🚀 Iniciando aplicación..."

# Navegar al directorio correcto
cd /app/ferreteria_refactor

# Ejecutar migraciones de Alembic
echo "📝 Aplicando migraciones de base de datos..."
alembic upgrade head

if [ $? -eq 0 ]; then
    echo "✅ Migraciones aplicadas exitosamente"
else
    echo "❌ Error aplicando migraciones"
    exit 1
fi

# Volver al directorio raíz
cd /app

# Iniciar servidor
echo "🌐 Iniciando servidor FastAPI..."
exec uvicorn ferreteria_refactor.backend_api.main:app --host 0.0.0.0 --port 8000
