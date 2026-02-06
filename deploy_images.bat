@echo off
setlocal enabledelayedexpansion
set USER=gamijoam

echo ================================================
echo    SELECTOR DE DESPLIEGUE - FERRETERIA
echo ================================================

:: 1. Seleccionar Entorno
echo 1) Entorno QA (Tag: dev)
echo 2) Entorno Produccion (Tag: vXX)
set /p ENV_CHOICE="Selecciona el entorno (1 o 2): "

if "%ENV_CHOICE%"=="1" (
    set TAG=dev
    set API_URL=https://api-qa.miinventariofacil.com
    echo [INFO] Configurado para QA.
) else (
    set /p TAG="Introduce la version (ej: v56): "
    set API_URL=https://api.miinventariofacil.com
    echo [INFO] Configurado para PRODUCCION con version !TAG!.
)

:: 2. Seleccionar Componente
echo.
echo Que deseas compilar y subir?
echo 1) TODO (Backend, Frontend, Landing)
echo 2) Solo BACKEND
echo 3) Solo FRONTEND (App)
echo 4) Solo LANDING
set /p COMP_CHOICE="Selecciona una opcion (1-4): "

:: --- PROCESO DE BUILD ---

if "%COMP_CHOICE%"=="1" ( set DO_BACK=1& set DO_FRONT=1& set DO_LAND=1 )
if "%COMP_CHOICE%"=="2" ( set DO_BACK=1 )
if "%COMP_CHOICE%"=="3" ( set DO_FRONT=1 )
if "%COMP_CHOICE%"=="4" ( set DO_LAND=1 )

if defined DO_BACK (
    echo.
    echo 🏗️  Construyendo Backend...
    docker build -f ./ferreteria_refactor/backend_api/Dockerfile -t %USER%/ferreteria-backend:%TAG% .
)

if defined DO_FRONT (
    echo.
    echo 🏗️  Construyendo Frontend... https://mixedanalytics.com/knowledge-base/api-urls-explained/
    docker build --no-cache --build-arg VITE_API_URL=%API_URL% -f ./ferreteria_refactor/frontend_web/Dockerfile.prod -t %USER%/ferreteria-app:%TAG% ./ferreteria_refactor/frontend_web
)

if defined DO_LAND (
    echo.
    echo 🏗️  Construyendo Landing...
    docker build -t %USER%/ferreteria-landing:%TAG% ./landing_page
)

:: --- PROCESO DE PUSH ---
echo.
echo ☁️  Subiendo imagenes a Docker Hub...
if defined DO_BACK docker push %USER%/ferreteria-backend:%TAG%
if defined DO_FRONT docker push %USER%/ferreteria-app:%TAG%
if defined DO_LAND docker push %USER%/ferreteria-landing:%TAG%

echo.
echo ================================================
echo 🏆 ¡PROCESO FINALIZADO PARA %TAG%!
echo ================================================
pause