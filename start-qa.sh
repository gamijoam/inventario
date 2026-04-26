#!/bin/bash
set -e

echo "=== QA Deploy Script ==="
cd /root/deploy/qa

TAG=${TAG:-qa-pos-warranty-pdf}
CODE_DIR=/root/deploy/qa/code
DB_NAME=invensoft_qa
DB_USER=postgres
DB_PASS=GaboMac12

echo "[1/6] Verificando redes..."
docker network create qa_qa_internal 2>/dev/null || true

echo "[2/6] Iniciando DB..."
if ! docker ps -a --format '{{.Names}}' | grep -q "^db_qa_server$"; then
    docker run -d \
        --name db_qa_server \
        --network qa_qa_internal \
        --restart always \
        -e POSTGRES_USER=$DB_USER \
        -e POSTGRES_PASSWORD=$DB_PASS \
        -e POSTGRES_DB=$DB_NAME \
        -v /root/deploy/qa/data/postgres:/var/lib/postgresql/data \
        postgres:15-alpine
    echo "Esperando DB..."
    sleep 5
else
    docker start db_qa_server 2>/dev/null || true
fi

echo "[3/6] Iniciando Backend con auto-reload..."
if ! docker ps --format '{{.Names}}' | grep -q "^backend_qa_server$"; then
    docker run -d \
        --name backend_qa_server \
        --network web_publica \
        --network qa_qa_internal \
        --restart always \
        -p 8000:8000 \
        -e TZ=America/Caracas \
        -e POSTGRES_USER=$DB_USER \
        -e POSTGRES_PASSWORD=$DB_PASS \
        -e POSTGRES_DB=$DB_NAME \
        -e DATABASE_URL="postgresql://$DB_USER:$DB_PASS@db_qa_server:5432/$DB_NAME" \
        -e SECRET_KEY="YUlN7Uxgn6iN7X8cOJpOG0ZIVcs-D9HgY8lGTtakyh5l-OKTht5damr0UnQXulgXIaYJ4KLVYpz-mcMbmUfnrQ" \
        -e SINGLE_TENANT=true \
        -e SINGLE_TENANT_SCHEMA=default \
        -e MODE=production \
        -e DEBUG=false \
        -v /root/deploy/qa/data/media:/app/media \
        -v /root/deploy/qa/backups:/app/backups \
        -v $CODE_DIR:/app/ferreteria_refactor:ro \
        --entrypoint /bin/bash \
        gamijoam/ferreteria-backend:$TAG \
        -c "alembic -c /app/ferreteria_refactor/alembic.ini upgrade head 2>/dev/null || true; exec uvicorn ferreteria_refactor.backend_api.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir /app/ferreteria_refactor"
else
    docker start backend_qa_server 2>/dev/null || true
fi

echo "[4/6] Iniciando Frontend..."
if ! docker ps --format '{{.Names}}' | grep -q "^frontend_qa_server$"; then
    docker run -d \
        --name frontend_qa_server \
        --network web_publica \
        --restart always \
        -e VITE_API_URL=https://api-qa.miinventariofacil.com \
        -e VITE_ADMIN_API_URL=https://admin-api-qa.miinventariofacil.com \
        gamijoam/ferreteria-app:$TAG
else
    docker start frontend_qa_server 2>/dev/null || true
fi

echo "[5/6] Iniciando Admin Panel..."
if ! docker ps --format '{{.Names}}' | grep -q "^admin_panel_qa$"; then
    docker run -d \
        --name admin_panel_qa \
        --network web_publica \
        --restart always \
        gamijoam/ferreteria-admin-panel:$TAG
else
    docker start admin_panel_qa 2>/dev/null || true
fi

echo "[6/6] Iniciando Landing..."
if ! docker ps --format '{{.Names}}' | grep -q "^landing_qa_server$"; then
    docker run -d \
        --name landing_qa_server \
        --network web_publica \
        --restart always \
        gamijoam/ferreteria-landing:$TAG
else
    docker start landing_qa_server 2>/dev/null || true
fi

echo ""
echo "=== Status ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "qa|QA" | grep -v "CONTAINER"