# 61 - Panel SaaS Admin — Módulo Organizaciones

Módulo para gestionar grupos empresariales (multi-empresa) desde el panel de administración SaaS.

**URL QA:** `https://admin-qa.miinventariofacil.com/dashboard/organizations`
**URL PROD:** `https://admin.miinventariofacil.com/dashboard/organizations` (pendiente deploy)

---

## Archivos

```
saas_admin/src/
├── api/
│   └── organizations.ts       ← 16 funciones API (CRUD orgs, tenants, miembros, plan, WA)
├── pages/
│   ├── Organizations.tsx      ← Página principal (grid + modal crear)
│   └── OrganizationDetails.tsx ← Detalle con 4 tabs
└── layouts/
    └── DashboardLayout.tsx    ← NavItem "Organizaciones" agregado
```

---

## Organizations.tsx — Página principal

### Funcionalidades
- Grid de tarjetas: una por organización
- Cada tarjeta muestra: avatar con color primario, nombre, slug, plan badge, badge WA compartido, métricas (empresas/miembros), barra de uso del plan, email del owner, precio mensual
- 4 KPIs arriba: total orgs, activas, empresas totales, ingreso mensual estimado
- Buscador por nombre o email del dueño
- Filtro por plan (Dúo / Multi / Enterprise)
- Botón "Refrescar"
- Botón "+ Nueva organización" → abre modal

### Modal "Nueva organización"
Campos:
- Nombre del grupo (obligatorio)
- Email del dueño (obligatorio, validado)
- Nombre del dueño (opcional)
- Selector visual de plan (Dúo / Multi / Enterprise) con descripción de límites
- Precio mensual en USD
- Notas internas

Al crear: el owner se agrega automáticamente como miembro con rol `owner`.

---

## OrganizationDetails.tsx — Página de detalle

### Header
- Avatar con color primario + nombre + slug
- Estado (activa/inactiva)
- Email y nombre del owner
- Precio mensual
- Botón "Activar/Desactivar grupo"

### Tab 1: Empresas
- Barra de uso del plan (con alerta si > 90%)
- Alerta visual si se alcanzó el límite
- Lista de empresas: nombre, schema, estado, link al detalle del tenant
- Buscador para agregar empresa (filtra tenants disponibles = activos y sin organización)
- Verificación de límite del plan antes de agregar
- Botón quitar empresa (desvincula el tenant, no lo elimina)

### Tab 2: Miembros
- Lista de miembros: email, rol (badge coloreado), ícono si puede hacer switch
- Formulario agregar miembro: email + selector de rol (owner/manager/viewer)
- Quitar miembro (excepto owner)
- Los miembros agregados aquí podrán cambiar entre empresas del grupo al iniciar sesión

### Tab 3: Plan
- Panel de estado actual: plan, uso de empresas, precio, fecha de vencimiento
- Alerta roja si el plan ha vencido
- Formulario de edición: cambiar plan (con auto-ajuste de max_tenants), precio, fecha de vencimiento, notas
- Botón "Guardar plan"

### Tab 4: WhatsApp
- Toggle activar/desactivar WA compartido
- Campo nombre de instancia Baileys (visible solo si está activo)
- Info explicativa de cómo funciona
- Botón "Guardar configuración de WhatsApp"

---

## API functions (organizations.ts)

```typescript
getOrganizations()                              // GET /organizations
getOrganization(id)                             // GET /organizations/{id}
createOrganization(data: CreateOrgDTO)          // POST /organizations
updateOrganization(id, data)                    // PATCH /organizations/{id}
getOrgPlanInfo(id)                              // GET /organizations/{id}/plan-info
updateOrgPlan(id, data: UpdatePlanDTO)          // PATCH /organizations/{id}/plan
getOrgTenants(id)                               // GET /organizations/{id}/tenants
addTenantToOrg(orgId, tenantId)                 // POST /organizations/{id}/tenants/{tid}
removeTenantFromOrg(orgId, tenantId)            // DELETE /organizations/{id}/tenants/{tid}
getOrgMembers(id)                               // GET /organizations/{id}/members
addOrgMember(orgId, data)                       // POST /organizations/{id}/members
removeOrgMember(orgId, memberId)                // DELETE /organizations/{id}/members/{mid}
updateOrgWhatsApp(orgId, data)                  // PATCH /organizations/{id}/whatsapp
```

---

## Tests (14/14 ✅)

| Test | Descripción |
|---|---|
| T01 | Login superadmin desde panel admin |
| T02 | Panel admin accesible HTTP 200 |
| T03 | GET /organizations retorna lista |
| T04 | Crear org desde panel (verifica en BD) |
| T05 | GET /organizations/{id} retorna detalle |
| T06 | Agregar tenant al grupo |
| T07 | Listar tenants del grupo |
| T08 | Agregar miembro al grupo |
| T09 | Listar miembros |
| T10 | Actualizar plan (duo → multi) |
| T11 | Plan-info completo |
| T12 | Activar WA compartido |
| T13 | Desactivar organización |
| T14 | Reactivar organización |

Todos los datos creados en los tests se verificaron en la BD PostgreSQL de producción (real, no mocks).
