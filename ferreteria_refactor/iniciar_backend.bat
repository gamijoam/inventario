@echo off
title Invensoft Desktop - Servidor Backend
color 0A
chcp 65001 > nul

echo.
echo  ==========================================
echo    Invensoft Desktop - Servidor Backend
echo  ==========================================
echo.
echo  Iniciando en http://127.0.0.1:8000 ...
echo  (Mantén esta ventana ABIERTA mientras usas la app)
echo.

cd /d "C:\Users\gamijoam\Documents\inventario\ferreteria_refactor"

:: Verificar que Python está disponible
python --version > nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Python no encontrado en PATH.
    echo  Instala Python 3.12 o activa el entorno virtual.
    echo.
    pause
    exit /b 1
)

set PYTHONUTF8=1

:: Arrancar el backend
python -m desktop_backend.run

echo.
echo  El servidor se ha detenido.
pause
