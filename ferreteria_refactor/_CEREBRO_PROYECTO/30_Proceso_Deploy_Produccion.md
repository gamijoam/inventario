# 30 — Proceso de Deploy a Producción (Guía Operativa para IAs)

> Este documento describe el procedimiento completo y probado para pasar cambios
> de QA a Producción. Seguir este orden exacto en cada futuro deploy.

**Última actualización:** 1 Abril 2026  
**Deploy de referencia:** `prod-taller-comisiones-20260401`  
**Entornos:** QA (`/root/deploy/qa/`) · Prod (`/root/deploy/prod/`)

---

## Prerequisitos antes de empezar

### 1. Verificar estado de QA
```bash
# Todo debe estar commiteado y sin errores
cd /root/deploy/qa/code && git status
git log --oneline -5

# Backend QA debe estar corriendo
service_logs("backend_qa_server", lines=10)
# Buscar: "Application startup complete." sin errores
```

### 2. Verificar credenciales Docker Hub
```bash
cat /root/.docker/config.json
# Si no existe: el operador humano debe hacer docker login -u gamijoam
# El MCP corre en un contenedor separado — el login del SSH del host NO persiste aquí
# Solución: pedir un Access Token al usuario y ejecutar:
echo "TOKEN" | docker login -u gamijoam --password-stdin
```

> ⚠️ IMPORTANTE: El MCP server corre en su propio contenedor Docker. Las credenciales
> guardadas en el host via SSH no son visibles desde el MCP. Siempre verificar con
> un test push antes de asumir que está autenticado.

### 3. Verificar que prod está corriendo
```bash
docker ps --filter "name=prod" --format "{{.Names}} | {{.Image}} | {{.Status}}"
# Deben aparecer: backend_prod_server, frontend_prod_server, 
#                 landing_prod_server, admin_panel_prod_server, db_prod_server
```

---

## Procedimiento completo — 8 pasos

### PASO 1 — Commitear todo lo pendiente en QA

```bash
cd /root/deploy/qa/code
git add -A
git commit -m "deploy: descripcion-de-los-cambios"
git log --oneline -3  # confirmar que está todo
```

### PASO 2 — Ejecutar migraciones de BD en PROD

**CRÍTICO: Hacer ANTES del build/deploy del código.**

Si los cambios incluyen nuevas tablas o columnas, ejecutar el SQL en los schemas de prod:

```python
# Obtener schemas activos
docker exec db_prod_server psql -U postgres -d invensoft_prod -t -c \
  "SELECT schema_name FROM public.tenants WHERE is_active=TRUE AND schema_name IS NOT NULL;"

# Para cada schema, ejecutar el SQL de migración:
# docker exec db_prod_server psql -U postgres -d invensoft_prod -c "SET search_path TO {schema}; ALTER TABLE..."
```

**Patrón de migración segura (idempotente):**
```sql
-- Columnas: siempre con IF NOT EXISTS
ALTER TABLE tabla ADD COLUMN IF NOT EXISTS columna TIPO DEFAULT valor;

-- Tablas: siempre con IF NOT EXISTS
CREATE TABLE IF NOT EXISTS nueva_tabla (...);

-- Datos iniciales: solo si no existen
INSERT INTO tabla (campo) SELECT valor WHERE NOT EXISTS (SELECT 1 FROM tabla);
```

### PASO 3 — Build de las 4 imágenes Docker

```bash
VERSION="prod-descripcion-$(date +%Y%m%d)"
echo $VERSION > /tmp/deploy_version.txt
cd /root/deploy/qa/code

# 1. Backend
docker build --network host \
    -f ferreteria_refactor/backend_api/Dockerfile \
    -t gamijoam/ferreteria-backend:$VERSION \
    . 2>&1 | tail -3

# 2. Frontend App (VITE_API_URL de PROD, no QA)
docker build --network host \
    --build-arg VITE_API_URL="https://api.miinventariofacil.com/api/v1" \
    -f ferreteria_refactor/frontend_web/Dockerfile.prod \
    -t gamijoam/ferreteria-app:$VERSION \
    ferreteria_refactor/frontend_web 2>&1 | tail -3

# 3. Landing Page
docker build --network host \
    --build-arg VITE_API_URL="https://api.miinventariofacil.com/api/v1" \
    -t gamijoam/ferreteria-landing:$VERSION \
    landing_page 2>&1 | tail -3

# 4. Admin Panel SaaS
docker build --network host \
    --build-arg VITE_API_URL="https://api.miinventariofacil.com/api/v1" \
    -f ferreteria_refactor/saas_admin/Dockerfile \
    -t gamijoam/ferreteria-admin-panel:$VERSION \
    ferreteria_refactor/saas_admin 2>&1 | tail -3
```

### PASO 4 — Push a DockerHub

```bash
VERSION=$(cat /tmp/deploy_version.txt)
for img in ferreteria-backend ferreteria-app ferreteria-landing ferreteria-admin-panel; do
    echo "Subiendo $img..."
    docker push gamijoam/$img:$VERSION 2>&1 | tail -2
done
```

Si falla con `authorization failed`: verificar credenciales (ver Prerequisito 2).

### PASO 5 — Actualizar TAG en prod/.env

```bash
VERSION=$(cat /tmp/deploy_version.txt)
sed -i "s/^TAG=.*/TAG=$VERSION/" /root/deploy/prod/.env
grep TAG /root/deploy/prod/.env  # verificar
```

### PASO 6 — Reiniciar contenedores de PROD

**El operador humano ejecuta desde su SSH:**
```bash
cd /root/deploy/prod
docker compose up -d --force-recreate backend_prod frontend_prod landing_prod admin_panel_prod
```

> ⚠️ El MCP no tiene `docker-compose` disponible como plugin. Este paso requiere
> que el operador lo ejecute desde su sesión SSH directa en el VPS.
> La BD (db_prod) NO se reinicia — solo los 4 servicios de aplicación.

### PASO 7 — Smoke tests

```bash
# 1. Verificar contenedores corriendo con la nueva imagen
docker ps --filter "name=prod" --format "{{.Names}} | {{.Image}} | {{.Status}}"

# 2. Verificar que el backend arrancó sin errores
service_logs("backend_prod_server", lines=20)
# Buscar: "Application startup complete." — sin errores de import ni BD

# 3. Verificar que el API responde
docker exec backend_prod_server python3 -c "
import urllib.request
with urllib.request.urlopen('http://localhost:8000/api/v1/health', timeout=5) as r:
    print('Status:', r.status, r.read().decode())
"
```

### PASO 8 — Push a GitHub y documentar

```bash
cd /root/deploy/qa/code
git push origin main
```

Actualizar el cerebro con los cambios del deploy:
- `10_Registro_Actualizaciones.md` — qué cambió
- `30_Proceso_Deploy_Produccion.md` — este archivo si hubo aprendizajes nuevos

---

## Redes Docker en PROD

El proyecto usa dos redes:

| Red | Tipo | Usada por |
|---|---|---|
| `web_publica` | Externa (Traefik) | Todos los servicios con dominio público |
| `prod_prod_internal` | Interna (sin internet) | backend_prod ↔ db_prod |

> ⚠️ La red interna se llama `prod_prod_internal` (no `prod_internal`) porque
> docker-compose le agrega el prefijo del proyecto (`prod`). Nunca crear
> `prod_internal` manualmente — usar la que ya existe.

---

## Información de PROD

| Item | Valor |
|---|---|
| Base de datos | `invensoft_prod` en `db_prod_server` |
| Schemas activos | 37 tenants (ver tabla `public.tenants`) |
| API URL prod | `https://api.miinventariofacil.com/api/v1` |
| DockerHub user | `gamijoam` |
| TAG format | `prod-descripcion-YYYYMMDD` |
| Compose file | `/root/deploy/prod/docker-compose.yml` |
| .env prod | `/root/deploy/prod/.env` |

---

## Rollback de emergencia

Si algo falla después del deploy:

```bash
# 1. Ver el TAG anterior (estaba en prod/.env antes del cambio)
# (guardar el TAG anterior ANTES de hacer el deploy)

# 2. Cambiar el TAG en prod/.env al anterior
sed -i "s/^TAG=.*/TAG=prod-version-372/" /root/deploy/prod/.env

# 3. El operador reinicia desde SSH:
cd /root/deploy/prod
docker compose up -d --force-recreate backend_prod frontend_prod landing_prod admin_panel_prod
```

Las imágenes anteriores están en DockerHub con sus tags — el rollback es instantáneo.

> Si el rollback es por un error de BD (migración que rompió algo), contactar
> al DBA — las migraciones de columnas ADD son seguras pero DROP requiere cuidado.

---

## Historial de deploys

| TAG | Fecha | Contenido |
|---|---|---|
| `prod-version-372` | Anterior | Versión base anterior al taller/comisiones |
| `prod-taller-comisiones-20260401` | 2026-04-01 | Módulo taller rediseñado + Sistema Comisiones v2 + Config sidebar |

---

## Checklist rápido para el próximo deploy

```
[ ] 1. git status limpio en QA
[ ] 2. Backend QA sin errores en logs
[ ] 3. Credenciales DockerHub verificadas (test push)
[ ] 4. Migraciones BD identificadas y preparadas
[ ] 5. Build de 4 imágenes exitoso
[ ] 6. Push a DockerHub exitoso
[ ] 7. TAG actualizado en prod/.env
[ ] 8. Operador ejecuta docker compose up desde SSH
[ ] 9. Smoke test: containers up + API health 200
[ ] 10. git push origin main
[ ] 11. Cerebro actualizado
```
