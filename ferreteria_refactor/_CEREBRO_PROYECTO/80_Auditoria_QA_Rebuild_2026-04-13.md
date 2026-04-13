# 🔧 Auditoría QA Rebuild — 13 de Abril 2026

## 📋 Resumen Ejecutivo

Se realizó una reconstrucción completa del entorno QA desde cero para resolver problemas de programación. El trabajo incluyó limpiar código de GitHub, reconstruir la base de datos con estructura de producción, y corregir **dos bugs críticos**: conectividad del Admin Panel y CRASHs 500 del Backend por pérdida de `search_path`.

---

## 🔴 PROBLEMA 1: Admin Panel no conectaba con Backend

### Síntoma
El usuario intentaba loguearse en `https://admin-qa.miinventariofacil.com/login` con credenciales correctas y recibía **"credenciales incorrectas"**.

### Causa Raíz

El `VITE_API_URL` del Admin Panel estaba configurado **sin** el prefijo `/api/v1/`:

```
VITE_API_URL=https://api-qa.miinventariofacil.com       ← INCORRECTO
```

Los endpoints del código usan rutas relativas:
```typescript
// AuthContext.tsx
const response = await api.post<AuthResponse>('/auth/token', params, {...})
```

Esto resultaba en URLs mal formadas:
```
baseURL + endpoint = https://api-qa.miinventariofacil.com/auth/token  → 404 Not Found
```

La URL correcta debía ser:
```
https://api-qa.miinventariofacil.com/api/v1/auth/token  → 200 OK
```

### ¿Por qué el Frontend QA SÍ funcionaba?

El frontend de tenants tiene código defensivo que agrega `/api/v1` automáticamente:

```typescript
const XI = () => "https://api-qa.miinventariofacil.com".trim().replace(/\/+$/, "");
const ui = XI();
const ov = ui.includes("/api/v1") ? ui : `${ui}/api/v1`;  // ← AGREGA /api/v1 SI FALTA
const ZI = ov.endsWith("/") ? ov : `${ov}/`;
const Ee = axios.create({ baseURL: ZI, ... });
```

**El Admin Panel NO tiene esta lógica** — usa `VITE_API_URL` directamente sin procesamiento.

### Solución Aplicada

**Rebuild del Admin Panel con la URL correcta:**

```bash
cd /root/deploy/qa/code
docker build --no-cache \
  -f ferreteria_refactor/saas_admin/Dockerfile \
  --build-arg VITE_API_URL=https://api-qa.miinventariofacil.com/api/v1 \
  -t gamijoam/ferreteria-admin-panel:qa-fix-apiv1-20260413 \
  ferreteria_refactor/saas_admin
```

**Tag:** `qa-fix-apiv1-20260413`

---

## 🔴 PROBLEMA 2: Backend CRASHs con "relation does not exist"

### Síntoma
12 CRASHs y 16 errores HTTP 500 en requests del tenant `cosaloca`. El backend reportaba:
```
🔥 [CRASH] Request failed: relation "sales" does not exist
🔥 [CRASH] Request failed: relation "quotes" does not exist
🔥 [CRASH] Request failed: relation "products" does not exist
🔥 [CRASH] Request failed: relation "sale_details" does not exist
```

Las requests que fallaban incluían:
- `GET /api/v1/quotes`
- `GET /api/v1/reports/sales/summary`
- `GET /api/v1/products/sales/`
- `GET /api/v1/reports/top-products`

### Causa Raíz

El mecanismo de multi-tenant usa `search_path` de PostgreSQL:
```sql
SET search_path TO "cosaloca", public
```

Esto se ejecutaba en `get_db()` al inicio de cada request. **Pero se perdía** cuando el código del request hacía `db.commit()` a mitad de la ejecución (ej: `service_checkout_service`, `convert_order_to_sale`, etc.).

**¿Por qué se pierde?**
1. `db.commit()` causa que SQLAlchemy interneally reconecte la conexión
2. La nueva conexión hereda el `search_path` por defecto de PostgreSQL (`"$user", public`)
3. Las queries posteriores buscan tablas en `public` donde no existen → **CRASH**
4. Este es un **bug documentado en los tests** del propio proyecto (`test_func_services_autocheckout_pg.py`):
   > "después de `db.commit()`, el search_path de PostgreSQL se resetea al default"

**Diagrama del problema:**
```
Request llega → get_db() → SET search_path TO "cosaloca", public  ✅
  ↓
  Primera query funciona → SELECT * FROM sales  (busca en cosaloca.sales) ✅
  ↓
  Código interno hace db.commit() → SQLAlchemy reconecta
  ↓
  Nueva conexión tiene search_path = "$user", public (DEFAULT)  ❌
  ↓
  Segunda query → SELECT * FROM sales  (busca en public.sales)  ❌
  ↓
  🔥 CRASH: relation "sales" does not exist
```

### Solución Aplicada

Se agregó un **event listener de SQLAlchemy a nivel de pool de conexiones** en `backend_api/database/db.py`:

```python
_schema_cache: dict = {}

def _apply_search_path(dbapi_conn, connection_record, connection_proxy=None):
    """Aplica search_path AUTOMÁTICAMENTE en cada checkout del pool."""
    schema = get_tenant_schema()
    if not schema or schema == "public":
        return  # Default search_path is fine

    if not _SAFE_SCHEMA_RE.match(schema):
        logger.warning(f"[search_path] Rejected unsafe schema: {schema}")
        return

    # Check schema existence (cached)
    if schema not in _schema_cache:
        cursor = dbapi_conn.cursor()
        cursor.execute(
            "SELECT 1 FROM information_schema.schemata WHERE schema_name = %s",
            (schema,)
        )
        _schema_cache[schema] = cursor.fetchone() is not None
        cursor.close()
        if not _schema_cache[schema]:
            return

    cursor = dbapi_conn.cursor()
    cursor.execute(f'SET search_path TO "{schema}", public')
    cursor.close()

# Registrar el listener en el engine
event.listen(engine, "checkout", _apply_search_path)
```

**¿Cómo funciona?**
- SQLAlchemy dispara el evento `"checkout"` **cada vez** que una conexión sale del pool
- No importa si es una conexión nueva, reciclada, o reconectada después de `db.commit()`
- El `search_path` se re-aplica automáticamente antes de cualquier query
- Incluye caché de existencia de schemas para reducir queries a `information_schema`

**Diagrama con el fix:**
```
Request llega → get_db() → connection checkout → _apply_search_path() ✅
  ↓
  SET search_path TO "cosaloca", public  ✅
  ↓
  Primera query → SELECT * FROM sales (cosaloca.sales) ✅
  ↓
  db.commit() → SQLAlchemy reconecta
  ↓
  NUEVA conexión → evento "checkout" → _apply_search_path() ✅
  ↓
  SET search_path TO "cosaloca", public  ✅
  ↓
  Segunda query → SELECT * FROM sales (cosaloca.sales) ✅
  ↓
  Todo funciona sin CRASHs ✅
```

**Imagen rebuild:**
```bash
cd /root/deploy/qa/code
docker build --no-cache \
  -f ferreteria_refactor/backend_api/Dockerfile \
  -t gamijoam/ferreteria-backend:qa-fix-searchpath-20260413-v2 \
  .
```

### Resultado

| Métrica | ANTES del fix | DESPUÉS del fix |
|---------|---------------|-----------------|
| **CRASHs** | 12 | **0** ✅ |
| **Errores 500** | 16 | **0** ✅ |
| **Requests 200 OK** | 226 (con fallos) | **Todas** ✅ |
| `GET /api/v1/cash/registers/status` | ❌ CRASH | ✅ 200 (0.025s) |
| `GET /api/v1/health` | ✅ 200 | ✅ 200 (0.002s) |
| `GET /api/v1/support/tickets/unread-count` | ❌ CRASH | ✅ 200 (0.092s) |

---

## 🔄 RECONSTRUCCIÓN COMPLETA DE QA

### Fase 1: Código limpio desde GitHub
```bash
cd /root/deploy/qa/code
git fetch origin && git reset --hard origin/main
```

### Fase 2: Base de datos con estructura de producción
```bash
# Drop completo y recrear
docker exec db_qa_server psql -U postgres -c "DROP DATABASE invensoft_qa WITH (FORCE);"
docker exec db_qa_server psql -U postgres -c "CREATE DATABASE invensoft_qa OWNER postgres;"

# Copiar schema public de prod (sin datos)
docker exec db_prod_server pg_dump -U postgres \
  --schema-only --no-owner --no-privileges -n public invensoft_prod \
  > /tmp/prod_public_schema.sql
docker exec -i db_qa_server psql -U postgres -d invensoft_qa < /tmp/prod_public_schema.sql
```

### Fase 3: Contenedores reconstruidos
| Contenedor | Imagen Final | Notas |
|-----------|-------------|-------|
| Backend QA | `qa-fix-searchpath-20260413-v2` | Con fix search_path event listener |
| Frontend QA | `qa-rebuild-clean-20260413` | Build código limpio |
| Admin Panel | `qa-fix-apiv1-20260413` | Con `/api/v1/` en VITE_API_URL |
| Landing QA | `qa-rebuild-clean-20260413` | Re-tag existente |
| DB QA | `postgres:15-alpine` | Schema public de prod |

---

## ⚠️ Problemas Secundarios Resueltos

### 1. Passwords con hash inválido
Hash placeholder `pbkdf2:sha256:260000$default$hash` → regenerado con **bcrypt**.

### 2. Campo `username` NULL
`/users/login` filtra por `username` no por `email` → seteado `username = email`.

### 3. Usuario sin privilegios de superusuario
`/admin/tenants` requiere `is_superuser = true` → seteado.

### 4. Admin Panel sin `/api/v1/` en VITE_API_URL
Ver Problema 1 arriba.

---

## 📝 Lecciones Aprendidas

### 1. VITE_API_URL siempre debe incluir `/api/v1/`
El Admin Panel no tiene fallback defensivo como el frontend de tenants. Si se olvida el `/api/v1/`, todo login falla silenciosamente con 404.

### 2. Docker `--no-cache` obligatorio con variables VITE
Las variables `VITE_*` se resuelven en build time. Con cache, los cambios de `--build-arg` se ignoran.

### 3. SET search_path no sobrevive a db.commit()
Este es un **patrón peligroso** en cualquier app multi-tenant con PostgreSQL + SQLAlchemy. La solución robusta es usar un **event listener de checkout** en lugar de confiar en que `get_db()` lo haga manualmente.

### 4. Verificar JS compilado post-build
```bash
docker exec <container> grep -o 'baseURL.*' /usr/share/nginx/html/assets/*.js
```

---

## 🔐 Credenciales QA

| Rol | Email | Username | Password | Superuser |
|-----|-------|----------|----------|-----------|
| Admin SAAS | `rodriguezisaac876@gmail.com` | `rodriguezisaac876@gmail.com` | `admin123` | ✅ Sí |
| Admin genérico | `admin@admin.com` | `admin@admin.com` | `admin123` | ❌ No |
| Tenant cosaloca | `cosaloca@gmail.com` | `admin` | *(ver en BD)* | ❌ No |

## 🌐 Endpoints QA

| Servicio | URL |
|----------|-----|
| Frontend (tenants) | `https://app-qa.miinventariofacil.com` |
| Backend API | `https://api-qa.miinventariofacil.com` |
| Admin Panel SAAS | `https://admin-qa.miinventariofacil.com` |
| Landing Page | `https://qa.miinventariofacil.com` |

---

## 📊 Estado Final

| Componente | Estado | Notas |
|-----------|--------|-------|
| Código | ✅ Limpio, main de GitHub | Sin cambios pendientes |
| BD QA | ✅ Estructura = Prod | 16 tablas public + schema cosaloca |
| Backend QA | ✅ Respondiendo | **0 CRASHs, 0 errores 500** |
| Frontend QA | ✅ Respondiendo | API URL correcta |
| Admin Panel QA | ✅ Respondiendo | API URL con /api/v1 corregida |
| search_path | ✅ Persistente | Event listener en checkout del pool |

---

*Documento actualizado el 2026-04-13 — Incluye fix de search_path (Problema 2).*
