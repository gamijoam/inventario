#!/usr/bin/env bash
set -e

echo "Iniciando servicios..."
alembic -c /app/ferreteria_refactor/alembic.ini upgrade head || echo "Alembic failed, continuing..."
python3 /app/ferreteria_refactor/backend_api/migrate_tenants.py || echo "Tenant migration failed, continuing..."

exec uvicorn ferreteria_refactor.backend_api.main:app --host 0.0.0.0 --port 8000
