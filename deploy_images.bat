@echo off
setlocal enabledelayedexpansion
set USER=gamijoam

echo ================================================
echo    SELECTOR DE DESPLIEGUE - SUPER ADMIN UPDATE
echo ================================================

:: 1. Seleccionar Entorno
echo.
echo Selecciona para donde va esta actualizacion:
echo 1) Entorno QA (Tag: dev)
echo 2) Entorno PRODUCCION (Tag: prod)
set /p ENV_CHOICE="Elige (1 o 2): "

if "%ENV_CHOICE%"=="1" (
    set TAG=dev
    set API_URL=https://api-qa.miinventariofacil.com
    echo.
    echo [INFO] Configurado para QA. La imagen sera: :dev
) else (
    set TAG=prod
    set API_URL=https://api.miinventariofacil.com
    echo.
    echo [INFO] Configurado para PRODUCCION. La imagen sera: :prod
    echo [NOTA] Esto sobrescribira la version 'prod' anterior en Docker Hub.
)

:: 2. Seleccionar Componente
echo.
echo Que deseas compilar y subir?
echo 1) TODO (Backend, Frontend, Landing, Admin Panel)
echo 2) Solo BACKEND
echo 3) Solo FRONTEND (App Clientes)
echo 4) Solo LANDING
echo 5) Solo ADMIN PANEL (Nuevo)
set /p COMP_CHOICE="Selecciona una opcion (1-5): "

:: --- CONFIGURACION DE BANDERAS ---
if "%COMP_CHOICE%"=="1" ( set DO_BACK=1& set DO_FRONT=1& set DO_LAND=1& set DO_ADMIN=1 )
if "%COMP_CHOICE%"=="2" ( set DO_BACK=1 )
if "%COMP_CHOICE%"=="3" ( set DO_FRONT=1 )
if "%COMP_CHOICE%"=="4" ( set DO_LAND=1 )
if "%COMP_CHOICE%"=="5" ( set DO_ADMIN=1 )

:: --- PROCESO DE BUILD ---

if defined DO_BACK (
    echo.
    echo 🏗️  Construyendo Backend [%TAG%]...
    docker build -f ./ferreteria_refactor/backend_api/Dockerfile -t %USER%/ferreteria-backend:%TAG% .
)

if defined DO_FRONT (
    echo.
    echo 🏗️  Construyendo Frontend App [%TAG%]...
    echo    - API URL inyectada: %API_URL%
    docker build --no-cache --build-arg VITE_API_URL=%API_URL% -f ./ferreteria_refactor/frontend_web/Dockerfile.prod -t %USER%/ferreteria-app:%TAG% ./ferreteria_refactor/frontend_web
)

if defined DO_LAND (
    echo.
    echo 🏗️  Construyendo Landing [%TAG%]...
    echo    - API URL inyectada: %API_URL%
    docker build --no-cache --build-arg VITE_API_URL=%API_URL% -t %USER%/ferreteria-landing:%TAG% ./landing_page
)

if defined DO_ADMIN (
    echo.
    echo 🏗️  Construyendo Admin Panel [%TAG%]...
    echo    - API URL inyectada: %API_URL%
    :: Asumimos que la carpeta admin_panel esta en ferreteria_refactor
    docker build --no-cache --build-arg VITE_API_URL=%API_URL% -f ./ferreteria_refactor/admin_panel/Dockerfile -t %USER%/ferreteria-admin-panel:%TAG% ./ferreteria_refactor/admin_panel
)

:: --- PROCESO DE PUSH ---
echo.
echo ☁️  Subiendo imagenes a Docker Hub...

if defined DO_BACK (
    echo Subiendo Backend...
    docker push %USER%/ferreteria-backend:%TAG%
)
if defined DO_FRONT (
    echo Subiendo Frontend App...
    docker push %USER%/ferreteria-app:%TAG%
)
if defined DO_LAND (
    echo Subiendo Landing...
    docker push %USER%/ferreteria-landing:%TAG%
)
if defined DO_ADMIN (
    echo Subiendo Admin Panel...
    docker push %USER%/ferreteria-admin-panel:%TAG%
)

echo.
echo ================================================
echo 🏆 DESPLIEGUE FINALIZADO
echo    Tag generado: %TAG%
echo.
echo    PASOS SIGUIENTES EN EL VPS:
echo    1. ./update.sh
echo    2. Seleccionar entorno
echo ================================================
pause