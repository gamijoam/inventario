@echo off
cd /d "%~dp0"

set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1

:: Detectar si fue lanzado desde InnoSetup (sin ventana / sin usuario interactivo)
:: Si se pasa el argumento /silent, no mostramos pauses
set SILENT=0
if "%1"=="/silent" set SILENT=1

echo.
echo  ============================================================
echo   Mi Inventario Facil - Configuracion Inicial
echo   Esto puede tardar unos minutos. No cierre esta ventana.
echo  ============================================================
echo.

:: PASO 1: Visual C++
echo  [1/5] Verificando Visual C++ Redistributable...
reg query "HKLM\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo         Instalando...
    if exist "redist\vc_redist.x64.exe" (
        redist\vc_redist.x64.exe /install /quiet /norestart
        echo         OK
    ) else (
        echo         [!] vc_redist.x64.exe no encontrado - continuando...
    )
) else (
    echo         OK
)

:: PASO 2: pip
echo  [2/5] Instalando pip...
python\python.exe -m pip --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    if exist "python\get-pip.py" (
        python\python.exe python\get-pip.py --no-warn-script-location >nul 2>&1
    )
)
echo         OK

:: PASO 3: Dependencias (usa wheels locales si existen, sino descarga)
echo  [3/5] Instalando dependencias...
if exist "wheels" (
    python\python.exe -m pip install --no-index --find-links=wheels --no-warn-script-location -r backend\requirements.txt >nul 2>&1
) else (
    python\python.exe -m pip install --no-warn-script-location -r backend\requirements.txt >nul 2>&1
)
if %ERRORLEVEL% NEQ 0 (
    echo         [ERROR] Fallo instalando dependencias.
    if %SILENT%==0 pause
    exit /b 1
)
echo         OK

:: PASO 4: PostgreSQL
echo  [4/5] Inicializando base de datos...

taskkill /f /im postgres.exe >nul 2>&1
timeout /t 2 /nobreak >nul

if not exist "postgresql\data\PG_VERSION" (
    postgresql\bin\initdb.exe -D postgresql\data -U postgres -E UTF8 --locale=C >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo         [ERROR] initdb fallo.
        if %SILENT%==0 pause
        exit /b 1
    )
)

postgresql\bin\pg_ctl.exe start -D postgresql\data -l postgresql\log.txt -w
timeout /t 3 /nobreak >nul

postgresql\bin\pg_isready.exe -h localhost -p 5432 -U postgres >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo         [ERROR] PostgreSQL no inicio. Revise postgresql\log.txt
    if %SILENT%==0 pause
    exit /b 1
)

postgresql\bin\psql.exe -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='miinventariofacil'" 2>nul | findstr "1" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    postgresql\bin\createdb.exe -U postgres miinventariofacil >nul 2>&1
)
echo         OK

:: PASO 5: Crear empresa por defecto
echo  [5/5] Configurando empresa por defecto...

if not exist "backend\media" mkdir backend\media

set PYTHONPATH=%~dp0
python\python.exe -m backend.setup_offline 2>nul
if %ERRORLEVEL% NEQ 0 (
    cd backend
    ..\python\python.exe setup_offline.py 2>nul
    cd ..
)

postgresql\bin\pg_ctl.exe stop -D postgresql\data -m fast >nul 2>&1

echo.
echo  ============================================================
echo   Setup completado!
echo.
echo   Para iniciar: doble click en MiInventarioFacil.exe
echo.
echo   Credenciales:
echo     Usuario: admin
echo     Clave:   admin123
echo  ============================================================
echo.

:: Solo pausar si el usuario abrió el bat manualmente (no desde el instalador)
if %SILENT%==0 pause
