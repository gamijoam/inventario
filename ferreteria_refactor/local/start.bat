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
    echo Asegurese de que la carpeta postgresql\ existe.
    pause
    exit /b 1
)

:: Verificar si PostgreSQL ya esta corriendo
postgresql\bin\pg_isready.exe -h localhost -p 5432 >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [INFO] PostgreSQL ya esta corriendo.
) else (
    echo [1/3] Iniciando PostgreSQL...

    :: Inicializar data directory si no existe
    if not exist "postgresql\data\PG_VERSION" (
        echo [INFO] Primera ejecucion - inicializando base de datos...
        postgresql\bin\initdb.exe -D postgresql\data -U postgres -E UTF8 --locale=C >nul 2>&1
        if %ERRORLEVEL% NEQ 0 (
            echo [ERROR] Fallo al inicializar PostgreSQL.
            pause
            exit /b 1
        )
    )

    :: Iniciar PostgreSQL en background
    start /B postgresql\bin\pg_ctl.exe start -D postgresql\data -l postgresql\log.txt -w
    timeout /t 4 /nobreak >nul

    :: Verificar que inicio correctamente
    postgresql\bin\pg_isready.exe -h localhost -p 5432 >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] PostgreSQL no pudo iniciar. Revise postgresql\log.txt
        pause
        exit /b 1
    )
    echo   [OK] PostgreSQL iniciado.

    :: Crear base de datos si no existe
    postgresql\bin\psql.exe -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='miinventariofacil'" 2>nul | findstr "1" >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo   [INFO] Creando base de datos...
        postgresql\bin\createdb.exe -U postgres miinventariofacil
    )
)

:: Verificar si necesita setup (primer inicio)
echo [2/3] Verificando configuracion...
python\python.exe -c "import sys; sys.path.insert(0,'.'); from backend.config import settings; from backend.database.db import SessionLocal; from backend.models.tenant import Tenant; db=SessionLocal(); t=db.query(Tenant).first(); db.close(); exit(0 if t else 1)" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo   [INFO] Primera ejecucion - configurando empresa...
    set PYTHONPATH=%~dp0
    python\python.exe -m backend.setup_offline
    if %ERRORLEVEL% NEQ 0 (
        echo   [ERROR] Fallo la configuracion inicial.
        pause
        exit /b 1
    )
)

:: Iniciar FastAPI
echo [3/3] Iniciando servidor web...
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

:: Abrir navegador despues de 3 segundos
start "" /B cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:8000"

:: Iniciar uvicorn (bloquea esta ventana — muestra logs)
set PYTHONPATH=%~dp0
python\python.exe -m uvicorn backend.main:app --host 0.0.0.0 --port 8000

:: Si uvicorn se cierra, detener PostgreSQL
echo.
echo [INFO] Servidor detenido. Cerrando PostgreSQL...
postgresql\bin\pg_ctl.exe stop -D postgresql\data -m fast >nul 2>&1
echo [OK] Todo detenido.
pause
