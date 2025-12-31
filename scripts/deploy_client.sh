#!/bin/bash

# ============================================
# 🚀 GESTOR DE CLIENTES AUTOMÁTICO - SAAS
# ============================================

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}===============================================${NC}"
echo -e "${BLUE}   🛠️  ASISTENTE DE DESPLIEGUE - FERRETERÍA    ${NC}"
echo -e "${BLUE}===============================================${NC}"

# 1. Solicitar Nombre del Cliente
read -p "Nombre del Cliente (ej: juan, demo): " CLIENT_NAME

if [ -z "$CLIENT_NAME" ]; then
    echo -e "${RED}Error: El nombre es obligatorio.${NC}"
    exit 1
fi

# Verificar si ya existe
if [ -d "/opt/clients/$CLIENT_NAME" ]; then
    echo -e "${RED}Error: El cliente '$CLIENT_NAME' ya existe en /opt/clients/${NC}"
    read -p "¿Deseas sobreescribir? (s/n): " OVERWRITE
    if [ "$OVERWRITE" != "s" ]; then
        exit 1
    fi
fi

# 2. Solicitar Dominio (Con Autocompletado nip.io)
read -p "IP del Servidor (Enter para auto-detectar): " SERVER_IP
if [ -z "$SERVER_IP" ]; then
    SERVER_IP=$(hostname -I | awk '{print $1}')
fi

read -p "Dominio (Enter para usar $CLIENT_NAME.$SERVER_IP.nip.io): " DOMAIN

if [ -z "$DOMAIN" ]; then
    DOMAIN="$CLIENT_NAME.$SERVER_IP.nip.io"
fi

echo -e "${GREEN}Configurando para: $DOMAIN ${NC}"

# 3. Generar Credenciales
DB_PASSWORD=$(openssl rand -hex 12)
SECRET_KEY=$(openssl rand -hex 32)
echo -e "🔑 Generando contraseñas seguras..."

# 4. Crear Base de Datos en Postgres Cluster
echo -e "🗄️  Creando Base de Datos 'db_$CLIENT_NAME'..."
docker exec pg-cluster psql -U admin_cluster -c "CREATE USER $CLIENT_NAME WITH PASSWORD '$DB_PASSWORD';" || true
docker exec pg-cluster psql -U admin_cluster -c "CREATE DATABASE db_$CLIENT_NAME OWNER $CLIENT_NAME;" || true

# 5. Preparar Carpeta
echo -e "📂 Creando estructura de archivos..."
mkdir -p /opt/clients/$CLIENT_NAME
# Asumimos que el template está en /opt/ferreteria
cp /opt/ferreteria/docker-compose.client.template.yml /opt/clients/$CLIENT_NAME/docker-compose.yml

# 6. Crear archivo .env
echo -e "📝 Escribiendo configuración..."
cat > /opt/clients/$CLIENT_NAME/.env <<EOF
CLIENT_NAME=$CLIENT_NAME
DOMAIN=$DOMAIN

# Database
CLIENT_DB_PASSWORD=$DB_PASSWORD

# Security
CLIENT_SECRET_KEY=$SECRET_KEY

# License (Dummy for now - Update via License Generator if needed)
CLIENT_LICENSE_KEY=CLOUD-LICENSE-PENDING
EOF

# 7. Ajustar Imágenes (Hack temporal para usar imágenes locales)
# Reemplazar ghcr.io... por imagen local
sed -i 's|image: ghcr.io/gamijoam/ferreteria-backend:latest|image: ferreteria-backend:latest|g' /opt/clients/$CLIENT_NAME/docker-compose.yml
sed -i 's|image: ghcr.io/gamijoam/ferreteria-frontend:latest|image: ferreteria-frontend:latest|g' /opt/clients/$CLIENT_NAME/docker-compose.yml

# 8. Desplegar
echo -e "🚀 Desplegando Contenedores..."
cd /opt/clients/$CLIENT_NAME
docker-compose up -d

echo -e "${BLUE}===============================================${NC}"
echo -e "${GREEN}✅ ¡CLIENTE DESPLEGADO EXITOSAMENTE!${NC}"
echo -e "${BLUE}===============================================${NC}"
echo -e "🌍 URL:    http://$DOMAIN"
echo -e "🗄️  DB:     db_$CLIENT_NAME (User: $CLIENT_NAME)"
echo -e "🔑 Pass:   $DB_PASSWORD"
echo -e "${BLUE}===============================================${NC}"
