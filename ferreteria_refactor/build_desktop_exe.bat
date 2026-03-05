@echo off
title Invensoft Desktop - Build Completo
color 0B
chcp 65001 > nul

echo.
echo  ================================================
echo    Invensoft Desktop - Build de Produccion
echo  ================================================
echo.
echo  Este script:
echo    1. Compila el backend Python a .exe (PyInstaller)
echo    2. Copia el .exe a src-tauri/binaries/
echo    3. Hace npm run tauri:build (instalador NSIS)
echo.

cd /d "C:\Users\gamijoam\Documents\inventario\ferreteria_refactor"

:: ── Paso 1: Verificar PyInstaller ─────────────────────────────────────────
python -m PyInstaller --version > nul 2>&1
if errorlevel 1 (
    echo  [INFO] Instalando PyInstaller...
    pip install pyinstaller
)

:: ── Paso 2: Compilar backend ──────────────────────────────────────────────
echo  [1/4] Compilando backend Python a .exe...
set PYTHONUTF8=1
python -m PyInstaller desktop_backend\invensoft_backend.spec --clean --noconfirm

if errorlevel 1 (
    echo.
    echo  [ERROR] La compilacion del backend fallo.
    pause
    exit /b 1
)
echo  [OK] Backend compilado.

:: ── Paso 3: Copiar .exe a Tauri binaries ──────────────────────────────────
echo  [2/4] Copiando .exe a Tauri binaries...
set BINARIES_DIR=frontend_web\src-tauri\binaries
set TARGET_NAME=invensoft-backend-x86_64-pc-windows-msvc.exe
if not exist "%BINARIES_DIR%" mkdir "%BINARIES_DIR%"
copy /y "dist\invensoft-backend.exe" "%BINARIES_DIR%\%TARGET_NAME%"
if errorlevel 1 (
    echo  [ERROR] No se pudo copiar el .exe
    pause
    exit /b 1
)
echo  [OK] .exe copiado a %BINARIES_DIR%\%TARGET_NAME%

:: ── Paso 4: Activar externalBin en tauri.conf.json ─────────────────────────
echo  [3/4] Activando externalBin en tauri.conf.json...
set TAURI_CONF=frontend_web\src-tauri\tauri.conf.json

:: Guardar backup
copy /y "%TAURI_CONF%" "%TAURI_CONF%.bak" > nul

:: Reemplazar "externalBin": [] con el binario
powershell -Command ^
  "(Get-Content '%TAURI_CONF%') -replace '\"externalBin\": \[\]', '\"externalBin\": [\"binaries/invensoft-backend\"]' | Set-Content '%TAURI_CONF%'"

echo  [OK] tauri.conf.json actualizado.

:: ── Paso 5: Build Tauri ────────────────────────────────────────────────────
echo  [4/4] Ejecutando npm run tauri:build...
cd frontend_web
call npm run tauri:build
set BUILD_RESULT=%errorlevel%
cd ..

:: ── Restaurar tauri.conf.json ──────────────────────────────────────────────
echo  Restaurando tauri.conf.json...
copy /y "%TAURI_CONF%.bak" "%TAURI_CONF%" > nul
del "%TAURI_CONF%.bak" > nul

if %BUILD_RESULT% neq 0 (
    echo.
    echo  [ERROR] tauri:build fallo. tauri.conf.json restaurado.
    pause
    exit /b 1
)

:: ── Resultado ─────────────────────────────────────────────────────────────
echo.
echo  ================================================
echo   BUILD EXITOSO
echo.
echo   Instalador: frontend_web\src-tauri\target\release\bundle\nsis\
echo   Busca el archivo Invensoft_1.0.0_x64-setup.exe
echo  ================================================
echo.
pause
