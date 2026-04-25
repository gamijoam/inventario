# 60 - Sistema Multi-Empresa

Documentación completa del sistema de **organizaciones multi-empresa** de Mi Inventario Fácil. Permite agrupar varios tenants bajo una misma organización para compartir catálogo, transferir stock, y tener una vista consolidada del grupo.

---

## Estado

| Componente | QA | PROD |
|---|---|---|
| BD — 5 tablas + columnas | ✅ | ⏳ Pendiente merge |
| Backend — 22+ endpoints | ✅ | ⏳ |
| Frontend — 5 pantallas | ✅ | ⏳ |
| Panel SaaS Admin | ✅ | ⏳ |
| Bot de Telegram /org | ✅ | ⏳ (funciona cuando hay tablas) |

---

## Arquitectura general

```
public.organizations          ← Grupo empresarial
    │
    ├── public.organization_users    ← Quién puede hacer switch entre empresas
    ├── public.shared_products       ← Catálogo compartido del grupo
    └── public.inter_company_transfers ← Transferencias de stock entre empresas
           └── public.inter_company_transfer_items

public.tenants.organization_id ← FK que vincula empresa al grupo
```

**Principio clave:** `organization_id` es solo un campo de agrupación. No altera módulos, feature_flags, ni ninguna lógica del tenant individual. Cada empresa sigue siendo 100% independiente.

---

## Planes disponibles

| Plan | Empresas máx | Descripción |
|---|---|---|
| `duo` | 2 | Dos empresas en el grupo |
| `multi` | 5 | Hasta 5 empresas |
| `enterprise` | ilimitadas | Sin límite de empresas |

---

## Base de datos

### Tabla `public.organizations`
```sql
id, name, slug, owner_email, owner_name,
plan, max_tenants, is_active, created_at,
logo_url, primary_color,
use_shared_whatsapp, whatsapp_instance,   -- Sprint 6
plan_expires_at, plan_price, plan_notes   -- Sprint 6
```

### Tabla `public.organization_users`
```sql
id, organization_id, user_email, role (owner|manager|viewer),
can_switch, invited_at, accepted_at
```

### Tabla `public.shared_products`
```sql
id, organization_id, name, sku, description, category_name,
cost_price, suggested_price, image_url, created_at
-- UNIQUE(organization_id, sku) — no duplica por SKU
```

### Tabla `public.inter_company_transfers`
```sql
id, organization_id, from_tenant_id, to_tenant_id,
status (PENDING|ACCEPTED|REJECTED), notes, created_at, completed_at
```

### Tabla `public.inter_company_transfer_items`
```sql
id, transfer_id, product_sku, product_name, quantity, unit_cost
```

---

## Endpoints del backend

### Organizaciones
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/organizations` | Listar todas las orgs |
| POST | `/organizations` | Crear nueva org |
| GET | `/organizations/{id}` | Detalle de una org |
| PATCH | `/organizations/{id}` | Editar org |
| GET | `/organizations/mine` | Orgs del usuario actual |
| GET | `/organizations/consolidated-mine` | Dashboard consolidado auto-detectado |
| PATCH | `/organizations/{id}/plan` | Cambiar plan (solo superadmin) |
| GET | `/organizations/{id}/plan-info` | Info completa del plan |
| PATCH | `/organizations/{id}/whatsapp` | Configurar WA compartido |

### Tenants de la org
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/organizations/{id}/tenants` | Listar empresas del grupo |
| POST | `/organizations/{id}/tenants/{tid}` | Agregar empresa |
| DELETE | `/organizations/{id}/tenants/{tid}` | Quitar empresa |

### Miembros
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/organizations/{id}/members` | Listar miembros |
| POST | `/organizations/{id}/members` | Agregar miembro |
| DELETE | `/organizations/{id}/members/{mid}` | Quitar miembro |

### Catálogo compartido
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/organizations/{id}/catalog` | Listar catálogo |
| POST | `/organizations/{id}/catalog` | Agregar producto al catálogo |
| DELETE | `/organizations/{id}/catalog/{pid}` | Quitar producto |
| POST | `/organizations/{id}/catalog/import` | Importar productos a empresa actual |

### Transferencias entre empresas
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/inter-transfers` | Listar transferencias del tenant actual |
| POST | `/inter-transfers` | Crear solicitud de transferencia |
| PATCH | `/inter-transfers/{id}/accept` | Aceptar (descuenta origen, suma destino, Kardex) |
| PATCH | `/inter-transfers/{id}/reject` | Rechazar (no mueve stock) |

### Auth
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/switch-company` | Cambiar de empresa (genera nuevo token) |

El endpoint `/auth/token` retorna campos adicionales:
```json
{
  "access_token": "...",
  "has_multiple_companies": true,
  "org_companies": [
    {"tenant_id": 18, "schema_name": "oscar", "name": "oscar",
     "switch_url": "https://oscar.miinventariofacil.com", "is_current": true},
    {"tenant_id": 17, "schema_name": "jul", "name": "jul",
     "switch_url": "https://jul.miinventariofacil.com", "is_current": false}
  ]
}
```

---

## Frontend — Pantallas

### Rutas
| Ruta | Componente | Descripción |
|---|---|---|
| `/org/dashboard` | `ConsolidatedDashboard.jsx` | Dashboard consolidado del grupo |
| `/org/catalog` | `SharedCatalog.jsx` | Catálogo compartido |
| `/org/transfers` | `InterCompanyTransfers.jsx` | Transferencias de stock |
| `/org/config` | `OrgConfig.jsx` | Configuración del grupo |

### OrgSelector.jsx
- Aparece al hacer login si `has_multiple_companies === true`
- Muestra tarjetas para cada empresa del grupo
- Al seleccionar una, guarda el token y redirige al dashboard de esa empresa

### CompanySwitcher.jsx
- Dropdown en el Sidebar (bloque superior)
- Muestra empresa actual con ✓ verde
- Al seleccionar otra → llama `/auth/switch-company` → nuevo token → redirige

### ConsolidatedDashboard.jsx
- 4 KPIs: ventas totales grupo hoy, transacciones, mejor empresa, alertas stock
- Gráfico de barras SVG comparando ventas por empresa
- Panel de alertas de stock bajo por empresa
- Tabla de desempeño con link directo a cada empresa
- Auto-refresh cada 5 minutos

### SharedCatalog.jsx
- Grid de tarjetas de productos compartidos
- Búsqueda en tiempo real
- Selección múltiple para importar en lote
- Deduplicación por SKU al importar

### InterCompanyTransfers.jsx
- Tabs: Recibidas / Enviadas / Historial
- Modal de nueva transferencia con selector de empresa destino y búsqueda por SKU
- Al aceptar: descuenta stock en origen + suma en destino + Kardex en ambas BDs
- Si el producto no existe en destino, se crea automáticamente

### OrgConfig.jsx
- Sección Plan: barra de uso, precio, vencimiento, alerta si vencido
- Sección WhatsApp: toggle + nombre de instancia Baileys
- Sección Empresas del grupo: contador y enlace al panel admin
- Sección Miembros: lista con roles, agregar/quitar

---

## Panel SaaS Admin

**URL:** `https://admin-qa.miinventariofacil.com/dashboard/organizations`

### Organizations.tsx
- Grid de tarjetas con: avatar, nombre, plan badge, WA compartido badge, métricas, barra de uso, owner, precio
- 4 KPIs: total orgs, activas, empresas totales, ingreso mensual
- Filtros: búsqueda por nombre/email, filtro por plan
- Modal "Nueva organización": nombre, email dueño, selector visual de plan, precio, notas

### OrganizationDetails.tsx (4 tabs)
**Tab Empresas:**
- Barra de uso del plan
- Lista de empresas con estado, schema, link al detalle del tenant
- Selector para agregar empresa (con búsqueda y verificación de límite)
- Botón quitar empresa (solo desvincula, el tenant sigue existiendo)

**Tab Miembros:**
- Lista con rol y permisos
- Agregar por email con selector de rol (owner/manager/viewer)
- Quitar miembro (excepto owner)

**Tab Plan:**
- Estado actual: plan, uso de empresas, precio, vencimiento
- Formulario: cambiar plan, precio, fecha vencimiento, notas
- Alerta visual si el plan está vencido

**Tab WhatsApp:**
- Toggle activar/desactivar WA compartido
- Campo nombre de instancia Baileys
- Info de cómo funciona

---

## Fix crítico — Acceso cross-tenant

**Problema:** Al hacer switch de empresa, `get_current_user` en `dependencies.py` bloqueaba con 403 "You do not have access to this company" porque el usuario tenía `tenant_id` de la empresa origen, no de la destino.

**Fix aplicado en `dependencies.py`:**
```python
if user.tenant_id != tenant.id and not user.is_superuser:
    # Verificar membresía de organización
    from .models.organization import OrganizationUser as _OrgUser
    membership = db.query(_OrgUser).filter(
        _OrgUser.organization_id == tenant.organization_id,
        _OrgUser.user_email == email,
        _OrgUser.can_switch == True
    ).first()
    if membership:
        # Permitir acceso via membresía del grupo
        pass
    else:
        raise HTTPException(403, "You do not have access to this company")
```

---

## Bot de Telegram — Comandos /org

Ver `40_Telegram_Admin_Bot.md` para la documentación completa.

**Archivo:** `/root/deploy/telegram-bot/handlers/organizations.py`
- Usa `_psql()` con `docker exec db_prod_server psql ...` — sin SQLAlchemy
- 10 subcomandos: listar, detalle, crear, plan, precio, agregar, quitar, wa, bloquear, activar

---

## Verificado: Módulos y feature_flags son independientes por empresa

- Activar `has_pharmacy_module` en empresa A → empresa B de la misma org NO se afecta ✅
- `feature_flags` JSON son completamente independientes por tenant ✅
- El middleware NO lee `organization_id` para decidir qué módulos activar ✅
- Tests: 14/14 ✅

---

## Flujo completo para crear un grupo desde cero

**Opción 1 — Panel SaaS Admin** (recomendado):
1. Ir a `admin.miinventariofacil.com/dashboard/organizations`
2. Click en "+ Nueva organización"
3. Completar: nombre, email dueño, plan, precio
4. Ir al detalle → Tab Empresas → Agregar las empresas del grupo
5. Tab Miembros → Agregar el email del dueño como owner

**Opción 2 — Bot de Telegram:**
```
/org crear "Grupo Rodriguez" admin@rodriguez.com
/org agregar 1 ferreteria-centro
/org agregar 1 ferreteria-norte
/org plan 1 enterprise
/org precio 1 49.99
```

**Lo que experimenta el usuario tras la configuración:**
1. Inicia sesión normalmente en su empresa de siempre
2. Si tiene 2+ empresas en el grupo → aparece el `OrgSelector` para elegir empresa
3. Dentro del sistema → el `CompanySwitcher` en el sidebar permite cambiar de empresa sin re-login
4. Los ítems del sidebar muestran: Grupo Empresarial, Catálogo Compartido, Transferencias, Config. del Grupo

---

## Migraciones

Ver `20_Migraciones_SQL_Pendientes.md` para el script completo.

Script: `_CEREBRO_PROYECTO/migrate_multi_empresa.sql`
- QA: ✅ Aplicado 2026-04-05
- PROD: ⏳ Pendiente (aplicar antes del merge de `feature/multi-empresa`)

---

## CompanySwitcher — Flujo de switch entre dominios

### Problema de localStorage entre subdominios
`oscardemo.miinventariofacil.com` y `prueba.miinventariofacil.com` tienen localStorage **separado**. No se puede compartir `org_companies` directamente.

### Solución implementada (2026-04-06)
1. `handleSwitch` llama a `POST /auth/switch-company?target_schema=X`
2. Backend retorna `{ access_token, org_companies }` con `org_role` incluido
3. Frontend codifica `org_companies` en base64 y lo pasa como `?org_data=BASE64` en la URL de redirección
4. `Login.jsx` en el nuevo dominio lee `org_data`, decodifica y guarda en su `localStorage`

```
URL ejemplo: https://prueba.miinventariofacil.com/?impersonate_token=JWT&org_data=BASE64#/
```

### Dropdown hacia abajo
El dropdown usa `top-full mt-1 z-[200]` — abre hacia abajo desde el botón.
No usar `bottom-full` porque el sidebar puede estar en cualquier posición vertical.

---

## Roles de organización (org_role)

| Campo | Valor | Acceso |
|-------|-------|--------|
| `org_role = "owner"` | Dueño del grupo | Métricas del Grupo, Config del Grupo, Catálogo, Transferencias |
| `org_role = "manager"` | Miembro | Solo Catálogo Compartido y Transferencias |

### Detección en frontend
```js
// En Sidebar.jsx y OrgConfig.jsx
const orgs = JSON.parse(localStorage.getItem('org_companies') || '[]');
const current = orgs.find(o => o.is_current) || orgs[0];
const isOrgOwner = current?.org_role === 'owner';
```

### Endpoints que incluyen org_role
- `POST /auth/token` → en `org_companies[]`
- `POST /auth/switch-company` → en `org_companies[]`

---

## Migración SQL aplicada en PROD

```sql
-- purchase_orders — columnas de descuento (aplicado 2026-04-05)
ALTER TABLE schema.purchase_orders
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(18,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_type   VARCHAR(20)   DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS discount_notes  TEXT;
```

