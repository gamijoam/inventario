# 25 - Modo Offline / Instalador Windows

Documentación completa del sistema de despliegue offline para Windows de **Mi Inventario Fácil**.
El mismo código base que corre en el SaaS (Docker + VPS) se empaqueta en un instalador `.exe`
que funciona completamente sin internet, sin Docker y sin configuración técnica del usuario.

---

## 1. Arquitectura General

```
MiInventarioFacil-Setup.exe   ← InnoSetup: un solo instalador (~178MB)
└── instala en: C:\Users\<user>\AppData\Local\Mi Inventario Facil\
    ├── MiInventarioFacil.exe    ← Launcher C# WinForms (inicia todo)
    ├── backend\                 ← FastAPI (código Python)
    │   ├── main.py
    │   ├── .env                 ← Variables de entorno generadas en build
    │   └── ...
    ├── frontend\                ← React SPA (build estático de Vite)
    │   └── index.html, assets\...
    ├── python\                  ← Python 3.12.9 embebido (portable)
    │   ├── python.exe
    │   └── Lib\site-packages\   ← 72 paquetes pre-instalados (wheels Windows)
    ├── postgresql\              ← PostgreSQL 16.8 portable
    │   ├── bin\pg_ctl.exe, initdb.exe, psql.exe...
    │   ├── lib\, share\
    │   └── data\                ← Creado por setup.bat (no en el installer)
    ├── redist\
    │   └── vc_redist.x64.exe    ← Visual C++ Redistributable
    ├── setup.bat                ← Inicialización BD (solo primera vez)
    ├── start.bat                ← Arranque manual por consola (debug)
    ├── stop.bat                 ← Parar todos los servicios
    └── D3DCompiler_47_cor3.dll  ← DLLs nativas del runtime .NET WinForms
        PenImc_cor3.dll
        PresentationNative_cor3.dll
        vcruntime140_cor3.dll
        wpfgfx_cor3.dll
```

### Diferencia con SaaS

| Variable | SaaS (Docker/VPS) | Offline (Windows) |
|----------|-------------------|-------------------|
| `SINGLE_TENANT` | `false` | `true` |
| `SINGLE_TENANT_SCHEMA` | N/A | `default` |
| `DATABASE_URL` | `postgres://...@db:5432/...` | `postgresql://postgres:@localhost:5432/miinventariofacil` |
| `SMTP_HOST` | Configurado (Namecheap) | Vacío (emails se saltean) |
| `ENVIRONMENT` | `production` | `production` |
| Puerto | 80/443 via Traefik | 8000 directo |

Con `SINGLE_TENANT=true` el middleware usa schema fijo (`default`) sin detectar subdominio ni
requerir el header `X-Tenant-ID`.

---

## 2. Proceso de Build (Linux → Windows)

El build se realiza desde Linux y genera el instalador para Windows. Requiere:
- `bash`, `wget`, `unzip`, `rsync`, `pip`, `npm`
- `dotnet` SDK >= 8.0 (`~/.dotnet/dotnet`)
- `wine` + InnoSetup 6 instalado en Wine (`~/.wine/...`)

### Ejecutar el build completo

```bash
cd ferreteria_refactor/local
bash build_package.sh
```

El script hace en orden:

1. **PostgreSQL portable** — descarga `postgresql-16.8-1-windows-x64-binaries.zip` (~200MB)
   de EnterpriseDB, extrae solo `bin/`, `lib/`, `share/`. Se cachea en `local/cache/`.

2. **Python embebido** — descarga `python-3.12.9-embed-amd64.zip` (~12MB) de python.org.
   Modifica `python312._pth` para habilitar `import site` y agregar `Lib\site-packages`
   (sin esto el Python embebido no encuentra los paquetes instalados).

3. **Visual C++ Redistributable** — descarga `vc_redist.x64.exe` de Microsoft (~25MB).
   Requerido por PostgreSQL en Windows. Se instala silenciosamente durante el setup.

4. **Backend** — copia `backend_api/` al dist usando `rsync` (excluye `venv/`, `__pycache__`,
   `.env`, `media/`, `backups/`, `tests/`).

5. **Dependencias Python** — descarga wheels para `win_amd64 / cp312` desde Linux:
   ```bash
   pip download \
       --platform win_amd64 \
       --python-version 312 \
       --implementation cp \
       --abi cp312 \
       --only-binary=:all: \
       --dest cache/wheels_win \
       -r cache/requirements.windows.txt
   ```
   Nota: `requirements.windows.txt` es igual al `requirements.txt` original pero con
   `uvicorn[standard]` → `uvicorn` (uvloop es Linux-only, no existe para win_amd64).

   Cada `.whl` se extrae directamente en `python/Lib/site-packages/` con `unzip`.
   **No se usa pip en Windows** — todo queda pre-instalado.

   Paquetes críticos incluidos: `uvicorn`, `fastapi`, `sqlalchemy`, `alembic`,
   `pydantic`, `pydantic-settings`, `psycopg2-binary`, `apscheduler`, `tzdata`,
   `aiofiles`, `python-jose`, `passlib`, `pillow`, y ~65 dependencias transitivas.

6. **Frontend** — `VITE_API_URL=http://localhost:8000 npx vite build --mode production`
   en `frontend_web/`. El resultado (`dist/`) se copia a `dist/MiInventarioFacil/frontend/`.

7. **Launcher C# compilado** — copia `launcher/publish/MiInventarioFacil.exe` y sus DLLs
   nativas al directorio raíz del paquete.

8. **`.env` offline** — generado con `SECRET_KEY` aleatoria (openssl rand -hex 32):
   ```
   DATABASE_URL=postgresql://postgres:@localhost:5432/miinventariofacil
   SECRET_KEY=<hex aleatorio>
   SINGLE_TENANT=true
   SINGLE_TENANT_SCHEMA=default
   ENVIRONMENT=production
   ...
   ```

### Compilar el launcher C# (antes de build_package.sh)

```bash
cd ferreteria_refactor/local/launcher
~/.dotnet/dotnet publish -c Release -r win-x64 \
    --self-contained true \
    /p:PublishSingleFile=true \
    -o publish
```

Genera `publish/MiInventarioFacil.exe` (~147MB self-contained) + DLLs nativas WinForms.

### Generar el instalador .exe (InnoSetup via Wine)

```bash
cd ferreteria_refactor/local
WINEDEBUG=-all wine "/home/<user>/.wine/drive_c/Program Files (x86)/Inno Setup 6/ISCC.exe" innosetup.iss
```

Genera `local/output/MiInventarioFacil-Setup.exe` (~178MB).

---

## 3. Launcher C# (MiInventarioFacil.exe)

**Archivo:** `local/launcher/Program.cs`
**Proyecto:** `local/launcher/MiInventarioLauncher.csproj`

### Configuración del proyecto

```xml
<OutputType>WinExe</OutputType>          <!-- Sin consola negra -->
<TargetFramework>net8.0-windows</TargetFramework>
<UseWindowsForms>true</UseWindowsForms>
<EnableWindowsTargeting>true</EnableWindowsTargeting>  <!-- Cross-compile desde Linux -->
<SelfContained>true</SelfContained>
<RuntimeIdentifier>win-x64</RuntimeIdentifier>
<PublishSingleFile>true</PublishSingleFile>
```

### Qué hace el launcher

1. **Valida** que existan `postgresql\bin\pg_ctl.exe` y `python\python.exe`.
2. **Detecta primera vez**: si no existe `postgresql\data\PG_VERSION`, ofrece ejecutar
   `setup.bat` via diálogo.
3. **Inicia PostgreSQL** con `pg_ctl.exe start -D postgresql\data -l postgresql\log.txt`.
   Espera hasta 20 segundos verificando con `pg_isready`.
4. **Carga el `.env`** (`LoadOrCreateEnv()`): lee `backend\.env` línea por línea y
   **inyecta cada variable directamente en el entorno del proceso Python** via
   `ProcessStartInfo.EnvironmentVariables`. Si el `.env` no existe o le faltan variables
   críticas, lo genera con valores por defecto y una SECRET_KEY aleatoria.
5. **Lanza uvicorn**:
   ```
   python\python.exe -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
   ```
   Con `PYTHONPATH=<BaseDir>`, `PYTHONIOENCODING=utf-8`, `PYTHONUTF8=1`, y todas
   las vars del `.env`. Output capturado en `%TEMP%\MiInventarioFacil_server.log`.
6. **Espera** hasta 50 segundos a que `http://localhost:8000` responda HTTP 200.
7. **Abre el navegador** automáticamente.
8. **Bandeja del sistema (tray)**: minimiza la ventana al tray al terminar de cargar.
   Doble click en el icono la restaura.
9. **Al detener**: mata uvicorn + para PostgreSQL (`pg_ctl stop -m fast`).

### Por qué inyectar vars en vez de depender del .env

`pydantic-settings` busca el `.env` en el **directorio de trabajo actual** (cwd).
El launcher corre uvicorn con `WorkingDirectory = BaseDir` (raíz de la app), pero
el `.env` está en `backend\.env`. En lugar de mover el archivo o cambiar el cwd,
el launcher lee el `.env` e inyecta cada variable en el entorno del proceso hijo.
`pydantic-settings` las lee del entorno (prioridad más alta que el archivo `.env`).

### Logs

- **Setup:** `%TEMP%\MiInventarioFacil_setup.log`
- **Servidor:** `%TEMP%\MiInventarioFacil_server.log`
- **PostgreSQL:** `<instalación>\postgresql\log.txt`

Si el servidor no arranca, el launcher muestra el `server.log` en una ventana con
scroll y botón "Copiar log".

---

## 4. Setup Inicial (setup.bat)

**Archivo:** `local/setup.bat`

Se ejecuta automáticamente durante la instalación (InnoSetup lo llama con `/silent`).
También puede ejecutarse manualmente por el usuario (sin `/silent` pausa al final).

### Pasos

1. **Visual C++ Redistributable** — verifica registro `HKLM\...\VisualStudio\14.0\VC\Runtimes\x64`.
   Si no está, instala `redist\vc_redist.x64.exe /install /quiet /norestart`.

2. **pip** — verifica `python\python.exe -m pip --version`. Si falla, instala desde
   `python\get-pip.py`. (Opcional — las deps ya están pre-instaladas.)

3. **Verificar uvicorn** — `python\python.exe -c "import uvicorn"`. Si falla, error fatal.

4. **initdb** — si `postgresql\data\PG_VERSION` no existe, crea la BD:
   ```bat
   postgresql\bin\initdb.exe -D postgresql\data -U postgres -E UTF8 --locale=C
   ```
   Si `postgresql\data` existe pero sin `PG_VERSION`, lo limpia antes de reintentar.

5. **Inicia PostgreSQL** temporalmente → crea la base `miinventariofacil` si no existe →
   ejecuta `backend\setup_offline.py` (inicializa schemas, tenant "default", usuario admin) →
   detiene PostgreSQL.

### Argumento /silent

```bat
if "%1"=="/silent" set SILENT=1
```

Cuando `SILENT=1`, no se ejecuta `pause`. Necesario para que InnoSetup no quede colgado
esperando que el usuario presione Enter en una ventana oculta.

---

## 5. Scripts de Operación

### start.bat — arranque por consola

```bat
:: Carga .env
for /f "usebackq eol=# tokens=1* delims==" %%A in ("backend\.env") do (
    if not "%%A"=="" set "%%A=%%B"
)
:: Inicia PG + uvicorn en primer plano (útil para debug — muestra todo el output)
python\python.exe -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

**Útil para debug**: muestra el output completo de uvicorn en la consola en tiempo real.
No requiere reinstalar — edita archivos directamente en la carpeta instalada y ejecuta.

### stop.bat

```bat
postgresql\bin\pg_ctl.exe stop -D postgresql\data -m fast
taskkill /f /im python.exe
```

---

## 6. InnoSetup (innosetup.iss)

**Instalación:**
- Directorio: `{localappdata}\Mi Inventario Facil` (AppData\Local, siempre con permisos de escritura)
- `PrivilegesRequired=lowest` — no requiere UAC por defecto
- Accesos directos en escritorio y menú inicio

**Secuencia de instalación:**
1. Copia todos los archivos de `dist\MiInventarioFacil\*` → `{app}`
2. Instala VC++ Redistributable si falta (check via registro)
3. Ejecuta `setup.bat /silent` → inicializa BD (puede tardar 1-2 min)
4. Opcionalmente lanza `MiInventarioFacil.exe` al terminar

**Desinstalación:**
- Ejecuta `stop.bat`
- Elimina `postgresql\data`, `postgresql\log.txt`, `backend\media`, `backend\backups`
- El resto lo elimina InnoSetup automáticamente

**Importante:** `{localappdata}` en vez de `{autopf}` (Program Files) porque PostgreSQL
necesita escribir en su directorio de datos durante `initdb` y operación normal.
Program Files es de solo lectura para usuarios sin UAC.

---

## 7. Python Embebido — Gotchas

### python312._pth

El Python embebido tiene un archivo `python312._pth` que controla el módulo de búsqueda.
Por defecto **no incluye `Lib\site-packages`** ni `import site`. El build_package.sh lo modifica:

```
python312.zip
.
Lib\site-packages    ← agregado
import site          ← descomentar (#import site → import site)
```

Sin esto, `import uvicorn` (y cualquier paquete en site-packages) falla con `ModuleNotFoundError`.

### uvicorn[standard] vs uvicorn

`uvicorn[standard]` requiere `uvloop` que solo existe para Linux. Al descargar wheels para
`win_amd64`, `pip download` falla si encuentra `uvloop` en las dependencias. La solución:
reemplazar `uvicorn[standard]` → `uvicorn` en `requirements.windows.txt`.

### tzdata

Windows no tiene la base de datos IANA de zonas horarias que usa el módulo `zoneinfo`
de Python. Sin `tzdata` instalado, cualquier uso de `zoneinfo.ZoneInfo("America/Caracas")`
falla con `ZoneInfoNotFoundError`. **`tzdata` debe estar en site-packages.**

### APScheduler timezone

```python
# scheduler.py — CORRECTO para Windows
scheduler = AsyncIOScheduler(timezone="UTC")

# INCORRECTO — falla en Windows sin tzdata + tzlocal correctamente configurado
scheduler = AsyncIOScheduler()  # fallback: get_localzone() → ZoneInfoNotFoundError
```

---

## 8. Datos Persistentes

| Datos | Ubicación |
|-------|-----------|
| Base de datos PostgreSQL | `<instalación>\postgresql\data\` |
| Archivos multimedia (imágenes) | `<instalación>\backend\media\` |
| Backups automáticos | `<instalación>\backend\backups\` |
| Log PostgreSQL | `<instalación>\postgresql\log.txt` |
| Log setup (primera vez) | `%TEMP%\MiInventarioFacil_setup.log` |
| Log servidor uvicorn | `%TEMP%\MiInventarioFacil_server.log` |

Al desinstalar, InnoSetup elimina `postgresql\data`, `media` y `backups`.
El usuario debe hacer backup manual antes de desinstalar si quiere conservar sus datos.

---

## 9. Credenciales por Defecto

| Campo | Valor |
|-------|-------|
| URL | http://localhost:8000 |
| Usuario | `admin` |
| Contraseña | `admin123` |
| PostgreSQL user | `postgres` (sin contraseña) |
| DB name | `miinventariofacil` |
| Schema | `default` |

---

## 10. Archivos en el Repo (qué se commitea)

```
ferreteria_refactor/local/
├── build_package.sh         ✅ commiteado
├── innosetup.iss            ✅ commiteado
├── setup.bat                ✅ commiteado
├── start.bat                ✅ commiteado
├── stop.bat                 ✅ commiteado
├── launcher/
│   ├── Program.cs           ✅ commiteado
│   ├── MiInventarioLauncher.csproj  ✅ commiteado
│   ├── bin/                 ❌ .gitignore (compilado)
│   ├── obj/                 ❌ .gitignore (compilado)
│   └── publish/             ❌ .gitignore (~155MB)
├── dist/                    ❌ .gitignore (~500MB)
├── cache/                   ❌ .gitignore (~250MB de descargas)
└── output/                  ❌ .gitignore (instalador generado)
```

---

## 11. Troubleshooting Común

| Síntoma | Causa | Solución |
|---------|-------|----------|
| `No module named X` | Wheel no descargado o `_pth` mal configurado | Verificar `python312._pth`, re-ejecutar build |
| `ZoneInfoNotFoundError` | `tzdata` no instalado | Incluir `tzdata` en wheels + `AsyncIOScheduler(timezone="UTC")` |
| `ValidationError: DATABASE_URL missing` | `.env` no cargado | Launcher inyecta vars via `LoadOrCreateEnv()` |
| `initdb Permission denied` | Instalado en `Program Files` | Usar `{localappdata}` en InnoSetup |
| `setup.bat` cuelga en InnoSetup | `pause` al final sin terminal interactiva | Usar argumento `/silent` |
| Log vacío en error | Redirección shell `> file 2>&1` con rutas con espacios | Usar `RedirectStandardOutput/Error` en C# |
| PostgreSQL no inicia | `data\` corrupto o incompleto | Eliminar `postgresql\data\` y re-ejecutar `setup.bat` |
| `El servidor no respondió en 50 seg` | Error en backend al importar | Ver `%TEMP%\MiInventarioFacil_server.log` |

---

## 12. Flujo Completo para el Desarrollador

```bash
# 1. Compilar launcher (solo si cambiaste Program.cs o .csproj)
cd ferreteria_refactor/local/launcher
~/.dotnet/dotnet publish -c Release -r win-x64 \
    --self-contained true /p:PublishSingleFile=true -o publish

# 2. Armar el paquete completo
cd ferreteria_refactor/local
bash build_package.sh

# 3. Generar el instalador
WINEDEBUG=-all wine \
    ~/.wine/drive_c/Program\ Files\ \(x86\)/Inno\ Setup\ 6/ISCC.exe \
    innosetup.iss

# 4. El instalador queda en:
#    ferreteria_refactor/local/output/MiInventarioFacil-Setup.exe
```

Para actualizaciones parciales (sin rebuild completo), puedes copiar archivos directamente
a la carpeta instalada (`%LocalAppData%\Mi Inventario Facil\`) y probar con `start.bat`.
