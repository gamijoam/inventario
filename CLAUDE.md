# CLAUDE.md — Mi Inventario Fácil / Invensoft
> Guía de contexto rápido. Para detalle profundo: `ferreteria_refactor/_CEREBRO_PROYECTO/`

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Backend | FastAPI + Python 3.12, PostgreSQL 15+ (sin SQLite) |
| Frontend | React 18 + Vite + Tailwind CSS, Context API, react-hot-toast, Lucide React |
| SaaS Admin | React + Vite (TypeScript) en `saas_admin/` |
| Hardware Bridge | C# .NET WPF + WebSocket ESC/POS |
| Deploy | Docker Compose + Traefik en VPS 212.28.176.157 |
| Router React | **HashRouter** — rutas con `/#/` |

---

## Estructura de Carpetas Clave

```
inventario/
├── ferreteria_refactor/
│   ├── backend_api/           FastAPI principal
│   │   ├── main.py            Punto de entrada + startup
│   │   ├── scheduler.py       APScheduler (expire tenants, expiry warnings, auto_backup)
│   │   ├── models/models.py   Todos los modelos SQLAlchemy
│   │   ├── routers/           Un archivo por dominio (products, sales, credits, admin…)
│   │   ├── services/          Lógica de negocio pesada
│   │   ├── middleware/        TenantMiddleware (detección por subdominio/header)
│   │   └── utils/time_utils.py  → get_venezuela_now() para fechas (no datetime.now())
│   ├── frontend_web/src/
│   │   ├── pages/             Una carpeta por módulo
│   │   ├── components/        Componentes reutilizables
│   │   ├── context/           AuthContext, CartContext, ConfigContext, WebSocketContext
│   │   ├── config/axios.js    Cliente HTTP base (inyecta X-Tenant-ID)
│   │   └── config/constants.js
│   ├── saas_admin/src/        Panel superadmin (TypeScript)
│   ├── _CEREBRO_PROYECTO/     Documentación detallada (ver índice abajo)
│   └── alembic/               Migraciones BD
├── docker-compose.prod.yml    Deploy producción
├── docker-compose.qa.yml      Deploy QA
└── deploy_images.sh           Build + push DockerHub + VPS pull + restart
```

---

## Multi-Tenancy (CRÍTICO)

- Cada empresa tiene su propio **schema PostgreSQL** (ej: `oscarcell`, `lalicoreria`)
- Schema `public` = datos globales (tenants, users, audit_logs)
- El middleware detecta el tenant por: **1) Header `X-Tenant-ID`** → **2) Subdominio**
- La sesión de BD hace `SET search_path TO "{schema}", public` automáticamente
- **NUNCA** hardcodear `schema_name` ni `tenant_id` en queries — el ORM lo resuelve solo
- `audit_logs` vive en `public` (global para todos los tenants)

---

## RBAC — Roles

| Rol | Acceso |
|-----|--------|
| `ADMIN` | Todo |
| `CASHIER` | POS, Ventas, Clientes, Cotizaciones, Caja, Servicios, Lavandería, Barbería, Farmacia (recetas) |
| `WAREHOUSE` | Inventario, Compras, Proveedores, Farmacia (lotes) |
| `superuser` | Solo panel SaaS admin (is_superuser=True en public.users) |

Frontend: `useAuth()` → `hasRole()`, `ProtectedRoute`, `RoleGuard`
Backend: `Depends(admin_only)`, `Depends(cashier_or_admin)`, `Depends(get_current_superuser)`

---

## Módulos de Negocio (Feature Flags en Tenant)

| Flag | Módulo |
|------|--------|
| `has_services_module` | Taller / Servicio Técnico |
| `has_laundry_module` | Lavandería |
| `has_restaurant_module` | Restaurante |
| `has_barbershop_module` | Barbería |
| `has_pharmacy_module` | Farmacia |
| `has_hardware_module` | Bridge impresoras (default ON) |

Frontend usa `effectiveModules` del `ConfigContext` para mostrar/ocultar secciones.

---

## Gotchas Técnicos Importantes

```python
# ❌ MAL — usa UTC
datetime.now()
date.today()

# ✅ BIEN — usa Venezuela (UTC-4)
from .utils.time_utils import get_venezuela_now
get_venezuela_now()
get_venezuela_now().date()
```

```python
# slowapi: el parámetro Request DEBE llamarse exactamente 'request'
@router.post("/login")
async def login(request: Request, ...):  # ✅
async def login(http_request: Request, ...):  # ❌ slowapi no lo detecta
```

```python
# Reset password: JWT sub = user.email (NO username)
# Razón: múltiples usuarios pueden tener username='admin' (uno por tenant)
```

```python
# business_config: hacer db.flush() ANTES de commit
# Razón: search_path se pierde después del commit en ciertos flujos
db.flush()
db.commit()
```

```python
# Email SMTP Namecheap: requiere ehlo() antes Y después de starttls()
smtp.ehlo()
smtp.starttls()
smtp.ehlo()  # ← obligatorio de nuevo
```

```javascript
// VITE_API_URL se bake en build time — no cambia en runtime sin rebuild
// HashRouter: todas las rutas tienen /#/ como prefijo
// Lazy loading: 58 páginas con React.lazy(), Login y Dashboard son eager
```

---

## Multimoneda POS

- USD = moneda ancla. Tasas en `exchange_rates` (BCV scraping)
- IGTF 3% automático en pagos USD (Venezuela)
- `totalsByCurrency` en CartContext usa `currency_code` como key (`'VES'`, `'COP'`, `'USD'`)
- Tasa efectiva Bs = `totalsByCurrency.VES / totalUSD` (ponderada del carrito)
- Backend valida tasas con tolerancia ±15% — rechaza tasas manipuladas del frontend

---

## Sistema de Licencias

- `license_type`: `trial | monthly | annual | lifetime`
- Trial por defecto: 2 días (`LICENSE_TRIAL_DAYS_DEFAULT`)
- Scheduler expira a las **00:05 UTC** con 5 días de gracia
- Scheduler avisa por email a las **09:00 UTC** cuando quedan ≤7 días
- Backup automático a las **05:00 UTC (01:00 AM Venezuela)**, conserva últimos 7
- Bloqueo: `is_active=False` + `license_blocked_reason="expired"`

---

## VPS Deploy

```
SSH: root@212.28.176.157 (pass en MEMORY.md)
Prod: /root/deploy/prod/   QA: /root/deploy/qa/
Contenedores prod: backend_prod_server, db_prod_server, frontend_prod_server, admin_panel_prod_server
Contenedores QA:   backend_qa_server, db_qa_server, frontend_qa_server, admin_panel_qa
Backups persistentes: /root/deploy/prod/backups/  (bind mount → /app/backups en container)
```

**Deploy:** `./deploy_images.sh` → build → push DockerHub → VPS pull + restart
**NUNCA** hacer deploy sin aprobación explícita del usuario.

---

## Convenciones de Código

- **No** agregar `docstrings`, comentarios ni `type annotations` a código no modificado
- **No** crear helpers/abstracciones para uso único
- **No** manejar errores de escenarios imposibles — confiar en garantías del framework
- Validar solo en fronteras del sistema (input usuario, APIs externas)
- Preferir editar archivo existente antes de crear uno nuevo
- Tests en `backend_api/tests/` con prefijo `test_func_` o `test_`

---

## Índice del Cerebro (`_CEREBRO_PROYECTO/`)

| Archivo | Cuándo leerlo |
|---------|--------------|
| `01_Arquitectura.md` | Flujo de peticiones, WebSockets, middleware |
| `02_Base_De_Datos.md` | Modelos, índices, provisioning de tenant |
| `04_Modulos_Negocio.md` | Reglas de cada módulo (restaurante, barbería, etc.) |
| `05_Guia_Despliegue.md` | Docker, Traefik, rollback, variables de entorno |
| `08_Seguridad_y_Auditoria.md` | RBAC, AuditLog, hardening, CORS |
| `12_Manual_de_Desarrollo_Local.md` | Setup local, multi-tenancy en localhost |
| `15_Modulo_Barberia.md` | Detalle módulo barbería |
| `16_Modulo_Restaurante.md` | Detalle módulo restaurante |
| `17_Deuda_Tecnica_y_Plan_de_Mejoras.md` | Qué NO tocar, deuda técnica pendiente |
| `19_Sistema_Licencias.md` | Planes, trial, scheduler de expiración |
| `20_Migraciones_SQL_Pendientes.md` | Alembic, migraciones pendientes |
| `24_Auditoria_Integral_2026-03-25.md` | Auditoría completa: seguridad, backend, frontend, DevOps, negocio |
