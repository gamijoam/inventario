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
        echo [INFO] Inicializando base de datos por primera vez...
        postgresql\bin\initdb.exe -D postgresql\data -U postgres -E UTF8 --locale=C >nul 2>&1
        if %ERRORLEVEL% NEQ 0 (
            echo [ERROR] Fallo al inicializar PostgreSQL.
            pause
            exit /b 1
        )
    )

    :: Iniciar PostgreSQL en background
    start /B postgresql\bin\pg_ctl.exe start -D postgresql\data -l postgresql\log.txt -w
    timeout /t 3 /nobreak >nul

    :: Verificar que inicio correctamente
    postgresql\bin\pg_isready.exe -h localhost -p 5432 >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] PostgreSQL no pudo iniciar. Revise postgresql\log.txt
        pause
        exit /b 1
    )
    echo [OK] PostgreSQL iniciado.

    :: Crear base de datos si no existe
    postgresql\bin\psql.exe -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='miinventariofacil'" | findstr "1" >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo [INFO] Creando base de datos miinventariofacil...
        postgresql\bin\createdb.exe -U postgres miinventariofacil
    )
)

:: Verificar si es primera ejecucion (setup necesario)
echo [2/3] Verificando configuracion...
python\python.exe -c "from backend_api.config import settings; from backend_api.database.db import SessionLocal; from backend_api.models.models import Tenant; db=SessionLocal(); t=db.query(Tenant).first(); db.close(); exit(0 if t else 1)" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] Primera ejecucion detectada. Ejecutando setup...
    cd backend
    ..\python\python.exe setup_offline.py
    cd ..
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Fallo el setup inicial.
        pause
        exit /b 1
    )
)

:: Iniciar FastAPI
echo [3/3] Iniciando servidor web...
echo.
echo ============================================================
echo   Servidor listo. Abriendo navegador...
echo   URL: http://localhost:8000
echo.
echo   Para detener: cierre esta ventana o presione Ctrl+C
echo ============================================================
echo.

:: Abrir navegador despues de 2 segundos
start "" /B cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:8000"

:: Iniciar uvicorn (bloquea esta ventana)
python\python.exe -m uvicorn backend_api.main:app --host 0.0.0.0 --port 8000

:: Si uvicorn se cierra, detener PostgreSQL
echo.
echo [INFO] Servidor detenido. Cerrando PostgreSQL...
postgresql\bin\pg_ctl.exe stop -D postgresql\data -m fast >nul 2>&1
echo [OK] Todo detenido.
pause
