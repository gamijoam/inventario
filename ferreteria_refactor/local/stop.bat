@echo off
title Mi Inventario Facil - Deteniendo
color 0C

echo ============================================================
echo   Mi Inventario Facil - Deteniendo servicios...
echo ============================================================

cd /d "%~dp0"

:: Detener uvicorn (buscar proceso python con uvicorn)
echo [1/2] Deteniendo servidor web...
taskkill /f /im python.exe /fi "WINDOWTITLE eq Mi Inventario*" >nul 2>&1
:: Fallback: matar cualquier uvicorn en puerto 8000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)
echo [OK] Servidor web detenido.

:: Detener PostgreSQL
echo [2/2] Deteniendo PostgreSQL...
if exist "postgresql\bin\pg_ctl.exe" (
    postgresql\bin\pg_ctl.exe stop -D postgresql\data -m fast >nul 2>&1
)
echo [OK] PostgreSQL detenido.

echo.
echo Todos los servicios han sido detenidos.
timeout /t 3
