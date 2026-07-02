@echo off
title Mi Inventario Facil - Actualizador
color 0B

echo ============================================================
echo   Mi Inventario Facil - Actualizacion Offline
echo ============================================================
echo.

cd /d "%~dp0"

if not exist "python\python.exe" (
    echo [ERROR] No se encontro python\python.exe.
    echo Ejecute esta actualizacion desde la carpeta instalada.
    pause
    exit /b 1
)

if not exist "updater\update_offline.py" (
    echo [ERROR] No se encontro updater\update_offline.py.
    echo El instalador base debe incluir el actualizador.
    pause
    exit /b 1
)

echo [1/2] Deteniendo servicios locales si estan activos...
if exist "stop.bat" call stop.bat >nul 2>&1

echo [2/2] Buscando e instalando actualizaciones...
python\python.exe updater\update_offline.py %*
set UPDATE_RESULT=%ERRORLEVEL%

echo.
if %UPDATE_RESULT% EQU 0 (
    echo [OK] Actualizacion completada.
    echo Puede iniciar el sistema con MiInventarioFacil.exe o start.bat.
) else (
    echo [ERROR] La actualizacion no se completo.
    echo Revise updater\logs\update.log para ver el detalle.
)

pause
exit /b %UPDATE_RESULT%
