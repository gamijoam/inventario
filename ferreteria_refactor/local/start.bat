@echo off
title Mi Inventario Facil - Servidor Local
color 0A

echo ============================================================
echo   Mi Inventario Facil - Iniciando servidor local...
echo ============================================================
echo.

cd /d "%~dp0"

:: Verificar que PostgreSQL existe
if not exist "postgresql\bin\pg_ctl.exe" (
    echo [ERROR] No se encontro PostgreSQL portable.
    pause
    exit /b 1
)

:: Verificar que setup se ejecuto
if not exist "postgresql\data\PG_VERSION" (
    echo [ERROR] La base de datos no ha sido inicializada.
    echo Ejecute setup.bat primero.
    pause
    exit /b 1
)

:: Iniciar PostgreSQL
echo [1/2] Iniciando PostgreSQL...
postgresql\bin\pg_isready.exe -h localhost -p 5432 -U postgres >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo   Ya esta corriendo.
) else (
    :: Iniciar SIN start /B — pg_ctl -w espera a que este listo antes de continuar
    postgresql\bin\pg_ctl.exe start -D postgresql\data -l postgresql\log.txt -w
    if %ERRORLEVEL% NEQ 0 (
        echo   [ERROR] PostgreSQL no pudo iniciar. Revise postgresql\log.txt
        pause
        exit /b 1
    )
    echo   OK
)

:: Iniciar FastAPI
echo [2/2] Iniciando servidor web...
echo.
echo ============================================================
echo.
echo   Mi Inventario Facil esta listo!
echo.
echo   URL: http://localhost:8000
echo.
echo   Usuario: admin
echo   Clave:   admin123
echo.
echo   Para acceder desde tablet/celular en la misma red:
echo   http://[IP-de-esta-PC]:8000
echo.
echo   Para detener: cierre esta ventana o presione Ctrl+C
echo.
echo ============================================================
echo.

:: Abrir navegador
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:8000"

:: Iniciar uvicorn (bloquea esta ventana)
set PYTHONPATH=%~dp0
python\python.exe -m uvicorn backend.main:app --host 0.0.0.0 --port 8000

:: Al cerrar uvicorn, detener PostgreSQL
echo.
echo [INFO] Servidor detenido. Cerrando PostgreSQL...
postgresql\bin\pg_ctl.exe stop -D postgresql\data -m fast >nul 2>&1
echo [OK] Todo detenido.
pause
