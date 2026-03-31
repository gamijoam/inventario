# 29 — Workflow de Desarrollo via MCP (para IAs)

> Este documento es la guía operativa para cualquier IA que se conecte al VPS via MCP.
> Léelo completo antes de tocar cualquier archivo.

---

## Contexto del entorno

Cuando te conectas via MCP estás operando **directamente en el VPS de producción** (212.28.176.157).
Existen dos entornos:

| Entorno | Directorio | Uso |
|---------|-----------|-----|
| **QA** | `/root/deploy/qa/code/` | Aquí se hacen TODOS los cambios |
| **Prod** | `/root/deploy/prod/` | Solo se toca al promover — NUNCA editar directo |

El backend QA corre en modo **hot reload** (bind mount + uvicorn --reload).
Cuando escribes un archivo `.py` en QA, el servidor recarga en ~1 segundo automáticamente.
El frontend (React) NO tiene hot reload — requiere rebuild de imagen Docker.

---

## Herramientas disponibles

| Herramienta | Qué hace |
|------------|---------|
| `exec` | Ejecuta cualquier comando bash en el VPS |
| `read_file` | Lee un archivo |
| `write_file` | Escribe/sobreescribe un archivo |
| `list_dir` | Lista un directorio |
| `service_logs` | Logs de un contenedor Docker |
| `restart_service` | Reinicia un contenedor |
| `git_status` | Estado git del código QA |
| `promote_to_prod` | Pipeline completo QA → Prod |

---

## Rutas importantes

```
/root/deploy/qa/code/ferreteria_refactor/
├── backend_api/          ← Python/FastAPI — hot reload activo
│   ├── main.py
│   ├── routers/          ← Un archivo por dominio
│   ├── models/models.py  ← Todos los modelos SQLAlchemy
│   ├── services/
│   └── utils/time_utils.py  → get_venezuela_now() para fechas
├── frontend_web/src/     ← React — requiere rebuild para ver cambios
│   ├── pages/
│   ├── components/
│   ├── context/
│   └── config/axios.js
└── _CEREBRO_PROYECTO/    ← Documentación del proyecto (aquí estás)
```

---

## Flujo obligatorio para hacer cambios

### Paso 1 — Leer antes de escribir

**NUNCA** modifiques un archivo sin leerlo primero.

```
read_file("/root/deploy/qa/code/ferreteria_refactor/backend_api/routers/sales.py")
```

### Paso 2 — Hacer el cambio

```
write_file("/root/deploy/qa/code/ferreteria_refactor/backend_api/routers/sales.py", "...contenido completo...")
```

> `write_file` sobreescribe el archivo completo. Asegúrate de incluir TODO el contenido, no solo el fragmento modificado.

### Paso 3 — Verificar en QA

**Backend:** el cambio ya está activo (hot reload). Verifica con logs si hay errores:
```
service_logs("backend_qa_server", lines=30)
```

**Frontend:** el cambio NO es visible hasta que hagas rebuild de imagen. Ver sección "Rebuild frontend QA" más abajo.

### Paso 4 — Commit y push

```
exec("cd /root/deploy/qa/code && git add -A && git commit -m 'tipo(scope): descripción concisa' && git push origin main")
```

**Formato de commit obligatorio:**
```
fix(pos): descripción del bug corregido
feat(backend): descripción de la nueva función
fix(frontend): descripción del cambio en UI
docs(cerebro): descripción del documento actualizado
```

---

## Rebuild de imagen frontend QA

Cuando cambias archivos de React (`.jsx`, `.tsx`, `.css`, `config/`), hay que reconstruir la imagen:

```bash
# 1. Build nueva imagen (incrementar versión)
exec("cd /root/deploy/qa/code/ferreteria_refactor/frontend_web && docker build -f Dockerfile.prod --build-arg VITE_API_URL=https://api-qa.miinventariofacil.com/api/v1 -t gamijoam/ferreteria-app:qa-version-XX .")

# 2. Push a DockerHub
exec("docker push gamijoam/ferreteria-app:qa-version-XX")

# 3. Actualizar TAG en .env de QA
exec("sed -i 's/TAG=qa-version-YY/TAG=qa-version-XX/' /root/deploy/qa/.env")

# 4. Restart contenedor
exec("cd /root/deploy/qa && docker compose up -d --no-deps --force-recreate frontend_qa")
```

Para saber la versión actual:
```
exec("grep TAG /root/deploy/qa/.env")
```

> Nota: el Dockerfile del frontend está en `frontend_web/Dockerfile.prod`. El contexto de build debe ser `frontend_web/` (no la raíz del repo).

---

## Promover a producción

Solo cuando el usuario confirme explícitamente ("sube a prod", "pasa a prod", etc.):

```
promote_to_prod(confirmed=true, version="descripcion-corta")
```

Esto ejecuta `/root/deploy/deploy_prod_from_vps.sh` que hace:
1. `git commit` de cambios pendientes en QA
2. `git push` a GitHub main
3. Build de 4 imágenes Docker en el VPS: `backend`, `app`, `landing`, `admin-panel`
4. Push a DockerHub con tag `prod-{version}-{fecha}`
5. Actualiza TAG en `/root/deploy/prod/.env`
6. `docker compose up --force-recreate` en prod
7. `docker image prune` para limpiar imágenes viejas

**Tiempo estimado:** 8-15 minutos (build de 4 imágenes).

**NUNCA** promover a prod sin confirmación explícita del usuario.

---

## Rollback

### Rollback en QA
```bash
# Ver historial
exec("cd /root/deploy/qa/code && git log --oneline -10")

# Revertir un commit específico
exec("cd /root/deploy/qa/code && git revert <hash> --no-edit && git push origin main")

# O restaurar un archivo específico
exec("cd /root/deploy/qa/code && git checkout <hash> -- ruta/al/archivo.py")
```

### Rollback en Prod
Prod corre imágenes Docker taggeadas. Para volver a la versión anterior:
```bash
# Ver versión actual
exec("grep TAG /root/deploy/prod/.env")

# Cambiar al tag anterior (el usuario debe conocer el tag)
exec("sed -i 's/TAG=prod-actual/TAG=prod-anterior/' /root/deploy/prod/.env")
exec("cd /root/deploy/prod && docker compose up -d --force-recreate")
```
Las imágenes viejas están en DockerHub — el rollback es instantáneo, sin rebuild.

---

## Reglas críticas del proyecto

### Fechas — SIEMPRE Venezuela (UTC-4)
```python
# ❌ MAL
datetime.now()
date.today()

# ✅ BIEN
from .utils.time_utils import get_venezuela_now
get_venezuela_now()
get_venezuela_now().date()
```

### Multi-tenancy
- **NUNCA** hardcodear `schema_name` ni `tenant_id`
- El ORM resuelve el schema automáticamente via `search_path`
- Si haces `db.commit()` y luego necesitas releer datos, el `search_path` se pierde → usar `db.flush()` antes del commit

### Feature flags
- Funciones nuevas que no son para todos los tenants → usar `useFeatureFlag('nombre')` en frontend y verificar en backend
- **NUNCA** condicionar features a `modules?.services`, `modules?.barbershop`, etc. a menos que sea estrictamente exclusivo de ese módulo
- Las listas de precios y comisiones son globales — no requieren ningún módulo

### Frontend
- Router: **HashRouter** — todas las rutas tienen `/#/`
- `VITE_API_URL` se bake en build time — no cambia en runtime
- Lazy loading en 58+ páginas con `React.lazy()`

### Backend
- `slowapi` rate limiting: el parámetro `Request` DEBE llamarse exactamente `request`
- Reset password: JWT `sub` = `user.email` (no username)

---

## Contenedores en el VPS

| Contenedor | Descripción | Entorno |
|-----------|-------------|---------|
| `backend_qa_server` | FastAPI hot reload | QA |
| `frontend_qa_server` | React (imagen Docker) | QA |
| `db_qa_server` | PostgreSQL 15 | QA |
| `admin_panel_qa` | Panel SaaS admin | QA |
| `backend_prod_server` | FastAPI producción | Prod |
| `frontend_prod_server` | React producción | Prod |
| `db_prod_server` | PostgreSQL 15 | Prod |
| `admin_panel_prod_server` | Panel SaaS admin | Prod |
| `mcp_server` | Este servidor MCP | Prod |

---

## Verificación rápida al iniciar sesión

Antes de empezar cualquier tarea, ejecuta:
```
git_status()
```

Si hay cambios sin commitear del trabajo anterior, decide si deben commitearse o descartarse antes de continuar.
