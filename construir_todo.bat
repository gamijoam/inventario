@echo off
setlocal
echo ========================================================
echo   CONSTRUCTOR AUTOMATICO - FERRETERIA POS
echo ========================================================
echo.

set "PROJECT_ROOT=%~dp0"
set "FRONTEND_DIR=%PROJECT_ROOT%ferreteria_refactor\frontend_web"
set "POS_DIST=%PROJECT_ROOT%Ferreteria_POS"

echo [1/4] COMPILANDO FRONTEND (React)...
cd /d "%FRONTEND_DIR%"
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Fallo al compilar Frontend.
    pause
    exit /b %ERRORLEVEL%
)
echo [OK] Frontend compilado.
echo.

echo [2/4] ACTUALIZANDO FRONTEND EN DISTRIBUCION...
cd /d "%PROJECT_ROOT%"
if exist "%POS_DIST%\frontend" (
    rmdir /s /q "%POS_DIST%\frontend"
)
mkdir "%POS_DIST%\frontend"
xcopy /E /I /Y "%FRONTEND_DIR%\dist" "%POS_DIST%\frontend"
echo [OK] Frontend actualizado.
echo.

echo [3/4] COMPILANDO BACKEND (Python)...
cd /d "%PROJECT_ROOT%"
call .\venv\Scripts\activate.bat
echo Entorno virtual activado.
pyinstaller backend.spec --clean --noconfirm
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Fallo al compilar Backend.
    pause
    exit /b %ERRORLEVEL%
)
echo [OK] Backend compilado.
echo.

echo [4/4] ACTUALIZANDO BACKEND EN DISTRIBUCION...
copy /Y "dist\ferreteria_backend.exe" "%POS_DIST%\backend.exe"
echo [OK] Backend actualizado.
echo.

echo ========================================================
echo   PROCESO COMPLETADO EXITOSAMENTE
echo ========================================================
echo La nueva version esta lista en: %POS_DIST%
echo.
pause
