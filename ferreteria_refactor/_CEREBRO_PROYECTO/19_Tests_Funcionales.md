# 19 — Tests Funcionales (Integración contra PostgreSQL real)

> Documentación completa del sistema de tests funcionales: qué verifica cada módulo,
> por qué importa, cómo está implementado, y qué flujos están pendientes.
> **Creado:** 2026-03-20 | **Última actualización:** 2026-03-20

---

## Índice

1. [Diferencia con tests de integridad BD](#diferencia)
2. [Arquitectura de los tests funcionales](#arquitectura)
3. [Estado de implementación](#estado)
4. [Plan completo por módulo](#plan)
5. [Nota técnica: service rollback](#rollback)
6. [Pipeline de deploy](#pipeline)

---

## 1. Diferencia con tests de integridad BD {#diferencia}

| | Tests de BD (Cat 1-5) | Tests Funcionales (func_*) |
|---|---|---|
| **Qué verifican** | Estado de los datos en prod | Que el código hace lo que debe |
| **Cómo trabajan** | SQL directo, solo lectura | ORM real, crean y modifican datos |
| **Detectan** | Corrupción histórica | Regresiones en código nuevo |
| **Aislamiento** | Read-only, no modifica | Transacción que se revierte al final |
| **Velocidad** | ~1 segundo | ~2-3 segundos |
| **Archivo** | `test_cat1-5_*_pg.py` | `test_func_*_pg.py` |

### Cobertura previa (tests con SQLite mock — NO cuentan)

Los archivos `test_auth.py`, `test_cash.py`, `test_sales.py`, etc. usan SQLite en memoria.
No detectan bugs específicos de PostgreSQL: schemas multi-tenant, search_path, índices parciales, Numeric precision, ENUMs nativos.

---

## 2. Arquitectura de los tests funcionales {#arquitectura}

### Fixtures disponibles (conftest.py)

```python
pg_engine          # SQLAlchemy engine → PostgreSQL 5434 (test BD)
pg_db_for_schema   # Factory: pg_db_for_schema("tenant") → sesión con search_path correcto
```

### Patrón de aislamiento

```python
@pytest.fixture()
def tenant_db(pg_db_for_schema):
    return pg_db_for_schema("lalicoreria")  # Transacción → ROLLBACK al finalizar el test
```

Cada test corre dentro de una transacción PostgreSQL que se revierte automáticamente.
La BD queda intacta. Los tests pueden insertar, modificar y consultar libremente.

### Patrón de helpers (sin db.commit ni WebSocket)

```python
def _helper_logica(db, params):
    """Replica la lógica del router/service sin db.commit() ni WebSocket."""
    obj = Model(**params)
    db.add(obj)
    db.flush()   # ← aplica a BD dentro de la transacción, sin commit
    return obj
```

### Tenant de test

Todos los tests usan `TENANT = "lalicoreria"` (existe en la BD de test restaurada de producción).

---

## 3. Estado de implementación {#estado}

### Suite actual

**~305 tests implementados: 45 integridad BD + ~260 funcionales ✅**

| Archivo | Grupo | Tests | Estado |
|---------|-------|-------|--------|
| `test_cat1_caja_pg.py` | Integridad caja | ~9 | ✅ |
| `test_cat2_ventas_pg.py` | Integridad ventas | ~9 | ✅ |
| `test_cat3_inventario_pg.py` | Integridad inventario | ~9 | ✅ |
| `test_cat4_auth_pg.py` | Integridad auth | ~9 | ✅ |
| `test_cat5_tenants_pg.py` | Integridad tenants | ~9 | ✅ |
| `test_func_ventas_pg.py` | Ventas funcionales | 12 | ✅ |
| `test_func_caja_pg.py` | Caja funcionales | 32 | ✅ |
| `test_func_inventario_pg.py` | Inventario funcionales | 6 | ✅ |
| `test_func_traslados_pg.py` | Traslados externos | 5 | ✅ |
| `test_func_auth_pg.py` | Auth funcionales | 4 | ✅ |
| `test_func_config_pg.py` | Config funcionales | 12 | ✅ |
| `test_func_compras_pg.py` | Compras funcionales | 11 | ✅ |
| `test_func_creditos_pg.py` | Créditos funcionales | 9+1skip | ✅ |
| `test_func_clientes.py` | Clientes y deuda | 12 | ✅ |
| `test_func_devoluciones.py` | Devoluciones | 12 | ✅ |
| `test_func_tasas_cambio.py` | Tasas de cambio | 12 | ✅ |
| `test_func_ventas_avanzado.py` | Ventas avanzadas | 13 | ✅ |
| `test_func_ordenes_servicio.py` | Órdenes de servicio | 18 | ✅ |
| `test_func_compras_avanzado.py` | Compras avanzadas | 11 | ✅ |
| `test_func_comisiones.py` | Comisiones (ventas) | 13 | ✅ |
| `test_func_cotizaciones.py` | Cotizaciones | 13 | ✅ |
| `test_func_productos.py` | Productos | 12 | ✅ |
| `test_func_proveedores.py` | Proveedores | 9 | ✅ |
| `test_func_usuarios.py` | Usuarios y roles | 8 | ✅ |
| `test_func_bodegas.py` | Bodegas/Almacenes | 10 | ✅ |
| `test_func_categorias.py` | Categorías de productos | 12 | ✅ |
| `test_func_metodos_pago.py` | Métodos de pago | 10 | ✅ |
| `test_func_listas_precio.py` | Listas de precio | 10 | ✅ |
| `test_func_garantias.py` | Garantías (policy+claim) | 13 | ✅ |
| `test_func_ajustes_inventario.py` | Ajustes de stock (IN/OUT) | 13 | ✅ |
| `test_func_traslados_internos.py` | Traslados entre bodegas | 12 | ✅ |
| `test_func_empleados.py` | Empleados + Commission | 13 | ✅ |

**Total implementado: ~305 tests ✅**

### Nota técnica: dos sistemas de comisiones

| Modelo | Módulo | Propósito |
|--------|--------|-----------|
| `CommissionLog` | Ventas generales | Comisión por venta al usuario (vendedor) |
| `Commission` | Barbería/Salón | Comisión por servicio al empleado físico |

---

## 4. Plan completo por módulo {#plan}

---

### TIER 1 — Flujos core con alto riesgo de bug

---

#### `test_func_clientes.py` — Clientes y deuda (~12 tests)

**Por qué importa:** La deuda del cliente se calcula en tiempo real sumando ventas crédito menos pagos. Un error aquí puede negar crédito a clientes que ya pagaron o aprobar a clientes deudores.

**Flujos a cubrir:**

| ID | Descripción | Qué verifica |
|----|-------------|-------------|
| FCL01a | Crear cliente con todos los campos | `name`, `credit_limit`, `payment_term_days` persisten |
| FCL01b | ID/cédula único por tenant | Segundo cliente con misma cédula → `IntegrityError` |
| FCL02a | Deuda = suma balance_pending de ventas crédito activas | Fórmula correcta |
| FCL02b | Pago reduce deuda correctamente | `balance_pending` baja, `paid=True` cuando llega a 0 |
| FCL02c | Deuda en 0 tras pagar todo | Cliente sin deuda pendiente |
| FCL03a | Límite de crédito disponible = `credit_limit - deuda_actual` | Cálculo correcto |
| FCL03b | Facturas vencidas: `due_date < hoy AND balance_pending > 0` | Count y suma correctos |
| FCL03c | Cliente sin facturas vencidas → overdue_count = 0 | Caso base |
| FCL04a | `is_blocked=True` bloquea ventas a crédito | Sale con crédito rechazada |
| FCL04b | `is_blocked=True` NO bloquea ventas de contado | Venta normal OK |
| FCL05a | Soft-delete: `is_active=False` mantiene registro en BD | Dato histórico preservado |
| FCL05b | Cliente inactivo excluido de lista por defecto | Filtro `is_active=True` funciona |

---

#### `test_func_devoluciones.py` — Devoluciones (~10 tests)

**Por qué importa:** Una devolución toca stock, Kardex, balance de deuda y caja al mismo tiempo. Un error puede crear stock fantasma, doble crédito o pérdida de trazabilidad.

**Flujos a cubrir:**

| ID | Descripción | Qué verifica |
|----|-------------|-------------|
| FRE01a | Devolución GOOD: stock se restaura | `ProductStock` y `Product.stock` aumentan |
| FRE01b | Devolución GOOD: Kardex RETURN creado | `movement_type=RETURN`, `balance_after` correcto |
| FRE01c | Devolución GOOD: `ReturnDetail` almacena `unit_price` y `unit_cost` | Auditoría histórica |
| FRE02a | Devolución DAMAGED: stock restaurado temporalmente | RETURN kardex primero |
| FRE02b | Devolución DAMAGED: ajuste OUT inmediato | ADJUSTMENT_OUT kardex → stock neto = 0 |
| FRE02c | Devolución DAMAGED: dos entradas Kardex, stock neto sin cambio | Auditoría sin stock fantasma |
| FRE03a | Devolución sobre venta a crédito reduce `balance_pending` | Deuda baja en monto devuelto |
| FRE03b | Devolución parcial de crédito: `balance_pending` baja pero no llega a 0 | No cancela toda la deuda |
| FRE03c | `Return` y `ReturnDetail` registrados correctamente | FK a Sale y SaleDetail |
| FRE04a | Importe de refund = `unit_price × qty_returned` | Cálculo correcto |

---

#### `test_func_tasas_cambio.py` — Tasas de cambio (~8 tests)

**Por qué importa:** El sistema es multimoneda con tasas variables (BCV, paralelo). Una tasa mal configurada afecta todos los precios, valuaciones de crédito y conversiones de la caja.

**Flujos a cubrir:**

| ID | Descripción | Qué verifica |
|----|-------------|-------------|
| FTC01a | Crear tasa con `is_default=True` | Persiste correctamente |
| FTC01b | Solo una tasa puede ser `is_default=True` | Al activar otra como default, la anterior queda `is_default=False` |
| FTC02a | Producto con `exchange_rate_id` específico | Usa esa tasa, no la default |
| FTC02b | Producto sin `exchange_rate_id` | Usa la tasa `is_default=True` |
| FTC03a | Valuación de crédito en Bs: `balance_pending × rate.rate` | Fórmula correcta |
| FTC03b | Valuación proporcional: `(balance_pending/total_amount) × total_ves` | Crédito parcialmente pagado |
| FTC04a | Tasa `is_active=False` excluida de selección activa | Solo tasas activas disponibles |
| FTC04b | Múltiples tasas activas coexisten (BCV + Paralelo) | Sistema multi-tasa funcional |

---

#### `test_func_ventas_avanzado.py` — Ventas avanzadas (~10 tests)

**Por qué importa:** Los flujos de descuento, IGTF, vuelto y pago mixto son fuentes frecuentes de errores de cálculo que afectan directamente el dinero del negocio.

**Flujos a cubrir:**

| ID | Descripción | Qué verifica |
|----|-------------|-------------|
| FVA01a | Descuento en carrito: `total_discount_usd` reduce `total_amount` | Cálculo correcto |
| FVA01b | Descuento no puede superar el subtotal | Validación límite |
| FVA02a | IGTF 3% en pago USD: `total_amount` aumenta en 3% | `igtf_amount` calculado |
| FVA02b | Pago en Bs no activa IGTF | Solo USD paga IGTF en Venezuela |
| FVA03a | Pago mixto: USD + Bs → dos `SalePayment` | Ambos registros creados |
| FVA03b | Suma de `SalePayment.amount` (normalizados) == `total_amount` | Sin doble cobro |
| FVA04a | `change_amount > 0`: vuelto registrado en venta | `change_amount` y `change_currency` correctos |
| FVA04b | Vuelto resta del `expected` en cierre de caja | Fórmula de cierre incluye `change` |
| FVA05a | `SaleDetail.unit_price` capturado al momento de venta | No cambia si el producto cambia de precio |
| FVA05b | Precio histórico: `SaleDetail` conserva precio aunque producto se actualice | Auditoría correcta |

---

#### `test_func_ordenes_servicio.py` — Órdenes de servicio (~12 tests)

**Por qué importa:** Las órdenes de servicio (reparación/lavandería) son el core de varios tipos de negocio. El flujo tiene estados, restricciones de reversión, y converge en una venta al hacer checkout.

**Flujos a cubrir:**

| ID | Descripción | Qué verifica |
|----|-------------|-------------|
| FSO01a | Crear orden: `ServiceOrder` con datos del dispositivo | Persiste correctamente |
| FSO01b | Número de ticket auto-generado con prefijo por tipo | `ticket_number` único y secuencial |
| FSO01c | Orden vinculada a cliente (opcional) | `customer_id` nullable |
| FSO02a | Flujo: RECEIVED → IN_PROGRESS | Transición válida |
| FSO02b | Flujo: IN_PROGRESS → READY | Transición válida |
| FSO02c | Flujo: READY → DELIVERED | Transición válida, `delivered_at` se setea |
| FSO02d | No se puede ir de RECEIVED → DELIVERED (saltar estados) | Validación de flujo |
| FSO03a | Agregar ítem/repuesto a orden (`ServiceOrderItem`) | FK correcto, precio almacenado |
| FSO03b | Ítem sin `product_id` (trabajo manual/mano de obra) | Descripción-only, sin stock |
| FSO04a | Checkout: convierte orden en Sale | Sale creado con `total_amount` correcto |
| FSO04b | Checkout doble: segunda llamada rechazada | Flag `payment_status=PAID` en metadata previene doble cobro |
| FSO05a | Orden tipo laundry: metadata con `pieces` y `bag_color` | Datos específicos de lavandería |

---

### TIER 2 — Flujos de dinero y soporte

---

#### `test_func_compras_avanzado.py` — Compras avanzadas (~8 tests)

**Por qué importa:** Las compras a crédito a proveedores y los pagos parciales son flujos complejos que afectan el balance del proveedor y el status de la PO.

**Flujos a cubrir:**

| ID | Descripción | Qué verifica |
|----|-------------|-------------|
| FPA01a | PO CREDIT: `supplier.current_balance` aumenta en `total_amount` | Deuda con proveedor registrada |
| FPA01b | Pago parcial: `paid_amount` acumula, status PENDING→PARTIAL | Transición correcta |
| FPA01c | Pago completo: status PARTIAL→PAID, `supplier.current_balance` baja | Liquidación correcta |
| FPA02a | `update_price=True`: precio venta recalculado desde costo + margen | `product.sale_price` actualizado |
| FPA02b | `update_price=False`: precio de venta no cambia | Precio anterior intacto |
| FPA03a | Recibir en warehouse B no toca warehouse A | Aislamiento de almacenes |
| FPA03b | PO sin `warehouse_id`: stock va al warehouse principal | Default correcto |
| FPA04a | Múltiples ítems en una PO: stock de cada producto actualizado | Batch correcto |

---

#### `test_func_comisiones.py` — Comisiones de empleados (~8 tests)

**Por qué importa:** Las comisiones son dinero real que sale de la caja. Un error puede pagar comisiones dos veces o calcular montos incorrectos.

**Flujos a cubrir:**

| ID | Descripción | Qué verifica |
|----|-------------|-------------|
| FCO01a | `CommissionLog` creado al hacer una venta | Vínculo sale → comisión |
| FCO01b | Monto = `total_amount × commission_percentage / 100` | Cálculo correcto |
| FCO01c | Comisión en estado PENDING tras la venta | Estado inicial correcto |
| FCO02a | Payout: `CommissionLog.status` → PAID | Transición de estado |
| FCO02b | Payout crea `CashMovement` de tipo EXPENSE en sesión activa | Dinero sale de caja |
| FCO02c | No se puede pagar la misma comisión dos veces | Segunda llamada rechazada |
| FCO03a | Comisión 0% (empleado sin comisión): no crea CommissionLog | Sin registro innecesario |
| FCO03b | Resumen por empleado: total PENDING y total PAID | Agregación correcta |

---

#### `test_func_cotizaciones.py` — Cotizaciones/presupuestos (~8 tests)

**Por qué importa:** Las cotizaciones capturan precios en un momento dado. Si el precio cambia después, la cotización debe conservar el precio original.

**Flujos a cubrir:**

| ID | Descripción | Qué verifica |
|----|-------------|-------------|
| FCT01a | Crear cotización con múltiples ítems | `Quote` + `QuoteDetail` persisten |
| FCT01b | `QuoteDetail.unit_price` fijado al momento de cotizar | No cambia con el producto |
| FCT01c | `subtotal = unit_price × quantity` por cada ítem | Cálculo por línea |
| FCT01d | `total_amount = suma subtotales` | Total correcto |
| FCT02a | Solo cotizaciones PENDING son editables | Editar CONVERTED → error |
| FCT02b | Convertir: status PENDING → CONVERTED | Transición correcta |
| FCT02c | Cotización CONVERTED no puede editarse | Inmutabilidad post-conversión |
| FCT03a | Eliminar cotización PENDING → se borra de BD | Borrado físico OK |

---

#### `test_func_productos.py` — Productos (~10 tests)

**Por qué importa:** Los productos son el centro del sistema. SKU duplicado, búsquedas incorrectas o stock global mal calculado rompen el POS.

**Flujos a cubrir:**

| ID | Descripción | Qué verifica |
|----|-------------|-------------|
| FPR01a | Crear producto con categoría | FK correcta, todos los campos |
| FPR01b | SKU único por tenant → duplicado rechazado | `IntegrityError` en SKU repetido |
| FPR01c | Producto sin categoría permitido | `category_id=None` OK |
| FPR02a | `Product.stock` = suma de `ProductStock` de todos los warehouses | Stock global consistente |
| FPR02b | Crear stock en warehouse que no tenía ProductStock | Se crea el registro automáticamente |
| FPR03a | Búsqueda multi-token: "Redmi 15C 256" → busca con AND lógico | Todos los tokens deben estar |
| FPR03b | Búsqueda por SKU parcial | ilike match |
| FPR04a | `is_service=True`: venta sin Kardex, sin cambio de stock | Servicio no descuenta |
| FPR04b | Soft-delete: `is_active=False` conserva en BD | Histórico preservado |
| FPR04c | Producto tipo combo: `is_combo=True`, tiene `ComboItem`s | Estructura correcta |

---

### TIER 3 — Completitud e infraestructura

---

#### `test_func_proveedores.py` — Proveedores (~5 tests)

**Por qué importa:** El `current_balance` del proveedor debe reflejar exactamente lo que se le debe. Un error lo hace invisible.

| ID | Descripción | Qué verifica |
|----|-------------|-------------|
| FSP01a | Crear proveedor con `payment_term_days` | Campos persisten |
| FSP01b | `current_balance` aumenta con compra CREDIT | Deuda registrada |
| FSP01c | `current_balance` baja al registrar pago | Liquidación parcial |
| FSP01d | `current_balance` no cambia con compra CASH | Solo crédito afecta balance |
| FSP01e | Nombre único por tenant (si hay constraint) | Duplicado rechazado o permitido |

---

#### `test_func_usuarios.py` — Usuarios y roles (~6 tests)

**Por qué importa:** Los roles controlan qué puede hacer cada usuario. Un error en la creación o el PIN puede bloquear el acceso o saltarse la autenticación.

| ID | Descripción | Qué verifica |
|----|-------------|-------------|
| FUS01a | Crear usuario con rol CASHIER | Rol asignado correctamente |
| FUS01b | Email único por tenant (no global) | Mismo email en otro tenant: OK; mismo tenant: error |
| FUS01c | Username único por tenant | Duplicado en mismo tenant: error |
| FUS02a | PIN se hashea con bcrypt al guardar | `pin` en BD es hash (~60 chars), no texto plano |
| FUS02b | Verificar PIN con `passlib.verify()` | Hash correcto, verificación exitosa |
| FUS03a | `is_active=False`: soft-delete, usuario en BD | Dato histórico preservado |

---

## 5. Nota técnica: service rollback en tests de excepción {#rollback}

El `SalesService` llama `db.rollback()` internamente al lanzar una excepción.
Esto invalida la sesión de test (`tenant_db`) para queries posteriores.

**Soluciones adoptadas:**

1. **Verificar estado ANTES** del intento fallido (F02b)
2. **`pg_engine` con conexión independiente** para verificar BD comprometida (F02c)
3. **ORM directo** en lugar de llamar al service (créditos, caja, devoluciones)

Este patrón se replica en todos los tests de excepción nuevos.

---

## 6. Pipeline de deploy {#pipeline}

### Estado actual (136 tests)

```bash
# deploy_images.sh — 136 tests totales, ~2 segundos
python -m pytest \
    backend_api/tests/test_cat1_caja_pg.py \
    backend_api/tests/test_cat2_ventas_pg.py \
    backend_api/tests/test_cat3_inventario_pg.py \
    backend_api/tests/test_cat4_auth_pg.py \
    backend_api/tests/test_cat5_tenants_pg.py \
    backend_api/tests/test_func_ventas_pg.py \
    backend_api/tests/test_func_caja_pg.py \
    backend_api/tests/test_func_inventario_pg.py \
    backend_api/tests/test_func_traslados_pg.py \
    backend_api/tests/test_func_auth_pg.py \
    backend_api/tests/test_func_config_pg.py \
    backend_api/tests/test_func_compras_pg.py \
    backend_api/tests/test_func_creditos_pg.py \
    -v --no-cov --tb=short
```

### Target (233 tests) — se actualiza al implementar cada módulo

```bash
python -m pytest \
    backend_api/tests/test_cat1_caja_pg.py \
    backend_api/tests/test_cat2_ventas_pg.py \
    backend_api/tests/test_cat3_inventario_pg.py \
    backend_api/tests/test_cat4_auth_pg.py \
    backend_api/tests/test_cat5_tenants_pg.py \
    backend_api/tests/test_func_ventas_pg.py \
    backend_api/tests/test_func_caja_pg.py \
    backend_api/tests/test_func_inventario_pg.py \
    backend_api/tests/test_func_traslados_pg.py \
    backend_api/tests/test_func_auth_pg.py \
    backend_api/tests/test_func_config_pg.py \
    backend_api/tests/test_func_compras_pg.py \
    backend_api/tests/test_func_creditos_pg.py \
    backend_api/tests/test_func_clientes.py \
    backend_api/tests/test_func_devoluciones.py \
    backend_api/tests/test_func_tasas_cambio.py \
    backend_api/tests/test_func_ventas_avanzado.py \
    backend_api/tests/test_func_ordenes_servicio.py \
    backend_api/tests/test_func_compras_avanzado.py \
    backend_api/tests/test_func_comisiones.py \
    backend_api/tests/test_func_cotizaciones.py \
    backend_api/tests/test_func_productos.py \
    backend_api/tests/test_func_proveedores.py \
    backend_api/tests/test_func_usuarios.py \
    -v --no-cov --tb=short
```

---

## Módulos cubiertos — resumen final

| Módulo | Archivo | Tests impl. | Tests planeados | Total |
|--------|---------|------------|----------------|-------|
| Integridad BD | test_cat1-5_*_pg.py | 45 | — | 45 |
| Ventas | test_func_ventas_pg.py | 12 | — | 12 |
| Ventas avanzadas | test_func_ventas_avanzado.py | 0 | 10 | 10 |
| Caja | test_func_caja_pg.py | 32 | — | 32 |
| Inventario | test_func_inventario_pg.py | 6 | — | 6 |
| Traslados | test_func_traslados_pg.py | 5 | — | 5 |
| Auth | test_func_auth_pg.py | 4 | — | 4 |
| Configuración | test_func_config_pg.py | 12 | — | 12 |
| Compras | test_func_compras_pg.py | 11 | — | 11 |
| Compras avanzadas | test_func_compras_avanzado.py | 0 | 8 | 8 |
| Créditos | test_func_creditos_pg.py | 9+1skip | — | 10 |
| Clientes | test_func_clientes.py | 0 | 12 | 12 |
| Devoluciones | test_func_devoluciones.py | 0 | 10 | 10 |
| Tasas de cambio | test_func_tasas_cambio.py | 0 | 8 | 8 |
| Órdenes servicio | test_func_ordenes_servicio.py | 0 | 12 | 12 |
| Comisiones | test_func_comisiones.py | 0 | 8 | 8 |
| Cotizaciones | test_func_cotizaciones.py | 0 | 8 | 8 |
| Productos | test_func_productos.py | 0 | 10 | 10 |
| Proveedores | test_func_proveedores.py | 0 | 5 | 5 |
| Usuarios | test_func_usuarios.py | 0 | 6 | 6 |
| **TOTAL** | | **136** | **97** | **~233** |
