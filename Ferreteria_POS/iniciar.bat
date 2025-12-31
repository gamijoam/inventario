@echo off
title Ferretería POS - Servidor
color 0A
cls

echo ========================================
echo   FERRETERÍA POS
echo   Sistema de Punto de Venta
echo ========================================
echo.

REM Check if backend.exe exists
if not exist "backend.exe" (
    echo [ERROR] No se encontró backend.exe
    echo.
    pause
    exit /b 1
)

echo [1/3] Iniciando servidor backend...
start /B "" backend.exe

echo [2/3] Esperando que el servidor inicie...
timeout /t 4 /nobreak > nul

echo [3/3] Abriendo aplicación en navegador...
start http://localhost:8000

echo.
echo ========================================
echo   APLICACIÓN INICIADA
echo ========================================
echo.
echo La aplicación se abrió en tu navegador.
echo.
echo IMPORTANTE:
echo   - NO CIERRES ESTA VENTANA
echo   - Para cerrar la aplicación:
echo     1. Cierra la pestaña del navegador
echo     2. Presiona Ctrl+C aquí
echo.
echo ========================================
echo.

REM Keep window open
:wait
timeout /t 1 /nobreak > nul
goto wait
