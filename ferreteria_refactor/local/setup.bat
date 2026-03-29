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

:: PASO 3: Dependencias
:: IMPORTANTE: --target apunta al site-packages del Python embebido
:: Sin esto, pip instala en el Python del sistema (AppData\Roaming) y el embebido no los ve
echo  [3/5] Instalando dependencias (requiere internet la primera vez)...

set SITE_PKG=python\Lib\site-packages
if not exist "%SITE_PKG%" mkdir "%SITE_PKG%"

:: Intentar con wheels locales primero
set PIP_OK=0
if exist "wheels" (
    python\python.exe -m pip install --target="%SITE_PKG%" --no-index --find-links=wheels --no-warn-script-location -r backend\requirements.txt >nul 2>&1
    if %ERRORLEVEL% EQU 0 set PIP_OK=1
)

:: Si los wheels locales fallan, descargar de internet
if %PIP_OK%==0 (
    echo         Descargando dependencias de internet...
    python\python.exe -m pip install --target="%SITE_PKG%" --no-warn-script-location -r backend\requirements.txt
    if %ERRORLEVEL% NEQ 0 (
        echo         [ERROR] Fallo instalando dependencias.
        echo         Verifique su conexion a internet e intente de nuevo.
        if %SILENT%==0 pause
        exit /b 1
    )
)
echo         OK

:: PASO 4: PostgreSQL
echo  [4/5] Inicializando base de datos...

taskkill /f /im postgres.exe >nul 2>&1
timeout /t 2 /nobreak >nul

:: Limpiar data incompleto si existe pero sin PG_VERSION
if exist "postgresql\data" (
    if not exist "postgresql\data\PG_VERSION" (
        echo         Limpiando directorio data incompleto...
        rmdir /s /q "postgresql\data"
    )
)

if not exist "postgresql\data\PG_VERSION" (
    echo         Ejecutando initdb...
    postgresql\bin\initdb.exe -D postgresql\data -U postgres -E UTF8 --locale=C
    if %ERRORLEVEL% NEQ 0 (
        echo         [ERROR] initdb fallo. Ver salida arriba.
        if %SILENT%==0 pause
        exit /b 1
    )
)

postgresql\bin\pg_ctl.exe start -D postgresql\data -l postgresql\log.txt -w
timeout /t 3 /nobreak >nul

postgresql\bin\pg_isready.exe -h localhost -p 5432 -U postgres
if %ERRORLEVEL% NEQ 0 (
    echo         [ERROR] PostgreSQL no inicio.
    if exist "postgresql\log.txt" (
        echo         Contenido de log.txt:
        type postgresql\log.txt
    )
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
