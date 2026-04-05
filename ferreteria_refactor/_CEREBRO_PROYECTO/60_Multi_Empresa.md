# 60 — Sistema Multi-Empresa (Opción C — Completa)

> **Rama:** `feature/multi-empresa`
> **Creado:** 2026-04-05
> **Estado:** 🏗️ EN DESARROLLO
> **Entorno:** Siempre trabajar en QA primero

---

## 1. Objetivo

Permitir que un cliente (dueño) pueda gestionar múltiples empresas desde una sola cuenta, con:
- Un login unificado con selector de empresa
- Cambio rápido entre empresas sin cerrar sesión
- Dashboard consolidado de todas las empresas del grupo
- Catálogo compartido entre empresas del mismo grupo
- Transferencias de stock entre empresas del grupo
- Reportes consolidados (ventas, inventario, caja)
- Un solo WhatsApp para todo el grupo (opcional)
- Planes multi-empresa con descuento

---

## 2. Arquitectura

### Modelo de datos nuevo

```
public.organizations          ← Grupo empresarial (el "dueño")
      │
      ├── public.tenants      ← Cada empresa (ya existe, agregar organization_id)
      │       └── schema propio (ferreteria, taller, celulares...)
      │
      └── public.organization_users  ← Quién puede acceder al grupo
```

### Tabla `public.organizations`

```sql
CREATE TABLE public.organizations (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,         -- "Grupo Empresarial Rodríguez"
    slug            VARCHAR(100) UNIQUE NOT NULL,  -- "grupo-rodriguez" (URL del portal)
    owner_email     VARCHAR(255) NOT NULL,
    owner_name      VARCHAR(200),
    plan            VARCHAR(50)  DEFAULT 'multi',  -- 'duo','multi','enterprise'
    max_tenants     INT          DEFAULT 5,
    is_active       BOOLEAN      DEFAULT true,
    created_at      TIMESTAMP    DEFAULT NOW(),
    logo_url        TEXT,
    primary_color   VARCHAR(10)  DEFAULT '#4F46E5'
);
```

### Columna nueva en `public.tenants`

```sql
ALTER TABLE public.tenants
    ADD COLUMN organization_id INTEGER REFERENCES public.organizations(id);
```

### Tabla `public.organization_users`

```sql
CREATE TABLE public.organization_users (
    id              SERIAL PRIMARY KEY,
    organization_id INTEGER      REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_email      VARCHAR(255) NOT NULL,
    role            VARCHAR(50)  DEFAULT 'owner',   -- owner, manager, viewer
    can_switch      BOOLEAN      DEFAULT true,       -- puede cambiar de empresa
    invited_at      TIMESTAMP    DEFAULT NOW(),
    accepted_at     TIMESTAMP,
    UNIQUE(organization_id, user_email)
);
```

### Tabla `public.shared_products` (catálogo compartido)

```sql
CREATE TABLE public.shared_products (
    id              SERIAL PRIMARY KEY,
    organization_id INTEGER      REFERENCES public.organizations(id),
    name            VARCHAR(300) NOT NULL,
    sku             VARCHAR(100),
    description     TEXT,
    cost_price      NUMERIC(14,4) DEFAULT 0,
    suggested_price NUMERIC(14,4) DEFAULT 0,
    category_name   VARCHAR(100),
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT NOW()
);
```

### Tabla `public.inter_company_transfers` (stock entre empresas)

```sql
CREATE TABLE public.inter_company_transfers (
    id              SERIAL PRIMARY KEY,
    organization_id INTEGER      REFERENCES public.organizations(id),
    from_tenant_id  INTEGER      REFERENCES public.tenants(id),
    to_tenant_id    INTEGER      REFERENCES public.tenants(id),
    status          VARCHAR(50)  DEFAULT 'PENDING', -- PENDING, ACCEPTED, REJECTED
    notes           TEXT,
    created_by      INTEGER      REFERENCES public.users(id),
    created_at      TIMESTAMP    DEFAULT NOW(),
    completed_at    TIMESTAMP
);

CREATE TABLE public.inter_company_transfer_items (
    id              SERIAL PRIMARY KEY,
    transfer_id     INTEGER      REFERENCES public.inter_company_transfers(id),
    product_sku     VARCHAR(100) NOT NULL,
    product_name    VARCHAR(300) NOT NULL,
    quantity        NUMERIC(12,3) NOT NULL,
    unit_cost       NUMERIC(14,4) DEFAULT 0
);
```

---

## 3. Sprints de desarrollo

### Sprint 1 — Base de datos y backend (Semana 1)

**Migraciones:**
- [ ] Crear `public.organizations`
- [ ] Crear `public.organization_users`
- [ ] Agregar `organization_id` en `public.tenants`
- [ ] Crear `public.shared_products`
- [ ] Crear `public.inter_company_transfers` + items

**Backend — nuevos routers:**
- [ ] `POST /admin/organizations` — crear organización
- [ ] `GET /admin/organizations` — listar organizaciones
- [ ] `PATCH /admin/organizations/{id}` — editar
- [ ] `POST /admin/organizations/{id}/tenants` — agregar empresa al grupo
- [ ] `DELETE /admin/organizations/{id}/tenants/{tenant_id}` — quitar empresa
- [ ] `POST /admin/organizations/{id}/users` — invitar usuario al grupo
- [ ] `GET /organizations/mine` — mis organizaciones (para el dueño)
- [ ] `GET /organizations/{id}/switch/{tenant_id}` — generar token de cambio de empresa
- [ ] `GET /organizations/{id}/consolidated` — dashboard consolidado

**Bot de Telegram:**
- [ ] `/org crear [nombre] [email_dueño]` — crear organización
- [ ] `/org listar` — listar organizaciones
- [ ] `/org agregar [org_id] [schema]` — agregar empresa a organización
- [ ] `/org plan [org_id] [plan]` — cambiar plan

---

### Sprint 2 — Login unificado y selector de empresa (Semana 2)

**Backend:**
- [ ] Modificar `POST /auth/token` para detectar si el usuario pertenece a una organización
- [ ] Si tiene organización con 2+ empresas → devolver `org_token` además del `access_token`
- [ ] `GET /auth/org-companies` — listar empresas del grupo para el selector
- [ ] `POST /auth/switch-company` — cambiar de empresa con el `org_token`

**Frontend:**
- [ ] Nueva pantalla `OrgSelector.jsx` — selección de empresa al login
- [ ] Menú de cambio rápido en el sidebar (ícono de edificio → dropdown con empresas)
- [ ] Indicador visual de en qué empresa estás trabajando
- [ ] `app.miinventariofacil.com` como portal de entrada para multi-empresa

---

### Sprint 3 — Dashboard consolidado (Semana 3)

**Backend:**
- [ ] `GET /organizations/{id}/consolidated/sales` — ventas del grupo hoy / semana / mes
- [ ] `GET /organizations/{id}/consolidated/inventory` — inventario total del grupo
- [ ] `GET /organizations/{id}/consolidated/cash` — caja de todas las empresas
- [ ] `GET /organizations/{id}/consolidated/alerts` — alertas de stock de todas las empresas

**Frontend:**
- [ ] `ConsolidatedDashboard.jsx` — dashboard del grupo con:
  - Ventas totales del grupo (por empresa y total)
  - Gráfico comparativo entre empresas
  - Alertas de stock unificadas
  - Qué empresa tuvo mejor desempeño hoy

---

### Sprint 4 — Catálogo compartido (Semana 3-4)

**Backend:**
- [ ] `GET /organizations/{id}/shared-catalog` — catálogo compartido
- [ ] `POST /organizations/{id}/shared-catalog` — agregar producto al catálogo
- [ ] `POST /organizations/{id}/shared-catalog/import-to-tenant` — copiar productos del catálogo a una empresa específica
- [ ] Lógica de sincronización: si un producto del catálogo se actualiza, propagar a las empresas que lo tienen

**Frontend:**
- [ ] Vista de catálogo compartido
- [ ] Botón "Importar del catálogo compartido" en el módulo de productos de cada empresa
- [ ] Indicador "Producto compartido" en los productos que vienen del catálogo de la org

---

### Sprint 5 — Transferencias entre empresas (Semana 4)

**Backend:**
- [ ] `POST /inter-transfers` — crear solicitud de transferencia
- [ ] `GET /inter-transfers` — ver transferencias de mi empresa
- [ ] `PATCH /inter-transfers/{id}/accept` — aceptar transferencia
- [ ] `PATCH /inter-transfers/{id}/reject` — rechazar
- [ ] Al aceptar: descontar stock de la empresa origen, sumar en la empresa destino, Kardex en ambas

**Frontend:**
- [ ] `InterCompanyTransfers.jsx` — módulo de transferencias entre empresas del grupo
- [ ] Notificación cuando llega una solicitud de transferencia
- [ ] Historial de transferencias

---

### Sprint 6 — WhatsApp compartido y planes (Semana 5)

**WhatsApp compartido:**
- [ ] Opción en la org para usar una sola instancia de Baileys para todas las empresas
- [ ] Cada mensaje incluye el nombre de la empresa para que el cliente sepa de cuál viene
- [ ] Config: `use_shared_whatsapp` en organization

**Planes multi-empresa:**
- [ ] Tabla `organization_plans` con precios y límites
- [ ] Integración con el bot de Telegram para cambiar el plan de una org
- [ ] Panel SaaS: sección de organizaciones con gestión de planes
- [ ] Lógica de expiración por organización (si la org vence, bloquear acceso a todas las empresas)

---

## 4. Impacto en código existente

### Lo que NO cambia
- Arquitectura de schemas PostgreSQL por tenant
- Middleware de detección de tenant (sigue usando subdominio)
- Endpoints existentes de cada empresa
- El POS, taller, inventario, compras, etc.
- Los tenants sin organización siguen funcionando igual

### Lo que SÍ cambia
- `POST /auth/token` — detecta si el usuario tiene organización
- `POST /admin/tenants` — acepta `organization_id` opcional al crear
- Panel SaaS admin — nueva sección de organizaciones
- Bot de Telegram — nuevos comandos `/org`
- `seed_tenant_data` — inicializar claves de catálogo compartido

---

## 5. Reglas de desarrollo (IMPORTANTE)

1. **Siempre trabajar en la rama `feature/multi-empresa`**
2. **Probar en QA antes de cualquier merge a main**
3. **Las migraciones de BD se aplican en QA primero** — script en `_CEREBRO_PROYECTO/migrate_multi_empresa.sql`
4. **No tocar tablas de tenants existentes** sin migración probada
5. **Los endpoints nuevos de /organizations no deben romper los existentes**

---

## 6. Orden de implementación sugerido

```
Sprint 1 (BD + backend base)
    ↓
Sprint 2 (login unificado)
    ↓
Sprint 3 (dashboard consolidado)
    ↓  Primer merge a main con estas 3 features
Sprint 4 (catálogo compartido)
    ↓
Sprint 5 (transferencias)
    ↓
Sprint 6 (WhatsApp + planes)
    ↓  Merge final a main
```

---

## 7. Archivos a crear

```
backend_api/routers/organizations.py        ← Router principal
backend_api/routers/inter_transfers.py      ← Transferencias entre empresas
backend_api/schemas/organization.py         ← Schemas Pydantic
backend_api/models/organization.py          ← Modelos SQLAlchemy
backend_api/services/consolidated.py        ← Lógica dashboard consolidado
backend_api/services/shared_catalog.py      ← Lógica catálogo compartido

frontend_web/src/pages/Org/
    OrgSelector.jsx                         ← Selector de empresa al login
    ConsolidatedDashboard.jsx               ← Dashboard del grupo
    SharedCatalog.jsx                       ← Catálogo compartido
    InterCompanyTransfers.jsx               ← Transferencias

_CEREBRO_PROYECTO/migrate_multi_empresa.sql ← Migraciones
```
