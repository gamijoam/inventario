#!/bin/bash

###############################################################################
#                                                                             #
#  BUILD AND DEPLOY FRONTEND QA                                             #
#  Compila la imagen Docker del frontend y la despliega en QA               #
#                                                                             #
#  Uso: ./build_and_deploy_qa.sh                                            #
#                                                                             #
###############################################################################

set -e

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  🔨 BUILD FRONTEND QA - FASE 2                               ║"
echo "║  $(date '+%Y-%m-%d %H:%M:%S')                              ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Variables
PROJECT_DIR="/root/deploy/qa/code/ferreteria_refactor"
FRONTEND_DIR="$PROJECT_DIR/frontend_web"
QA_ENV="/root/deploy/qa/.env"
REGISTRY="gamijoam"
IMAGE_NAME="ferreteria-app"
API_URL="https://api-qa.miinventariofacil.com/api/v1"

# Obtener versión actual
CURRENT_VERSION=$(grep "TAG=" $QA_ENV | cut -d'=' -f2)
CURRENT_NUM=$(echo $CURRENT_VERSION | grep -o '[0-9]*$')
NEW_NUM=$((CURRENT_NUM + 1))
NEW_VERSION="qa-version-$NEW_NUM"

echo "📊 INFORMACIÓN DEL BUILD"
echo "─────────────────────────────────────────────────────────────────"
echo "Proyecto:        $PROJECT_DIR"
echo "Frontend:        $FRONTEND_DIR"
echo "Versión actual:  $CURRENT_VERSION"
echo "Versión nueva:   $NEW_VERSION"
echo "API URL:         $API_URL"
echo "Imagen:          $REGISTRY/$IMAGE_NAME:$NEW_VERSION"
echo ""

# Step 1: Ir al directorio frontend
echo "📁 Entrando a directorio frontend..."
cd $FRONTEND_DIR
echo "   ✓ En: $(pwd)"
echo ""

# Step 2: Build de la imagen Docker
echo "🐳 Construyendo imagen Docker..."
echo "   Comando: docker build -f Dockerfile.prod \\"
echo "            --build-arg VITE_API_URL=$API_URL \\"
echo "            -t $REGISTRY/$IMAGE_NAME:$NEW_VERSION ."
echo ""

docker build -f Dockerfile.prod \
  --build-arg VITE_API_URL=$API_URL \
  -t $REGISTRY/$IMAGE_NAME:$NEW_VERSION .

if [ $? -ne 0 ]; then
  echo "   ❌ Error en build de Docker"
  exit 1
fi

echo ""
echo "   ✓ Imagen construida: $REGISTRY/$IMAGE_NAME:$NEW_VERSION"
echo ""

# Step 3: Push a DockerHub
echo "📤 Subiendo a DockerHub..."
docker push $REGISTRY/$IMAGE_NAME:$NEW_VERSION

if [ $? -ne 0 ]; then
  echo "   ❌ Error en push a DockerHub"
  exit 1
fi

echo "   ✓ Imagen en DockerHub"
echo ""

# Step 4: Actualizar .env de QA
echo "⚙️  Actualizando TAG en $QA_ENV..."
sed -i "s/TAG=$CURRENT_VERSION/TAG=$NEW_VERSION/" $QA_ENV
echo "   Cambio: $CURRENT_VERSION → $NEW_VERSION"
echo "   ✓ .env actualizado"
echo ""

# Step 5: Restart del contenedor frontend
echo "🔄 Reiniciando contenedor frontend_qa (servicio en docker-compose)..."
cd /root/deploy/qa
docker-compose up -d --no-deps --force-recreate frontend_qa

if [ $? -ne 0 ]; then
  echo "   ❌ Error al reiniciar contenedor"
  exit 1
fi

echo "   ✓ Contenedor reiniciado"
echo ""

# Step 6: Esperar a que esté listo
echo "⏳ Esperando 30 segundos para que se levante..."
sleep 30
echo "   ✓ Listo"
echo ""

# Step 7: Verificación
echo "✅ Verificando contenedor..."
docker ps | grep frontend_qa_server > /dev/null

if [ $? -ne 0 ]; then
  echo "   ⚠️  Contenedor podría no estar corriendo"
  echo "   Revisa: docker logs frontend_qa_server"
else
  echo "   ✓ Contenedor activo y funcionando"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  ✅ BUILD Y DEPLOY COMPLETADO                                 ║"
echo "║                                                                ║"
echo "║  Imagen:     $REGISTRY/$IMAGE_NAME:$NEW_VERSION"
echo "║  Versión:    $NEW_VERSION"
echo "║  Estado:     ✓ Desplegado en QA"
echo "║                                                                ║"
echo "║  Ahora:                                                        ║"
echo "║  1. Abre navegador                                             ║"
echo "║  2. Recarga: Ctrl+F5                                           ║"
echo "║  3. URL: http://app-qa.miinventariofacil.com/services         ║"
echo "║                                                                ║"
echo "║  Deberías ver los cambios nuevos de FASE 2                    ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
