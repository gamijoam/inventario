@echo off
setlocal enabledelayedexpansion
set USER=gamijoam

echo ================================================
echo      SISTEMA DE DESPLIEGUE VERSIONADO
echo ================================================

:: Generar un tag basado en fecha/hora para evitar duplicados (Ej: 20231024-1530)
set hour=%time:~0,2%
if "%hour:~0,1%"==" " set hour=0%hour:~1,1%
set DATETAG=%date:~10,4%%date:~4,2%%date:~7,2%-%hour%%time:~3,2%

echo 1) Entorno QA (Tag sugerido: qa-%DATETAG%)
echo 2) Entorno PRODUCCION (Tag sugerido: prod-%DATETAG%)
set /p ENV_CHOICE="Elige entorno (1 o 2): "

if "%ENV_CHOICE%"=="1" (
    set PREFIX=qa
    set API_URL=https://api-qa.miinventariofacil.com/api/v1
) else (
    set PREFIX=prod
    set API_URL=https://api.miinventariofacil.com/api/v1
)

set /p VERSION="Ingresa sufijo de version (ej: 1, fix-login, o presiona enter para usar fecha): "
if "%VERSION%"=="" (set TAG=%PREFIX%-%DATETAG%) else (set TAG=%PREFIX%-%VERSION%)

echo.
:: --- MODO DE CONSTRUCCION (.dockerignore) ---
echo.
echo ================================================
echo      SELECCIONAR MODO DE CONSTRUCCION
echo ================================================
echo 1) FAST MODE (Recomendado): Solo codigo, ignora .exe, .iso, bridges (Rapido)
echo 2) FULL MODE: Incluye TODO (Invensoft Bridge, Hardware Bridge, .exe)
echo.
set /p BUILD_MODE="Elige modo (1 o 2) [Default 1]: "

if "%BUILD_MODE%"=="2" (
    echo [MODO] FULL MODE SELECCIONADO - Se incluiran binarios.
    copy /Y .dockerignore.full .dockerignore
) else (
    echo [MODO] FAST MODE SELECCIONADO - Se ignoraran binarios pesados.
    copy /Y .dockerignore.fast .dockerignore
)

echo.
echo [CONFIRMACION] Se usara el TAG: %TAG%
echo [CONFIRMACION] API URL: %API_URL%
pause

:: --- PROCESO DE BUILD (Corregido y Unificado) ---

:: 1. Backend
echo 🏗️ Construyendo Backend...
docker build -f ./ferreteria_refactor/backend_api/Dockerfile -t %USER%/ferreteria-backend:%TAG% .

:: 2. Frontend App
echo 🏗️ Construyendo Frontend App...
docker build --no-cache --build-arg VITE_API_URL=%API_URL% -f ./ferreteria_refactor/frontend_web/Dockerfile.prod -t %USER%/ferreteria-app:%TAG% ./ferreteria_refactor/frontend_web

:: 3. Landing
echo 🏗️ Construyendo Landing...
docker build --no-cache --build-arg VITE_API_URL=%API_URL% -t %USER%/ferreteria-landing:%TAG% ./landing_page

:: 4. Admin Panel (CORREGIDO: Ya no usa dev-fix-2 fijo)
echo 🏗️ Construyendo Admin Panel...
docker build --no-cache --build-arg VITE_API_URL=%API_URL% -f ./ferreteria_refactor/saas_admin/Dockerfile -t %USER%/ferreteria-admin-panel:%TAG% ./ferreteria_refactor/saas_admin

:: --- PUSH ---
echo ☁️ Subiendo imagenes...
docker push %USER%/ferreteria-backend:%TAG%
docker push %USER%/ferreteria-app:%TAG%
docker push %USER%/ferreteria-landing:%TAG%
docker push %USER%/ferreteria-admin-panel:%TAG%

echo.
echo ================================================
echo ✅ PROCESO EXITOSO
echo TAG PARA EL VPS: %TAG%
echo ================================================
pause