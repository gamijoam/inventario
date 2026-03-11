# 05 - Guía de Operaciones, Despliegue e Infraestructura (SaaS)

Guía maestra para el despliegue, administración y orquestación de la infraestructura de **Mi Inventario Fácil** en el entorno de producción (VPS Linux) utilizando Docker.

## 1. Estructura de Directorios del VPS

El servidor almacena toda la configuración de orquestación en el directorio `/root/deploy/`. La arquitectura está separada en entornos aislados para garantizar la estabilidad:

```text
~/deploy/
├── backup_db.sh          # Script de respaldo automatizado de la BD
├── update.sh             # Script para automatizar actualizaciones de contenedores
├── core/                 # Infraestructura base
│   ├── acme.json         # Almacenamiento de certificados SSL (Let's Encrypt)
│   └── docker-compose.yml# Contenedor principal de Traefik
├── prod/                 # Entorno de Producción
│   ├── backups/          # Respaldos locales de PostgreSQL
│   ├── data/             # Volúmenes persistentes (postgres, media)
│   ├── docker-compose.yml# Orquestación de microservicios de producción
│   └── .env              # Variables de entorno y TAGs de versión
└── qa/                   # Entorno de Pruebas (Espejo de Producción)
```

## 2. Orquestación SaaS y Enrutamiento (Traefik)

Se utiliza **Docker Compose** para manejar los microservicios. **Traefik** actúa como Reverse Proxy y gestiona el enrutamiento Multi-Tenant dinámicamente sin necesidad de reiniciar servicios.

Traefik escucha en la red externa `web_publica` y enruta basándose en reglas estrictas:
*   **API** (`api.miinventariofacil.com`): Enruta al contenedor del backend.
*   **Admin Panel** (`admin.miinventariofacil.com`): Tiene prioridad alta (`priority=100`) para no chocar con clientes.
*   **App Clientes** (Regla Wildcard): Usa la expresión regular `HostRegexp("{subdomain:[a-z0-9-]+}.miinventariofacil.com")`. Atrapa cualquier subdominio (ej: `ferreteria-juan...`) y lo manda al Frontend. El Frontend lee la URL para saber qué tenant consultar.

## 3. Aislamiento de Base de Datos (Híbrido Avanzado)

El sistema utiliza **PostgreSQL 15** blindado en una red interna (`prod_internal` mapeado a `127.0.0.1:5432`). 

La arquitectura de datos utiliza un patrón **Híbrido de Schema-per-Tenant**:
*   **Esquema `public`**: Almacena datos globales. Aquí se guardan todos los Usuarios (`users`) para permitir un inicio de sesión centralizado, junto con la tabla maestra de tenants.
*   **Esquemas Privados**: Cada empresa creada genera dinámicamente su propio esquema en Postgres (ej. `empresa_1`, `empresa_2`), aislando completamente sus ventas, inventario y configuraciones.

## 4. Secuencia de Inicio (Boot) y Migraciones

El contenedor de FastAPI sigue un flujo estricto al arrancar:
1.  Verificación de conectividad a la base de datos Postgres.
2.  Migración del esquema `public` (Tablas globales y usuarios) vía Alembic.
4.  Ejecución del script `migrate_tenants.py`: Realiza una migración iterativa de todos los esquemas de clientes activos. Este proceso asegura que las actualizaciones de esquema realizadas en desarrollo se propaguen a todos los inquilinos automáticamente al iniciar el servidor en el VPS.
5.  Lanzamiento del servidor de aplicaciones (Uvicorn/Gunicorn) con workers optimizados.

## 5. Configuración Crítica (.env)

| Variable | Propósito |
| :--- | :--- |
| **TAG** | Controla la versión exacta de la imagen Docker a desplegar (ej. `prod-version-50`). |
| **APP_DOMAIN** | `miinventariofacil.com` (Base para enrutamiento multi-tenant). |
| **DATABASE_URL** | URL de conexión a Postgres (`postgresql://user:pass@db_prod:5432/db`). |
| **SECRET_KEY** | Firma de seguridad inalterable para los JWT. |
| **SECURE_COOKIES** | Habilitado (`true`) solo para entornos con HTTPS activo. |

## 6. Procedimiento de Actualización — `deploy_images.sh`

El despliegue se realiza con el script `deploy_images.sh` desde la máquina local:

```bash
./deploy_images.sh          # Build + push Docker images + VPS pull + restart
```

**Flujo del script:**
1. **pytest pre-flight gate** (opcional): ejecuta los tests. Si fallan, el deploy se detiene.
2. Build local de las imágenes Docker (backend, frontend, admin panel).
3. Push a Docker Hub con el tag configurado.
4. SSH al VPS → pull de nuevas imágenes → `docker-compose up -d`.

**Rollback manual:** Acceder a `~/deploy/prod/`, cambiar `TAG` en `.env` a la versión anterior, ejecutar `docker-compose up -d`.

### Hardening Docker (aplicado en auditoría 2026-03-10)
| Aspecto | Configuración |
|---------|---------------|
| Non-root user | `appuser` en backend Dockerfile |
| Healthchecks | `python urllib` a `/api/v1/health` |
| Resource limits | backend 512m, frontend 128m, db 1g, traefik 256m |
| Versiones pinneadas | 30 paquetes Python (`==`) + 8 base images con version+distro |
| Timezone | `TZ=America/Caracas` en backend + DB |
| Frontend build | `npm ci` (no `npm install`) + `--max-old-space-size` para evitar OOM en Alpine |

## 7. Procedimientos de Emergencia y Backups

### A. Reset de Acceso Maestro
En caso de pérdida de credenciales, el restablecimiento se realiza directamente sobre la base de datos mediante SSH al VPS:

1. Conectarse al VPS por SSH y acceder al contenedor de PostgreSQL:
   ```bash
   docker exec -it postgres psql -U postgres
   ```
2. Ejecutar el UPDATE con el hash de la nueva contraseña:
   ```sql
   UPDATE public.users SET password_hash = '$2b$12$NUEVO_HASH' WHERE email = 'admin@ejemplo.com';
   ```
3. Para generar el hash bcrypt de la nueva contraseña, usar Python antes de conectarse a psql:
   ```bash
   python -c "from passlib.context import CryptContext; ctx=CryptContext(schemes=['bcrypt']); print(ctx.hash('nueva_password'))"
   ```
   Copiar el resultado y sustituirlo en el campo `$2b$12$NUEVO_HASH` del paso anterior.

### B. Fallos de Migración — Revisión Huérfana en Alembic

**Síntoma:** `FAILED: Can't locate revision identified by 'XXXXXXX'` — el backend crashea porque la tabla `alembic_version` referencia una revisión que ya no existe en el código.

**Procedimiento de recuperación (probado en QA, 2026-03-10):**

```bash
# 1. Verificar revisión actual en la BD
docker exec db_prod_server psql -U postgres -d invensoft_prod \
  -c "SELECT * FROM alembic_version;"

# 2. Si la revisión no existe en alembic/versions/, forzar el stamp
docker exec db_prod_server psql -U postgres -d invensoft_prod \
  -c "UPDATE alembic_version SET version_num = '<revision_válida>';"

# 3. Correr upgrade normal
docker exec backend_prod_server alembic -c /app/ferreteria_refactor/alembic.ini upgrade head

# 4. Verificar que las columnas se crearon
docker exec db_prod_server psql -U postgres -d invensoft_prod \
  -c "SELECT column_name FROM information_schema.columns WHERE table_name='desktop_licenses' AND table_schema='public';"
```

**Prevención:** NUNCA eliminar archivos de migración que ya hayan sido aplicados en algún entorno. Siempre verificar `alembic current` en el VPS antes de desplegar código con migraciones nuevas.

Si un cliente nuevo no puede acceder, verificar los logs de `migrate_tenants.py`. Es posible que el esquema del inquilino no se haya creado correctamente o falte la ejecución de un `alembic upgrade` en su esquema particular.

### C. Respaldo de Base de Datos
Para generar un volcado de seguridad de todos los esquemas:
```bash
docker exec -t db_prod_server pg_dumpall -U postgres > backup_full_$(date +%F).sql
```
*(Nota: El sistema ya cuenta con un script `backup_db.sh` para automatizar esto).*

### D. Respaldo de Archivos Multimedia (Volúmenes)
Es vital respaldar el volumen `./data/media` (mapeado a `/app/media` en el contenedor) que contiene las fotos de productos, recibos de abonos y logos de los clientes de Ferreterías, Restaurantes y Talleres de Celulares.