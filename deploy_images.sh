#!/bin/bash

# Configuración
USER="gamijoam"
TAG="v1"

echo "------------------------------------------------"
echo "🚀 Iniciando Build & Push para Producción"
echo "------------------------------------------------"

# 1. Backend
echo "🏗️ [1/3] Construyendo imagen del Backend..."
docker build -f ./ferreteria_refactor/backend_api/Dockerfile -t $USER/ferreteria-backend:$TAG .
echo "✅ Backend construido."

# 2. Frontend App
echo "🏗️ [2/3] Construyendo imagen del Frontend App..."
docker build -f ./ferreteria_refactor/frontend_web/Dockerfile.prod -t $USER/ferreteria-app:$TAG ./ferreteria_refactor/frontend_web
echo "✅ Frontend App construido."

# 3. Landing Page
echo "🏗️ [3/3] Construyendo imagen de la Landing Page..."
docker build -t $USER/ferreteria-landing:$TAG ./landing_page
echo "✅ Landing Page construida."

echo "------------------------------------------------"
echo "☁️ Subiendo imágenes a Docker Hub..."
echo "------------------------------------------------"

docker push $USER/ferreteria-backend:$TAG
docker push $USER/ferreteria-app:$TAG
docker push $USER/ferreteria-landing:$TAG

echo "------------------------------------------------"
echo "🏆 ¡PROCESO FINALIZADO EXITOSAMENTE!"
echo "Las imágenes están listas en Docker Hub."
echo "------------------------------------------------"
