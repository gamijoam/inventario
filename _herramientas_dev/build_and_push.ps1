# Script para Construir y Subir Imagenes Docker
# Autor: AntiGravity
# Uso: .\build_and_push.ps1 [version]

param (
    [string]$Version = "latest"
)

# Configuracion
$REGISTRY = "ghcr.io"
$NAMESPACE = "gamijoam"
$IMAGE_BACKEND = "$REGISTRY/$NAMESPACE/ferreteria-backend"
$IMAGE_FRONTEND = "$REGISTRY/$NAMESPACE/ferreteria-frontend"

Write-Host "Iniciando proceso de construccion para version: $Version" -ForegroundColor Yellow

# 1. Login
Write-Host "Verificando sesion en Docker..." -ForegroundColor Cyan
docker login $REGISTRY
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: No se pudo iniciar sesion en $REGISTRY." -ForegroundColor Red
    Write-Host "Ejecuta manualmente: docker login ghcr.io" -ForegroundColor Red
    exit 1
}

# 2. Construir Backend
Write-Host "Construyendo Backend..." -ForegroundColor Cyan
docker build -t "${IMAGE_BACKEND}:${Version}" -f ferreteria_refactor/backend_api/Dockerfile .
if ($LASTEXITCODE -ne 0) { Write-Host "Fallo build de Backend"; exit 1 }

# 3. Construir Frontend
Write-Host "Construyendo Frontend..." -ForegroundColor Cyan
docker build -t "${IMAGE_FRONTEND}:${Version}" -f ferreteria_refactor/frontend_web/Dockerfile ./ferreteria_refactor/frontend_web
if ($LASTEXITCODE -ne 0) { Write-Host "Fallo build de Frontend"; exit 1 }

# 4. Push Backend
Write-Host "Subiendo Backend..." -ForegroundColor Cyan
docker push "${IMAGE_BACKEND}:${Version}"

# 5. Push Frontend
Write-Host "Subiendo Frontend..." -ForegroundColor Cyan
docker push "${IMAGE_FRONTEND}:${Version}"

Write-Host "Proceso completado con exito!" -ForegroundColor Green
Write-Host "   - ${IMAGE_BACKEND}:${Version}"
Write-Host "   - ${IMAGE_FRONTEND}:${Version}"
