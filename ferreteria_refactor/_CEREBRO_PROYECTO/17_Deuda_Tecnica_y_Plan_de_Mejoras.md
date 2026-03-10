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

### 2.3 Script de healthcheck en deployment

No hay verificación automática de que el sistema arrancó correctamente.
Un deployment fallido puede pasar desapercibido.

**Archivo a crear:** `scripts/healthcheck.sh`

```bash
#!/bin/bash
set -e

echo "[1/4] Verificando API..."
curl -sf http://localhost:8000/health > /dev/null || {
  echo "ERROR: API no responde"; exit 1;
}

echo "[2/4] Verificando conexión a base de datos..."
python -c "
from ferreteria_refactor.backend_api.database.db import engine
with engine.connect() as conn:
    conn.execute('SELECT 1')
print('DB OK')
" || { echo "ERROR: BD no accesible"; exit 1; }

echo "[3/4] Verificando migraciones..."
alembic current 2>&1 | grep "(head)" || {
  echo "ERROR: Migraciones pendientes"; exit 1;
}

echo "[4/4] Verificando schemas de tenants..."
python -c "
from ferreteria_refactor.backend_api.database.db import engine
with engine.connect() as conn:
    result = conn.execute(\"SELECT count(*) FROM public.tenants WHERE is_active = true\")
    count = result.scalar()
    print(f'Tenants activos: {count}')
"

echo ""
echo "Sistema OK - $(date)"
```

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

Los siguientes puntos de deuda técnica fueron abordados en esta rama:

| # | Descripción | Estado |
|---|-------------|--------|
| 1.4 | Rate limiting `/pin-login` | ⚠️ Parcial |
| — | N+1 en `get_registers_status` (cash.py) | ✅ Resuelto |
| — | `console.log` en build de producción | ✅ Resuelto (vite.config.js esbuild.drop) |
| — | Exception handler expone internos | ✅ Resuelto |
| — | Endpoint `/debug/routes` sin auth | ✅ Resuelto |
| — | CORS permisivo en producción | ✅ Resuelto |
| — | Pool de conexiones insuficiente | ✅ Resuelto |
| — | Reset `search_path` no transaccional | ✅ Resuelto |
| — | Índices FK faltantes en BD | ✅ Resuelto (migración a1b2c3d4e5f6) |
| — | Re-renders innecesarios en CartContext | ✅ Resuelto (useMemo) |

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
