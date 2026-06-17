# 17 — Deuda Técnica y Plan de Mejoras

> Documento de diagnóstico y hoja de ruta para mejorar la calidad,
> seguridad y mantenibilidad del proyecto.
> **Creado:** 2026-03-03

---

## Índice

1. [Prioridad 1 — Urgente (riesgo real en producción)](#prioridad-1)
2. [Prioridad 2 — Deuda técnica (frena el desarrollo)](#prioridad-2)
3. [Prioridad 3 — Mejoras de calidad de vida](#prioridad-3)
4. [Roadmap sugerido](#roadmap)
5. [Qué NO tocar](#no-tocar)

---

## Prioridad 1 — Urgente (riesgo real en producción) {#prioridad-1}

### 1.1 ~~Partir los archivos gigantes del frontend~~ ✅ RESUELTO

> **Actualización 2026-03-09:** Los archivos fueron verificados y sus tamaños
> reales están dentro de rangos aceptables. Las estimaciones originales eran
> incorrectas. No se requiere partición urgente.

| Archivo | Estimación original | Tamaño real | Estado |
|---------|-------------------|-------------|--------|
| `SalesHistory.jsx` | ~42.000 | **704** | ✅ OK |
| `Products.jsx` | ~27.000 | **452** | ✅ OK |
| `Dashboard.jsx` | ~23.000 | **484** | ✅ OK |
| `CashHistory.jsx` | ~28.000 | **472** | ✅ OK |
| `Suppliers.jsx` | ~26.000 | **515** | ✅ OK |

**Regla vigente:** ningún archivo de página debe superar las 400 líneas.
Algunos archivos están ligeramente por encima pero no requieren acción urgente.

---

### 1.2 Organizar los commits pendientes

Hay más de 25 archivos modificados en la rama `feature/barbershop-module`
sin separación lógica. Deben organizarse en commits atómicos antes de
hacer merge a `main`.

**Secuencia propuesta:**

```bash
# Commit 1: Módulo restaurante — backend
git add ferreteria_refactor/backend_api/routers/modules/restaurant/orders.py
git add ferreteria_refactor/backend_api/services/sales_service.py

# Commit 2: Módulo restaurante — frontend
git add ferreteria_refactor/frontend_web/src/pages/Restaurant/
git add ferreteria_refactor/frontend_web/src/pages/Mobile/

# Commit 3: Módulo barbería — migración y backend
git add ferreteria_refactor/backend_api/migrate_barbershop.py
git add ferreteria_refactor/alembic/versions/

# Commit 4: Reparación de schemas y migraciones
git add ferreteria_refactor/alembic/versions/e2f1a9b2d3c4_repair_tenant_columns.py

# Commit 5: Correcciones generales de backend
git add ferreteria_refactor/backend_api/main.py
git add ferreteria_refactor/backend_api/routers/auth.py
git add ferreteria_refactor/backend_api/services/tenant_service.py
git add ferreteria_refactor/backend_api/database/db.py

# Commit 6: Documentación
git add ferreteria_refactor/_CEREBRO_PROYECTO/
```

---

### 1.3 Corregir el Sidebar hardcodeado por entorno

El Sidebar actualmente fuerza la visibilidad de módulos en localhost,
lo que puede causar que en producción los módulos aparezcan o
desaparezcan de forma inesperada si el flag no está configurado.

**Archivo:** `frontend_web/src/components/layout/Sidebar.jsx`

```jsx
// ❌ Actualmente (frágil y peligroso)
const showRestaurant = isLocal || modules.has_restaurant_module;

// ✅ Correcto: siempre respetar el flag del backend
const showRestaurant = modules.has_restaurant_module;
```

La solución correcta es que en `desarrollo`, el `ConfigContext` devuelva
todos los módulos activos si `ENVIRONMENT=development` (configurado en
`.env.development`), no hardcodear la URL.

---

### 1.4 Rate limiting en endpoints públicos — PARCIALMENTE RESUELTO ⚠️

> **Actualización 2026-03-10:** `slowapi` ya está instalado e integrado.
> Se añadió `@limiter.limit("5/minute")` al endpoint `POST /pin-login`
> en `routers/users.py`. Los endpoints `/auth/login` y `/public/register`
> ya contaban con rate limiting previo.
>
> **Pendiente:** verificar cobertura en `/auth/discovery` y otros endpoints
> públicos. La infraestructura (`slowapi`, `Limiter`, handler de error) ya
> está lista — solo falta aplicar el decorador en los endpoints que falten.

~~Los endpoints `/public/register` y `/auth/discovery` no tienen límite
de peticiones. Son un vector de abuso: enumeración de tenants,
spam de registros, ataques de fuerza bruta.~~

**Dependencia:** `slowapi` — ya integrada en el proyecto.

```python
# Pendiente: revisar estos endpoints
@router.post("/auth/discovery")
@limiter.limit("20/minute")   # ← confirmar si ya tiene limite
async def discovery(request: Request, ...):
    ...
```

---

## Prioridad 2 — Deuda técnica (frena el desarrollo) {#prioridad-2}

### 2.1 Partir los routers gordos del backend

La lógica de negocio vive en los routers cuando debería estar en services.

| Router | Líneas | Acción |
|--------|--------|--------|
| `reports.py` | ~2.000 | Partir en sub-routers por dominio |
| `cash.py` | ~855 | Separar sesiones / movimientos / reportes |
| `products.py` | ~1.177 | Extraer lógica a `InventoryService` |
| `admin.py` | ~1.000 | Separar por responsabilidad |

**Estructura propuesta para `cash.py`:**

```
routers/cash/
├── __init__.py
├── sessions.py     ← apertura y cierre de caja
├── movements.py    ← ingresos, egresos, adelantos
└── reports.py      ← cierre Z, resumen de caja
```

**Estructura propuesta para `reports.py`:**

```
routers/reports/
├── __init__.py
├── sales_report.py
├── inventory_report.py
├── cash_report.py
└── commissions_report.py
```

---

### 2.2 Tests para operaciones críticas

La carpeta `tests/` existe pero no hay cobertura real en operaciones
financieras. Para un sistema que maneja ventas, caja y crédito, los
errores silenciosos son inaceptables.

**Tests mínimos a implementar (en orden de impacto):**

```python
# tests/test_sales.py
def test_venta_descuenta_stock_correctamente()
def test_venta_con_credito_respeta_limite_del_cliente()
def test_venta_duplicada_es_idempotente()        # por unique_uuid
def test_calculo_de_cambio_multimoneda()
def test_venta_combo_descuenta_ingredientes()    # escandallo

# tests/test_cash.py
def test_no_puede_abrir_caja_si_ya_hay_una_abierta()
def test_cierre_de_caja_calcula_totales_correctamente()
def test_movimiento_no_permitido_con_caja_cerrada()

# tests/test_tenant_isolation.py
def test_usuario_no_puede_ver_data_de_otro_tenant()
def test_nuevo_tenant_tiene_su_propio_schema_postgresql()
def test_migracion_propaga_a_todos_los_schemas()

# tests/test_restaurant.py
def test_orden_en_mesa_bloquea_la_mesa()
def test_checkout_libera_la_mesa()
def test_escandallo_descuenta_ingredientes_al_vender()
```

---

### ~~2.3 Script de healthcheck en deployment~~ ⚠️ PARCIALMENTE RESUELTO

> **Actualización 2026-03-10:** Se añadieron healthchecks Docker nativos
> (`python urllib` a `/api/v1/health`) en el Dockerfile del backend.
> Además, `deploy_images.sh` incluye un pytest pre-flight gate opcional
> que detiene el deploy si los tests fallan.
>
> **Pendiente:** Script bash standalone para verificación post-deploy más
> completa (BD, migraciones, schemas de tenants).

---

## Prioridad 3 — Mejoras de calidad de vida {#prioridad-3}

### 3.1 Hook `useApi` para eliminar código repetido en el frontend

En casi todas las páginas hay el mismo patrón:
`useState(null)` + `useState(true)` (loading) + `useState(null)` (error)
+ `useEffect` con try/catch. Es código repetido en ~60 páginas.

**Archivo a crear:** `frontend_web/src/hooks/useApi.js`

```javascript
import { useState, useEffect, useCallback } from 'react';

export function useApi(fetchFn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      setData(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => { execute(); }, [execute]);

  return { data, loading, error, refetch: execute };
}

// Uso en cualquier página:
const { data: sales, loading, refetch } = useApi(
  () => salesService.getAll(filters),
  [filters]
);
```

---

### 3.2 Centralizar constantes de estado

Los strings de estado están duplicados en múltiples archivos. Si cambia
uno, hay que buscarlo manualmente en todo el proyecto.

**Archivo a crear:** `frontend_web/src/constants/statuses.js`

```javascript
export const ORDER_ITEM_STATUS = {
  PENDING:    'PENDING',
  SENT:       'SENT',
  PREPARING:  'PREPARING',
  READY:      'READY',
  SERVED:     'SERVED',
};

export const TABLE_STATUS = {
  AVAILABLE:  'AVAILABLE',
  OCCUPIED:   'OCCUPIED',
  RESERVED:   'RESERVED',
  CLEANING:   'CLEANING',
};

export const CASH_SESSION_STATUS = {
  OPEN:   'OPEN',
  CLOSED: 'CLOSED',
};

export const SALE_SYNC_STATUS = {
  SYNCED:  'SYNCED',
  PENDING: 'PENDING',
};

export const USER_ROLES = {
  ADMIN:     'ADMIN',
  CASHIER:   'CASHIER',
  WAREHOUSE: 'WAREHOUSE',
  WAITER:    'WAITER',
  KITCHEN:   'KITCHEN',
};
```

---

### 3.3 Variables de entorno para módulos en desarrollo

En lugar de hardcodear `isLocal` en el Sidebar, usar variables de entorno
de Vite para controlar qué módulos están activos en desarrollo.

**Archivo:** `frontend_web/.env.development`

```env
VITE_FORCE_ALL_MODULES=true
```

**Uso en `ConfigContext.jsx`:**

```javascript
const forceAll = import.meta.env.VITE_FORCE_ALL_MODULES === 'true';

const modules = {
  has_restaurant_module: forceAll || serverConfig.has_restaurant_module,
  has_barbershop_module: forceAll || serverConfig.has_barbershop_module,
  has_laundry_module:    forceAll || serverConfig.has_laundry_module,
  has_services_module:   forceAll || serverConfig.has_services_module,
};
```

---

## Roadmap Sugerido {#roadmap}

```
Semana 1   → 1.2 Commits limpios de la rama actual
             1.3 Fix del Sidebar hardcodeado
             3.3 Variables de entorno para módulos

Semana 2   → 1.4 ⚠️ PARCIAL (2026-03-10) — /pin-login protegido;
                  pendiente revisar /auth/discovery y otros endpoints
             3.2 Centralizar constantes de estado

Semana 3-4 → 1.1 ✅ RESUELTO — archivos ya tienen tamaños aceptables
             (disponible para otras tareas)

Semana 5-6 → 2.1 Partir cash.py y reports.py en el backend
             3.1 Hook useApi en el frontend

Semana 7-8 → 2.2 Tests críticos (ventas, caja, aislamiento)
             2.3 Script de healthcheck

Semana 9+  → Continuar extrayendo lógica de routers a services
```

### Resueltos en fix/critical-security-multiagent (2026-03-10)

Los siguientes puntos de deuda técnica fueron abordados en esta rama (35+ fixes, 15 commits):

| # | Descripción | Estado |
|---|-------------|--------|
| 1.4 | Rate limiting `/pin-login` | ⚠️ Parcial (pendiente `/auth/discovery`) |
| 2.3 | Healthcheck en deployment | ⚠️ Parcial (Docker healthcheck + pytest gate, falta script standalone) |
| — | N+1 en `get_registers_status` (cash.py) | ✅ Resuelto |
| — | `console.log` en build de producción | ✅ Resuelto (vite.config.js esbuild.drop) |
| — | Exception handler expone internos | ✅ Resuelto |
| — | Endpoint `/debug/routes` sin auth | ✅ Resuelto |
| — | CORS permisivo en producción | ✅ Resuelto |
| — | Pool de conexiones insuficiente | ✅ Resuelto (80+50) |
| — | Reset `search_path` no transaccional | ✅ Resuelto (rollback + close en finally) |
| — | Índices FK faltantes en BD | ✅ Resuelto (14 índices en 2 migraciones) |
| — | Re-renders innecesarios en CartContext | ✅ Resuelto (useMemo) |
| — | `alert()` en frontend (37 calls) | ✅ Migrado a `toast()` |
| — | `console.log` debug (17 calls) | ✅ Removidos |
| — | React.lazy en 58 páginas | ✅ Bundle ~60% menor |
| — | ErrorBoundary para lazy routes | ✅ LazyErrorBoundary |
| — | Paginación server-side (products, customers) | ✅ skip/limit max 500 |
| — | Cloudflare token hardcoded | ✅ Externalizado a env var |
| — | Docker non-root user | ✅ appuser |
| — | Versiones Docker no pinneadas | ✅ 30 Python + 8 base images |
| — | nginx sin security headers | ✅ 4 headers añadidos |
| — | Docker sin resource limits | ✅ Limits configurados |
| — | CORS regex sub-subdominios | ✅ Multi-nivel soportado |
| — | TZ UTC en contenedores | ✅ America/Caracas |

### Pendientes post-auditoría
| Prioridad | Descripción |
|-----------|-------------|
| ALTA | Rotar token Cloudflare (estuvo en git history) |
| ALTA | Rotar `private_key.pem` (JWT signing key estuvo en repo) |
| ALTA | Aplicar migraciones a Producción (ver `05_Guia_Despliegue.md` sección 7.B) |
| MEDIA | CI/CD pipeline (deploys son manuales, pytest gate local como alternativa) |
| BAJA | Rate limiting en `/auth/discovery` y otros endpoints públicos |

---

## Auditoría de Calidad y Estructura — 2026-03-19 {#auditoria-2026-03-19}

> Diagnóstico completo realizado por agentes especializados. Fecha: 2026-03-19.

### 🔴 SEGURIDAD — Fixes P0 (Críticos, rápidos)

| # | Problema | Archivo | Esfuerzo |
|---|----------|---------|---------|
| S1 | Token hardcodeado `DEBUG_BYPASS_TOKEN_xyz` permite bypass de auth en WebSocket | `routers/websocket.py:63` | 5 min |
| S2 | `/support/tickets/public-contact` sin rate limit → spam ilimitado | `routers/support_client.py` | 10 min |
| S3 | Archivo `.env` con credenciales de BD commiteado al repo | `backend_api/.env` | Rotar + gitignore |
| S4 | JWT dura 8 horas sin revocación posible (token robado válido por 8h) | `routers/auth.py` | Media |
| S5 | Solo 10 de 337 endpoints tienen rate limit | Varios routers | Alta |

---

### 🔴 BACKEND — Archivos Muertos (Eliminar)

| Archivo | Líneas | Motivo |
|---------|--------|--------|
| `routers/cash_legacy.py` | 1,099 | No importado en main.py, reemplazado por `routers/cash/` |
| `routers/reports_legacy.py` | 2,027 | No importado en main.py, reemplazado por `routers/reports/` |
| `models/prueba.py` | 20 | Tabla de prueba de Alembic, innecesaria |
| `models/notas.py` | 16 | Migración de prueba, innecesaria |
| `models/prueba_vps.py` | 31 | Testing en VPS, innecesaria |
| `models/warehouse_models.py` | 33 | Duplicado de clases ya en models.py, comentado en __init__ |

> **Total a eliminar: ~3,226 líneas de código muerto.**

---

### 🔴 BACKEND — Monolitos a Dividir

| Archivo | Líneas | Acción |
|---------|--------|--------|
| `models/models.py` | 1,226 (58 clases) | Dividir en: `sales.py`, `cash.py`, `inventory.py`, `purchases.py`, `returns.py` |
| `schemas/__init__.py` | 1,354 (143 clases) | Mover definiciones a archivos separados; `__init__.py` solo re-exports |
| `main.py` | 705 | Extraer `LoggingMiddleware` → `middleware/`, `repair_public_schema()` → `database/migrations.py` |
| `dependencies.py` | 245 | Dividir en `utils/auth.py` + `utils/permissions.py` |

---

### 🔴 BASE DE DATOS — Integridad Referencial

| Problema | Detalle | Riesgo |
|----------|---------|--------|
| 68 de 71 FK sin `ondelete="CASCADE"` | Categories, Products, CashSession, Sale, etc. | Borrar un padre deja hijos huérfanos |
| 29 modelos sin `created_at`/`updated_at` | Sale, Customer, CashSession, Kardex, etc. | Auditoría imposible |
| 10 scripts `migrate_*.py` fuera de Alembic | Raíz del proyecto | Sin control de versión, sin rollback |

---

### 🟡 FRONTEND — Duplicación y Complejidad

| Problema | Archivos | Acción |
|----------|---------|--------|
| Código idéntico duplicado | `Reports/tabs/CreditsTab.jsx` (1,407) y `Sales/tabs/CreditosTab.jsx` (1,383) | Consolidar en uno solo |
| Patrón CRUD repetido 8+ veces | CustomerManager, UsersManager, ServiceManager, etc. | Extraer hook `useCRUDManager()` |
| 743 API calls directas en páginas (vs 112 en servicios) | Múltiples páginas | Mover a servicios |
| CartContext sobrecargado (456 líneas) | `context/CartContext.jsx` | Dividir: Cart + Descuentos + ExchangeRate |
| 184 archivos JSX, 0 TypeScript | Todo el frontend | Migración gradual a TSX (largo plazo) |
| `POS.jsx` con 96 `useState` y 13 modales | `pages/POS.jsx` | Refactorizar en sub-componentes |

---

### Prioridad de ejecución sugerida

```
Fase 1 (rápido, alto impacto):
  → S1: ✅ HECHO — Eliminar DEBUG_BYPASS_TOKEN (commit 4b6b93a, 2026-03-19)
  → S2: Rate limit en public-contact
  → S3: Rotar credenciales .env
  → S4: PENDIENTE — Migración re-hashear 6 PINs en texto plano (ver abajo)
  → Eliminar 5 archivos muertos del backend (~3,200 líneas)

Fase 2 (medio plazo):
  → Dividir models.py en submódulos
  → Dividir schemas/__init__.py
  → Consolidar CreditsTab/CreditosTab duplicados
  → Agregar CASCADE a FK principales

Fase 3 (largo plazo):
  → Migrar scripts migrate_*.py a Alembic
  → Agregar timestamps a 29 modelos sin auditoría
  → Hook useCRUDManager para Managers del frontend
  → Migración gradual JSX → TypeScript
```

---

### Hallazgos adicionales — Tests automatizados 2026-03-19

> Descubiertos al correr el suite de 45 tests contra BD de producción real.
> Ver `18_Sistema_de_Tests.md` para el catálogo completo.

#### 🔴 PINs en texto plano (seguridad — ACCIÓN REQUERIDA)

6 usuarios tienen el campo `pin` almacenado como texto plano en `public.users`.
Un hash bcrypt tiene ~60 caracteres; estos PINs tienen 4-5 caracteres, confirma que no fueron hasheados.

**Usuarios afectados:**
| Email | PIN (texto plano) | Tenant |
|-------|-------------------|--------|
| `rodriguezisaac876@gmail.com` | `0000` | Superadmin (global) |
| `maikergimenez@gmail.com` | `1770` | `emprendimientomaikergimenez` |
| `maikergimenez1986@gmail.com` | `1770` | `emprendimientomaikergimenez` |
| `lavanderialecheria@gmail.com` | `8899` | `la-lavanderia-lecheria` |
| `parramartinezj16@gmail.com` | `1234` | `moto-repuesto-el-negro` |
| `comercialasiatico@gmail.com` | `12345` | `comercialasiatico` |

**Impacto doble:**
1. Los PINs son legibles directamente en la BD (riesgo si alguien accede a la BD)
2. El endpoint `POST /auth/validate-pin` **falla** para estos usuarios porque `passlib.verify()` no puede comparar un hash bcrypt con texto plano → estos usuarios no pueden usar PIN

**Migración a aplicar** (ver `20_Migraciones_SQL_Pendientes.md`):
```python
# Generar hashes bcrypt para los PINs actuales y actualizar
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Luego UPDATE public.users SET pin = hash WHERE email = ...
```

#### 🟡 Admins de tenant con is_superuser=TRUE (diseño)

6 usuarios de tenant tienen `is_superuser=TRUE`. Esto ocurrió al crear esos tenants cuando el flag se asignaba incorrectamente. No rompe nada hoy, pero es confuso: `is_superuser` debería ser solo para admins globales (tenant_id=NULL).

**Tenants afectados:** `inversionesmis4tesoro`, `farmaciasanjose`, `la-lavanderia-lecheria`, `moto-repuesto-el-negro`, `lavado-automoto-y-accesorios-el-progresito`, `prueba2020`

**Acción:** En `TenantService.seed_tenant_admin()`, cambiar `is_superuser=True` a `is_superuser=False` para usuarios de tenant. Los superusers reales se crean separado.

#### 🟡 Ventas históricas sin sale_payments (datos)

4 tenants tienen ventas `is_credit=FALSE, paid=TRUE` sin ningún registro en `sale_payments`. La tabla `sale_payments` fue creada después de que esos tenants ya operaban. No hay acción urgente — las ventas ya ocurrieron.

---

## Qué NO tocar {#no-tocar}

Estas partes del sistema están bien diseñadas y no requieren cambios:

- **Arquitectura multi-tenant** — esquemas PostgreSQL por tenant es la
  decisión correcta
- **Sistema de feature flags** — `has_*_module` en el modelo Tenant
  funciona bien
- **Windows Bridge** — resuelve el problema de impresoras de forma
  elegante y pragmática
- **Flujo de autenticación híbrida** — cookies HttpOnly en web +
  Bearer token en móvil es correcto
- **Alembic con soporte multi-schema** — el hook `include_object` está
  bien implementado
- **WebSocket para hardware** — el protocolo de handshake y los Magic
  Links son sólidos

---

> **Nota:** Este documento debe actualizarse conforme se van resolviendo
> los puntos. Mover los ítems completados al documento
> `10_Registro_Actualizaciones.md`.

---

## Backlog de Features — Sesión 2026-04-01

> Ideas identificadas como mejoras de alto valor. Ordenadas por impacto estimado.

### 🔴 ALTA PRIORIDAD

#### F-01 — Notificaciones y alertas inteligentes
**Problema:** El sistema sabe muchas cosas pero no le avisa a nadie.
**Propuesta:**
- Alerta de stock mínimo al cajero/admin cuando un producto baja del umbral
- Notificación de orden de taller sin movimiento > N días
- Aviso de cambio de tasa BCV
- Recordatorio de comisiones pendientes de pagar
**Stack sugerido:** WebSockets (ya existe), tabla `notifications` en BD, panel de notificaciones en header.

#### F-02 — Integración WhatsApp Business
**Problema:** Tickets, órdenes listas y cotizaciones se envían manualmente copiando y pegando.
**Propuesta:**
- Botón "Enviar ticket por WhatsApp" en POS y Taller
- Notificación automática "Su equipo está listo" al cambiar orden a READY
- Envío de cotizaciones/presupuestos en formato limpio
**Stack sugerido:** Twilio API o Meta Business API, campo `whatsapp` en tabla clientes.

#### F-03 — Dashboard Ejecutivo Mejorado ← EN DESARROLLO
**Problema:** El dashboard actual solo muestra ventas del día sin profundidad analítica.
**Propuesta:** Ver documento de propuesta técnica generado en la sesión.
**Estado:** Propuesta aprobada — pendiente desarrollo.

### 🟡 PRIORIDAD MEDIA

#### F-04 — Presupuestos / Cotizaciones formales
**Problema:** El módulo de Quotes existe pero está muy básico. Los clientes no pueden enviar cotizaciones profesionales.
**Propuesta:** PDF generado desde el sistema, validez configurable, estado (pendiente/aprobado/rechazado), conversión directa a venta.

#### F-05 — Programa de fidelización / Puntos
**Problema:** No hay incentivo para que el cliente vuelva.
**Propuesta:** Cada compra acumula puntos, el cliente puede canjearlos. Especialmente útil para lavanderías, repuestos y negocios frecuentes.
**BD:** Tabla `loyalty_points` por tenant, campo `points_balance` en clientes.

#### F-06 — Módulo Cuentas por Pagar (Proveedores)
**Problema:** El sistema controla lo que le deben los clientes pero no lo que el negocio le debe a proveedores.
**Propuesta:** Registrar facturas de compra, fechas de vencimiento, pagos parciales, alertas de vencimiento.

#### F-07 — Facturación electrónica (SENIAT)
**Problema:** Cuando el SENIAT implemente facturación electrónica obligatoria, los negocios sin sistema estarán en problemas.
**Propuesta:** Anticiparse con el módulo. El sistema ya tiene estructura de impuestos (IVA, IGTF).
**Estado:** Esperar resolución oficial del SENIAT. Diseñar la BD ahora.

#### F-08 — PWA (App instalable en móvil)
**Problema:** El frontend no es instalable en teléfono. Los cajeros no tienen una experiencia "app nativa".
**Propuesta:** Service Worker + manifest.json + modo offline básico para POS. Sin código nativo.

### 🟢 MEJORAS DE CALIDAD

#### F-09 — Búsqueda global Ctrl+K
**Problema:** Para encontrar un producto, cliente u orden hay que navegar al módulo correcto.
**Propuesta:** Buscador flotante accesible desde cualquier pantalla. Busca en productos, clientes, órdenes, ventas simultáneamente.

#### F-10 — Historial del cliente unificado
**Problema:** Las compras POS, órdenes de taller y créditos están en módulos separados sin vista unificada.
**Propuesta:** Vista 360° del cliente: compras, taller, crédito, comisiones (si es empleado), puntos.

#### F-11 — Backups automáticos programados
**Problema:** No hay backup automático visible de la BD de prod.
**Propuesta:** Cron job que haga pg_dump diario y lo suba a Google Drive o S3. Alerta si falla.
**Urgencia:** CRÍTICO para clientes que pierdan datos — implementar pronto.

#### F-12 — Modo offline básico para POS
**Problema:** Si se cae el internet, la caja se paraliza.
**Propuesta:** Service Worker que cachee catálogo y permita registrar ventas offline para sincronizar después.

---

### Tabla de priorización

| ID | Feature | Impacto | Esfuerzo | Prioridad |
|---|---|---|---|---|
| F-03 | Dashboard ejecutivo | Alto | Medio | 🔴 Ahora |
| F-01 | Notificaciones | Alto | Medio | 🔴 Próximo |
| F-02 | WhatsApp | Alto | Alto | 🔴 Próximo |
| F-11 | Backups automáticos | Crítico | Bajo | 🔴 Pronto |
| F-09 | Búsqueda global | Medio | Bajo | 🟡 |
| F-04 | Cotizaciones PDF | Medio | Medio | 🟡 |
| F-08 | PWA offline | Alto | Alto | 🟡 |
| F-05 | Fidelización puntos | Medio | Medio | 🟢 |
| F-06 | Cuentas por pagar | Medio | Alto | 🟢 |
| F-10 | Historial cliente 360 | Medio | Medio | 🟢 |
| F-07 | Facturación SENIAT | Alto | Alto | 🟢 Futuro |
| F-12 | POS offline | Alto | Muy alto | 🟢 Futuro |

---

## 🐛 BUG CRÍTICO — WebSocket: Dos managers separados (detectado 2026-05-21)

### Síntoma
Los broadcasts de eventos en tiempo real (`exchange_rate:updated`, `product:updated`, `sale:completed`, etc.) muestran **"to 0 clients"** en los logs aunque el frontend SÍ está conectado al WebSocket. La UI **nunca se actualiza en tiempo real** sin recargar la página.

### Causa raíz confirmada
Existen **DOS instancias separadas** del ConnectionManager en memoria:

| Archivo | Manager | Firma `broadcast` |
|---|---|---|
| `backend_api/websocket/manager.py` | Manager **VIEJO** — lista simple sin tenant | `broadcast(event_type, data)` ✅ existe |
| `backend_api/services/websocket_manager.py` | Manager **NUEVO** — dict por tenant | `broadcast_to_tenant(msg, tenant_id)` ❌ no tiene `broadcast` simple |

**El problema:**
- El `router/websocket.py` importa desde `services/websocket_manager.py` → los frontends se registran en el manager NUEVO
- `routers/config.py` (y otros routers) importan desde `websocket/manager.py` → los eventos se emiten al manager VIEJO
- El manager VIEJO siempre tiene su lista vacía → "0 clients"

### Archivos afectados
```
backend_api/routers/config.py       → from ..websocket.manager import manager  (VIEJO)
backend_api/routers/products.py     → ¿importa manager? — verificar
backend_api/routers/sales.py        → ¿importa manager? — verificar
backend_api/routers/websocket.py    → from ..services.websocket_manager import manager  (NUEVO)
backend_api/websocket/manager.py    → Manager VIEJO (borrar o unificar)
backend_api/services/websocket_manager.py → Manager NUEVO (conservar)
```

### Fix propuesto
1. **Unificar** en un solo manager: `services/websocket_manager.py` (el NUEVO con tenant)
2. Agregar método `broadcast(event_type, data, tenant_id)` al manager NUEVO
3. Actualizar todos los routers que emiten eventos para que:
   - Importen desde `services/websocket_manager.py`
   - Llamen `manager.broadcast_to_tenant(payload, current_tenant)` en lugar de `manager.broadcast(event_type, data)`
4. Leer el `tenant_id` activo desde `get_tenant_schema()` en cada router
5. Eliminar o deprecar `websocket/manager.py`

### Impacto
- Actualización en tiempo real de tasa de cambio ❌
- Notificación de ventas ❌
- Actualización de stock ❌
- Cualquier evento broadcast al frontend ❌
- El bridge C# (Hardware) NO está afectado — usa `send_to_client` del manager NUEVO directamente

### Estado
- [x] Bug diagnosticado y confirmado en QA y PROD (mismo código)
- [ ] Fix pendiente de implementar en QA
- [ ] Validar en QA
- [ ] Deploy a PROD


---

## 📋 SESIÓN 2026-05-21 — Trabajo completado (pendiente de documentar en 10_Registro_Actualizaciones)

### Inventario yaracall PROD — actualización masiva
Archivo Excel subido con 716 productos. Se ejecutó en PROD directamente:

1. **9 categorías nuevas creadas:**
   BALANZAS, CAMARAS DE SEGURIDAD, DECORACION, ELECTRODOMESTICOS, HOGAR Y COCINA,
   JUGUETES, MEMORIAS Y PENDRIVES, PISTOLAS DE JUGUETE, VIDRIOS TEMPLADOS

2. **Categorías asignadas a los 716 productos** — 0 sin categoría.
   Lógica: nombre del producto → categoría inferida automáticamente
   (forros→FORROS, cable→CABLES, p.c-→PROTECTORES DE CAMARAS, vidrio→VIDRIOS TEMPLADOS, etc.)

3. **Stock actualizado** en `products.stock` y `product_stocks.quantity` (warehouse_id=1)
   para los 716 productos activos del tenant yaracall.

4. **Alerta de stock mínimo = 2** para los 716 productos (`min_stock = 2`)

5. **Nombres en MAYÚSCULAS** — 716 productos actualizados (`UPPER(name)`)

### Excel generado
- Archivo actualizado entregado al cliente con mismo formato, columnas y orden alfabético real (LOWER)
- URL temporal usada: `https://api.miinventariofacil.com/media/inventario_actualizado_temp.xlsx`
- **Pendiente borrar:** `rm /root/deploy/prod/data/media/inventario_actualizado_temp.xlsx`

