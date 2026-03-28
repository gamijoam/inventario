@echo off
title Mi Inventario Facil - Setup Inicial
color 0A
cd /d "%~dp0"

set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1

echo.
echo  ============================================================
echo   Mi Inventario Facil - Configuracion Inicial
echo   Esto puede tardar unos minutos. No cierre esta ventana.
echo  ============================================================
echo.

:: PASO 1: Visual C++
echo  [1/6] Verificando Visual C++ Redistributable...
reg query "HKLM\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo         Instalando...
    if exist "redist\vc_redist.x64.exe" (
        redist\vc_redist.x64.exe /install /quiet /norestart
        echo         OK
    ) else (
        echo         [!] vc_redist.x64.exe no encontrado
        pause
        exit /b 1
    )
) else (
    echo         OK
)

:: PASO 2: Python completo
echo  [2/6] Verificando Python...
python\python.exe -c "import tkinter" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo         Instalando Python completo...
    if exist "redist\python-3.12.9-amd64.exe" (
        if exist "python\python312._pth" (
            rmdir /S /Q python >nul 2>&1
            mkdir python >nul 2>&1
        )
        redist\python-3.12.9-amd64.exe /quiet TargetDir="%~dp0python" Include_launcher=0 Include_test=0 AssociateFiles=0 Shortcuts=0 Include_doc=0 InstallAllUsers=0
        timeout /t 15 /nobreak >nul
        python\python.exe -c "import tkinter" >nul 2>&1
        if %ERRORLEVEL% NEQ 0 (
            echo         [!] tkinter no disponible. Launcher usara consola.
        ) else (
            echo         OK
        )
    ) else (
        echo         [!] Instalador de Python no encontrado. Usando version basica.
    )
) else (
    echo         OK
)

:: PASO 3: pip
echo  [3/6] Instalando pip...
python\python.exe -m pip --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    if exist "python\get-pip.py" (
        python\python.exe python\get-pip.py --no-warn-script-location >nul 2>&1
    )
)
echo         OK

:: PASO 4: Dependencias
echo  [4/6] Instalando dependencias (puede tardar unos minutos)...
python\python.exe -m pip install --no-warn-script-location -r backend\requirements.txt >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo         [ERROR] Fallo instalando dependencias.
    echo         Ejecute: python\python.exe -m pip install -r backend\requirements.txt
    pause
    exit /b 1
)
echo         OK

:: PASO 5: PostgreSQL
echo  [5/6] Inicializando base de datos...

taskkill /f /im postgres.exe >nul 2>&1
timeout /t 2 /nobreak >nul

if not exist "postgresql\data\PG_VERSION" (
    postgresql\bin\initdb.exe -D postgresql\data -U postgres -E UTF8 --locale=C >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo         [ERROR] initdb fallo.
        pause
        exit /b 1
    )
)

postgresql\bin\pg_ctl.exe start -D postgresql\data -l postgresql\log.txt -w
timeout /t 2 /nobreak >nul

postgresql\bin\pg_isready.exe -h localhost -p 5432 -U postgres >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo         [ERROR] PostgreSQL no inicio. Revise postgresql\log.txt
    pause
    exit /b 1
)

postgresql\bin\psql.exe -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='miinventariofacil'" 2>nul | findstr "1" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    postgresql\bin\createdb.exe -U postgres miinventariofacil >nul 2>&1
)
echo         OK

:: PASO 6: Crear empresa
echo  [6/6] Configurando empresa por defecto...

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
echo   O ejecute start.bat
echo.
echo   Credenciales:
echo     Usuario: admin
echo     Clave:   admin123
echo  ============================================================
echo.
pause
