# 19 — Tests Funcionales (Integración de Endpoints)

> Análisis y plan de implementación de tests que verifican que el **código** funciona,
> no solo que los datos están bien (eso lo hace `18_Sistema_de_Tests.md`).
> **Creado:** 2026-03-20

---

## Diferencia con los tests de integridad de BD

| | Tests de BD (Cat 1-5) | Tests Funcionales (este doc) |
|---|---|---|
| **Qué verifican** | Estado de los datos en prod | Que el código hace lo que debe |
| **Cómo trabajan** | SQL directo, solo lectura | Llaman endpoints reales, crean datos |
| **Detectan** | Corrupción histórica | Regresiones en código nuevo |
| **Velocidad** | ~1 segundo | ~30-120 segundos |
| **Archivo** | `test_cat1-5_*_pg.py` | `test_func_*_pg.py` (por implementar) |

---

## Cobertura actual (tests existentes)

Los archivos en `backend_api/tests/` ya tienen tests, pero la mayoría usan **SQLite en memoria** con mocks — no PostgreSQL real. Esto significa que no detectan bugs específicos de PostgreSQL (schemas, search_path, índices parciales).

| Archivo | Tipo | BD | Cobertura |
|---------|------|----|-----------|
| `test_auth.py` (37 KB) | Funcional | SQLite mock | Login, tokens, PIN, reset password |
| `test_cash.py` (23 KB) | Funcional | SQLite mock | Movimientos, cierre, balance |
| `test_cash_routers.py` (33 KB) | Funcional | SQLite mock | Operaciones de caja |
| `test_cash_session.py` (16 KB) | Funcional | SQLite mock | Abrir/cerrar sesión |
| `test_credit_limit.py` (19 KB) | Funcional | SQLite mock | Validación de crédito |
| `test_products.py` (20 KB) | Funcional | SQLite mock | CRUD productos, SKU |
| `test_customers.py` (30 KB) | Funcional | SQLite mock | Clientes, deuda |
| `test_sales.py` (18 KB) | Funcional | SQLite mock | Stock, crédito, idempotency |
| `test_reports.py` (39 KB) | Funcional | SQLite mock | Reportes |
| `test_cat1-5_*_pg.py` | Integridad BD | PostgreSQL real | 45 tests, solo lectura |

**Gap principal:** Ningún test funcional usa PostgreSQL real con schemas multi-tenant.

---

## Módulos y endpoints cubiertos por el backend

### Routers registrados en `main.py`

| Módulo | Router | Endpoints aprox. |
|--------|--------|-----------------|
| Autenticación | `auth.py` | 7 endpoints |
| Ventas + Productos | `products.py` | ~25 endpoints |
| Caja | `cash_legacy.py` (1,099 líneas) | ~15 endpoints |
| Inventario | `inventory.py` | 5 endpoints |
| Traslados | `transfers.py` | 6 endpoints |
| Clientes | `customers.py` | 5 endpoints |
| Usuarios | `users.py` | 6 endpoints |
| Compras | `purchases.py` | 4 endpoints |
| Créditos | `credits.py` | 2 endpoints |
| Devoluciones | `returns.py` | 4 endpoints |
| Presupuestos | `quotes.py` | 4 endpoints |
| Configuración | `config.py` (1,018 líneas) | ~10 endpoints |
| Reportes | `reports_legacy.py` (2,027 líneas) | ~8 endpoints |
| Admin SaaS | `admin.py` (1,125 líneas) | ~12 endpoints |
| Farmacia | `pharmacy.py` | ~6 endpoints |
| Servicios técnicos | `services.py` | ~5 endpoints |

**Total estimado:** ~130 endpoints

---

## Flujos críticos por prioridad

### 🔴 PRIORIDAD 1 — Core del negocio (sin esto no hay sistema)

#### F01 — Venta completa con descuento de stock
```
1. Abrir sesión de caja
2. POST /products/sales/ con 2 productos
3. Verificar:
   - ProductStock[warehouse] se redujo en la cantidad vendida
   - Product.stock (caché global) se redujo
   - Kardex tiene entrada tipo SALE con balance_after correcto
   - SaleDetail creado por cada producto
   - sale.total_amount == suma de subtotales
4. Verificar que otro tenant NO ve esta venta
```

#### F02 — Venta con stock insuficiente → debe rechazar
```
1. Producto con stock = 5
2. Intentar vender 10 unidades
3. Verificar: HTTP 400, stock NO se modificó, Kardex sin entrada nueva
```

#### F03 — Cierre de caja con cálculo correcto
```
1. Abrir caja con initial_cash = 100 USD
2. Registrar movimiento DEPOSIT 50 USD
3. Registrar movimiento EXPENSE 20 USD
4. Cerrar caja reportando 130 USD
5. Verificar:
   - final_cash_expected = 100 + 50 - 20 = 130 USD
   - difference = 130 - 130 = 0
   - status = CLOSED, end_time NOT NULL
```

#### F04 — Venta a crédito con límite de crédito
```
1. Cliente con credit_limit = 500 USD, deuda actual = 400 USD
2. Intentar venta a crédito de 200 USD → debe rechazar (400 + 200 > 500)
3. Intentar venta a crédito de 50 USD → debe aprobar
4. Verificar: balance_pending = 50, Sale.is_credit = TRUE
```

#### F05 — No se pueden abrir dos cajas en el mismo registro
```
1. Abrir sesión en caja #1 → OK
2. Intentar abrir segunda sesión en caja #1 → debe rechazar (HTTP 409)
3. Abrir sesión en caja #2 distinta → OK
```

---

### 🟡 PRIORIDAD 2 — Flujos importantes (afectan integridad de datos)

#### F06 — Traslado entre almacenes sincroniza stock
```
1. Almacén A: producto X con 100 unidades
2. Almacén B: producto X con 0 unidades
3. POST /transfers { source: A, target: B, product: X, qty: 30 }
4. Verificar:
   - Almacén A: 70 unidades
   - Almacén B: 30 unidades
   - Product.stock global: sigue en 100 (solo se movió)
   - Kardex: 2 entradas (TRANSFER_OUT en A, TRANSFER_IN en B)
```

#### F07 — Entrada de stock actualiza Kardex
```
1. Producto con stock = 20
2. POST /inventory/add { product_id, warehouse_id, quantity: 50 }
3. Verificar:
   - ProductStock[warehouse] = 70
   - Product.stock = 70
   - Kardex: entrada PURCHASE, balance_after = 70
```

#### F08 — Reset de contraseña usa email (no username)
```
1. Dos usuarios con username='admin' en distintos tenants
2. POST /auth/forgot-password { email: "user@tenant1.com" }
3. Verificar que el JWT generado tiene sub = "user@tenant1.com"
4. POST /auth/reset-password con ese token
5. Verificar que SOLO el usuario con ese email cambió su password
   (el otro 'admin' no se tocó)
```

#### F09 — Venta a crédito con cliente bloqueado → rechaza
```
1. Cliente con is_blocked = TRUE
2. Intentar venta a crédito
3. Verificar: HTTP 400 "Cliente bloqueado"
4. Verificar: la venta NO se creó en BD
```

#### F10 — Atomicidad: si falla un item, no se guarda nada
```
1. Venta con 3 productos: los 2 primeros tienen stock, el 3ro no
2. Intentar crear la venta
3. Verificar: HTTP 400
4. Verificar: stock de los 2 primeros NO se modificó (rollback)
5. Verificar: no hay Sale ni SaleDetails creados
```

---

### 🟢 PRIORIDAD 3 — Edge cases y validaciones

#### F11 — SKU duplicado rechazado al crear producto
```
POST /products/ con SKU ya existente → HTTP 400
```

#### F12 — Venta de servicio no requiere warehouse
```
Producto is_service=True, POST /products/sales/ sin warehouse_id → OK
Stock no cambia, sin Kardex entry de stock
```

#### F13 — Multicaja: ventas van a la sesión correcta
```
2 cajeros con 2 cajas abiertas, cada uno vende
Verificar que sale.session_id apunta a la sesión del cajero correcto
```

#### F14 — Compra actualiza stock en warehouse específico
```
POST /purchases con warehouse_id = bodega_b
Verificar ProductStock[bodega_b] aumentó, ProductStock[bodega_a] intacto
```

#### F15 — Valuación de deuda en Bs con tasas por producto
```
Venta con productos de distintas tasas (BCV vs Paralelo)
GET /credits/sales/{id}/valuation
Verificar breakdown correcto por tasa
```

---

## Arquitectura de los tests funcionales

### Cómo funciona FastAPI TestClient

```python
from fastapi.testclient import TestClient
from backend_api.main import app

client = TestClient(app)

def test_crear_venta(pg_db):
    # 1. Preparar datos en BD real
    # 2. Hacer request HTTP al endpoint
    response = client.post("/api/v1/products/sales/", json={...},
                           headers={"x-tenant-id": "farmaciasanjose"})
    # 3. Verificar respuesta
    assert response.status_code == 200
    # 4. Verificar estado en BD
    venta = pg_db.query(Sale).filter_by(id=response.json()["id"]).first()
    assert venta.total_amount == 100
```

### Diferencia vs tests actuales (SQLite)

Los tests actuales en `test_sales.py` etc. usan SQLite en memoria. Los nuevos usarán:
- **PostgreSQL real** (puerto 5434, misma BD de test)
- **Search path real** por tenant
- **Índices parciales** reales (el unique de caja, por ejemplo)
- **F-strings con schemas** como hace el código de producción

### Fixtures necesarias (a agregar en `conftest.py`)

```python
@pytest.fixture
def test_tenant_setup(pg_engine):
    """
    Crea en la BD de test un set completo:
    - 1 almacén principal
    - 1 caja registradora
    - 3 productos con stock
    - 1 cliente con crédito
    Todo dentro de una transacción que se revierte al final.
    """

@pytest.fixture
def open_session(test_tenant_setup, pg_db):
    """Abre una CashSession y la retorna para los tests de venta."""

@pytest.fixture
def admin_headers():
    """Headers con JWT de admin para autenticar requests."""
```

---

## Estructura de archivos propuesta

```
backend_api/tests/
├── conftest.py                        ← Agregar fixtures funcionales
├── test_func_ventas_pg.py             ← F01, F02, F04, F09, F10, F12, F13
├── test_func_caja_pg.py               ← F03, F05
├── test_func_inventario_pg.py         ← F07, F14
├── test_func_traslados_pg.py          ← F06
├── test_func_auth_pg.py               ← F08
└── test_func_creditos_pg.py           ← F15
```

---

## Cómo integrar al pipeline de deploy

Una vez implementados, agregar al `deploy_images.sh` **después** de los tests de integridad:

```bash
# Tests de integridad BD (actuales, ~1 seg)
python -m pytest backend_api/tests/test_cat1_caja_pg.py \
                  backend_api/tests/test_cat2_ventas_pg.py \
                  ...

# Tests funcionales (nuevos, ~30-60 seg)
python -m pytest backend_api/tests/test_func_ventas_pg.py \
                  backend_api/tests/test_func_caja_pg.py \
                  backend_api/tests/test_func_inventario_pg.py \
                  backend_api/tests/test_func_traslados_pg.py \
                  backend_api/tests/test_func_auth_pg.py \
                  -v --no-cov --tb=short
```

---

## Estado de implementación

| Test | Descripción | Estado |
|------|-------------|--------|
| F01 | Venta completa con stock | ⏳ Pendiente |
| F02 | Venta con stock insuficiente | ⏳ Pendiente |
| F03 | Cierre de caja con cálculo correcto | ⏳ Pendiente |
| F04 | Crédito con límite excedido | ⏳ Pendiente |
| F05 | Doble apertura de caja rechazada | ⏳ Pendiente |
| F06 | Traslado entre almacenes | ⏳ Pendiente |
| F07 | Entrada de stock en Kardex | ⏳ Pendiente |
| F08 | Reset password por email | ⏳ Pendiente |
| F09 | Venta a cliente bloqueado | ⏳ Pendiente |
| F10 | Atomicidad en venta multi-item | ⏳ Pendiente |
| F11 | SKU duplicado rechazado | ⏳ Pendiente |
| F12 | Servicio sin warehouse | ⏳ Pendiente |
| F13 | Multicaja: sesión correcta | ⏳ Pendiente |
| F14 | Compra en warehouse específico | ⏳ Pendiente |
| F15 | Valuación en Bs por tasas | ⏳ Pendiente |
