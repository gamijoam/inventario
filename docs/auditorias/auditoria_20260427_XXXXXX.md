# AUDITORÍA: Módulo Restaurante — Flujo de Stock Reservation

**Fecha:** 2026-04-27  
**Auditor:** Lead Software Architect & Cyber-Security Auditor  
**Proyecto:** Mi Inventario Fácil — Ferretería Refactor  
**Módulo audited:** Restaurant Orders (Stock Reservation Flow)

---

## RESUMEN EJECUTIVO

| Severidad | Cantidad |
|-----------|----------|
| 🔴 CRÍTICA | 2 |
| 🟠 ALTA | 2 |
| 🟡 MEDIA | 2 |

### Estado General del Código

El flujo de stock del módulo restaurante tiene **2 bugs CRÍTICOS** que causan el problema reportado: al hacer checkout, el sistema indica "no stock" aunque el stock fue reservado al crear la orden. La arquitectura base es correcta (flag `stock_deducted`, `skip_stock_deduction` en checkout), pero existen casos donde se produce **doble deducción** o **reservación sin deducción real**.

---

## 🔴 VIOLACIONES CRÍTICAS

### BUG 1: Split Order — Stock deductado en orden original NO se transfiere a nueva orden

**Archivo:** `backend_api/routers/modules/restaurant/orders.py:789-879` (función `split_order`)

**Descripción:**  
Cuando se divide una cuenta (`POST /restaurant/orders/{order_id}/split`), el sistema:
1. Crea items en la nueva orden copiando el `status` original (incluyendo `stock_deducted=True`)
2. Reduce la cantidad del item original O elimina el item original
3. **NUNCA** invoca `InventoryService.deduct_order_items_stock()` para la nueva orden
4. **NUNCA** invoca `InventoryService.reverse_stock_for_item()` del item original

**Impacto en producción:**  
- Item con qty=5, `stock_deducted=True` se divide en nuevo orden con qty=2
- El item original queda con qty=3 (o se elimina)
- La nueva orden tiene items con `stock_deducted=True` pero **el stock NUNCA fue deductado para esa orden específica**
- Cuando se hace checkout de la nueva orden, el sistema intenta deductar stock que **ya fue consumido** por la orden original
- Resultado: "Stock insuficiente" en checkout

**Detalle técnico:**

```python
# orders.py línea 839-850 - Crea item en nueva orden SIN deduct_stock
new_item = RestaurantOrderItem(
    order_id=new_order.id,
    product_id=original_item.product_id,
    quantity=qty_to_move,
    unit_price=original_item.unit_price,
    subtotal=subtotal_moved,
    notes=original_item.notes,
    status=original_item.status  # ⚠️ Copia el status original (stock_deducted=True)
)
```

**Flujo contaminado:**
```
Orden #1: Item A (qty=5) → deduct_stock → stock_deducted=True → ProductStock: 5 deducted
Split: Item A → Nueva Orden #2 (qty=2)
  ├─ Item original: qty reducida a 3, stock_deducted sigue=True (5 deducted, no 3)
  └─ Nueva Orden #2: Item A (qty=2, stock_deducted=True) ← SIN deduct_stock real
Checkout Orden #2:
  └─ skip_stock_deduction=True → SalesService.skip_stock=True → No intenta deductar
  ¿PERO qué pasa si el producto de Nueva Orden #2 NO tenía receta en la orden original?
```

**Corrección requerida:**  
Antes de crear items en la nueva orden tras un split, se debe:
1. Hacer `reverse_stock_for_item()` del item original (revertir la porción splitteada)
2. Crear el item en la nueva orden con `stock_deducted=False`
3. Llamar `deduct_order_items_stock()` para la nueva orden

---

### BUG 2: Race Condition — `deduct_order_items_stock()` no valida disponibilidad antes de deductar

**Archivo:** `backend_api/services/inventory_service.py:124-183` (función `deduct_order_items_stock`)

**Descripción:**  
`deduct_order_items_stock()` deduce stock **sin verificar** si hay suficiente disponible. Compara con `get_product_availability()` que SÍ tiene la lógica correcta de disponibilidad, pero esta función NUNCA se llama antes de deductar.

```python
# inventory_service.py línea 124-183 - NO hay validación de disponibilidad
def deduct_order_items_stock(db, order_items, warehouse_id, ...):
    for item in order_items:
        if item.stock_deducted:
            continue
        # ⚠️ Directamente aplica _apply_deduction SIN verificar available_qty
        InventoryService._apply_deduction(db, ingredient, qty_to_deduct, ...)
```

**Impacto en producción:**  
En entornos con alta concurrencia (múltiples meseros creando órdenes simultáneamente):
1. Producto X: stock_total=10, stock_available=10
2. Mesero A crea orden con 6 items → pasa validación
3. Mesero B crea orden con 6 items → pasa validación (stock_available aún no se actualizó)
4. Ambos checkout → Mesero A: OK | Mesero B: "no stock" aunque la orden se creó exitosamente

**Corrección requerida:**  
Agregar validación de disponibilidad en `deduct_order_items_stock()`:
```python
availability = InventoryService.get_product_availability(db, product_id, warehouse_id)
if availability["stock_available"] < qty_needed:
    raise HTTPException(status_code=400, detail=f"Stock insuficiente...")
```

---

## 🟠 VIOLACIONES DE ARQUITECTURA / ALTA

### ALTA 1: `reverse_stock_for_item()` puede invertir stock dos veces

**Archivo:** `backend_api/services/inventory_service.py:67-98`

**Descripción:**  
La función invierte stock y luego setea `stock_deducted=False`. Pero si `stock_deducted` ya era `False`, la función retorna `False` sin hacer nada. Sin embargo, si por algún bug se llama dos veces, la segunda llamada **ya no tiene protección** porque `stock_deducted` fue seteado a `False` en la primera.

```python
# inventory_service.py línea 72-97
def reverse_stock_for_item(db, order_item):
    if not order_item.stock_deducted:  # ← Primera llamada: True, proceede
        return False
    
    # ... invierte stock ...
    order_item.stock_deducted = False  # ← Setea a False
    
    # Si se llama de nuevo (bug, double-call):
    # - stock_deducted es False → retorna False
    # Pero si el item fue reusado sin flush:
    # - stock_deducted es False → retorna False Y no invierte
    # PERO si hay race condition donde stock_deducted=True otra vez:
    # - Invierte stock OTRA VEZ
```

**Impacto:** Potencial de inversión doble de stock en escenarios de race condition.

**Recomendación:** Implementar idempotencia con un flag intermediario o usar un campo transaccional.

---

### ALTA 2: Split Order — Modificadores no se copian a la nueva orden

**Archivo:** `backend_api/routers/modules/restaurant/orders.py:818-862`

**Descripción:**  
Cuando se divide un order item, los `RestaurantOrderItemModifier` (modificadores seleccionados) no se copian a la nueva orden. Esto causa:
1. Loss de información de modificadores en la nueva orden
2. Posible inconsistency en el cálculo de `aggregate_factor` durante checkout

```python
# orders.py línea 839-850 - Solo copia campos básicos
new_item = RestaurantOrderItem(
    order_id=new_order.id,
    product_id=original_item.product_id,
    quantity=qty_to_move,
    unit_price=original_item.unit_price,
    subtotal=subtotal_moved,
    notes=original_item.notes,
    status=original_item.status
)
# ⚠️ NO se copian los modifiers: new_item.modifiers está vacío
```

**Impacto:** Los modificadores de la nueva orden se pierden, afectando el `recipe_factor` y potentially el consumo de ingredientes extra.

---

## 🟡 MEJORAS RECOMENDADAS

### MEDIA 1: `aggregate_factor` no considera `removed_ingredient_ids` en checkout

**Archivo:** `backend_api/routers/modules/restaurant/orders.py:561-565`

```python
aggregate_factor = Decimal("1.0")
for mod in item.modifiers:
    if mod.option and mod.option.recipe_factor:
        aggregate_factor *= Decimal(str(mod.option.recipe_factor))
```

**Problema:** El `aggregate_factor` se calcula solo desde los modificadores, pero `deduct_order_items_stock()` en orden creation recibe `removed_ingredients_map` para skippear ingredientes. Si el usuario removió ingredientes, el `recipe_factor` no refleja esa remoción.

**Recomendación:** Guardar el `removed_ingredients_map` en la orden o en cada item para replicar la lógica exacta en checkout.

---

### MEDIA 2: Warning silencioso en `add_items_to_order` cuando falla stock deduction

**Archivo:** `backend_api/routers/modules/restaurant/orders.py:269-276`

```python
try:
    InventoryService.deduct_order_items_stock(...)
except Exception as e:
    print(f"[WARNING] Stock deduction failed: {e}")
    # ⚠️ No se bloquea la orden, solo se loguea
```

**Problema:** Si falla la deducción de stock, la orden se crea igual. El mesero no se entera hasta que el cliente intenta pagar.

**Recomendación:** En una próxima versión, considerar si esto debería ser un error bloqueante.

---

## FLUJO DOCUMENTADO COMPLETO

### 1. Order Creation — `POST /restaurant/orders/{order_id}/items`

```
add_items_to_order() [orders.py:179]
  └─→ InventoryService.deduct_order_items_stock() [inventory_service.py:124]
        ├─→ Valida item.stock_deducted == False [line 131]
        ├─→ Si product.is_service: set stock_deducted=True, skip [line 139-141]
        ├─→ Si tiene RestaurantRecipe:
        │     └─→ _apply_deduction() por cada ingrediente [line 161]
        │         └─→ stock_entry.quantity -= qty
        │         └─→ product.stock -= qty
        │         └─→ Kardex SALE
        │     └─→ item.stock_deducted = True [line 164]
        ├─→ Si producto directo (sin receta):
        │     └─→ _apply_deduction() [line 168]
        │     └─→ item.stock_deducted = True [line 170]
        └─→ Si tiene modifiers:
              └─→ _apply_deduction() por cada modifier.ingredient [line 180]
```

**Flag `stock_deducted`:**  
- Default: `False` (en modelo RestaurantOrderItem)
- Se setea a `True` DURANTE la creación de items (líneas 140, 164, 170)
- Se usa para evitar doble deducción en checkout

---

### 2. Order Item Status — `PUT /restaurant/orders/items/{item_id}/status`

```
update_order_item_status() [orders.py:352]
  └─→ Cambia item.status al nuevo estado
  └─→ Si new_status == SERVED:
        └─→ Si TODOS los items están SERVED o CANCELLED:
              └─→ table.status = WAITING_BILL
              └─→ WebSocket notification "order:ready_to_bill"
  ⚠️ NO hay manipulación de stock en ningún status transition
```

**Status transitions:**
| Status | Efecto en Stock |
|--------|-----------------|
| PENDING → SENT | Ninguno |
| PENDING → PREPARING | Ninguno |
| PREPARING → READY | Ninguno |
| READY → SERVED | Ninguno (solo actualiza table a WAITING_BILL) |
| * → CANCELLED | Usa `cancel_order_item()` DELETE endpoint |

---

### 3. Cancel Item — `DELETE /restaurant/orders/items/{item_id}`

```
cancel_order_item() [orders.py:420]
  └─→ validate: not SERVED, not PAID
  └─→ InventoryService.reverse_stock_for_item() [inventory_service.py:67]
        ├─→ Valida order_item.stock_deducted == True [line 72]
        ├─→ Si tiene recipe: +qty por cada ingrediente [line 89-93]
        │     └─→ _apply_reverse(): stock_entry.quantity += qty, product.stock += qty
        ├─→ Si producto directo: +qty [line 95]
        └─→ order_item.stock_deducted = False [line 97]
  └─→ db.delete(item)
  └─→ order.total_amount -= item.subtotal
```

---

### 4. Checkout — `POST /restaurant/orders/{order_id}/checkout`

```
checkout_order() [orders.py:513]
  └─→ Consulta RestaurantOrderItem con status != CANCELLED [line 537-543]
  └─→ Para cada item, crea SaleDetailCreate:
        └─→ skip_stock_deduction = item.stock_deducted or False [line 579]
  └─→ SalesService.create_sale() [sales_service.py:51]
        └─→ Para cada item:
              ├─→ skip_stock = getattr(item, "skip_stock_deduction", False) [line 265]
              ├─→ Si skip_stock == True: NO deduce stock [line 335]
              └─→ Si skip_stock == False: Receta/Escandallo/Kardex [line 337-608]
```

**Mecanismo anti-doble-deducción:**
- Si `item.stock_deducted == True` → `skip_stock_deduction = True` → `skip_stock = True` → SalesService NO deduce stock
- Si `item.stock_deducted == False` → `skip_stock_deduction = False` → `skip_stock = False` → SalesService deduce stock

---

### 5. WAITING_BILL — Table Status Transition

```
update_order_item_status() → SERVED
  └─→ all_items_served = all(i.status in [SERVED, CANCELLED] for i in order.items)
  └─→ if all_served and table_id:
        └─→ table.status = WAITING_BILL [orders.py:408]
  ⚠️ NO hay manipulación de stock aquí
```

---

### 6. Split Order — `POST /restaurant/orders/{order_id}/split`

```
split_order() [orders.py:789]
  └─→ Crea nueva RestaurantOrder [line 806]
  └─→ Para cada item_to_split:
        ├─→ Busca original_item [line 821]
        ├─→ Crea new_item en nueva orden [line 840-849]
        │     ⚠️ NO copia modifiers
        │     ⚠️ stock_deducted se copia del original (status=original_item.status)
        ├─→ Si qty_to_move == qty_original:
        │     └─→ db.delete(original_item) [line 856]
        │     ⚠️ NO invierte stock
        └─→ Si qty_to_move < qty_original:
              └─→ original_item.quantity -= qty_to_move [line 860]
              ⚠️ stock_deducted NO cambia
  ⚠️ NUNCA llama deduct_order_items_stock() para la nueva orden
  ⚠️ NUNCA invierte stock del item original (reverse_stock)
```

---

## ARCHIVOS AFECTADOS

| Criticidad | Archivo | Línea(s) |
|------------|---------|----------|
| 🔴 CRÍTICA | `backend_api/routers/modules/restaurant/orders.py` | 789-879 (split_order) |
| 🔴 CRÍTICA | `backend_api/services/inventory_service.py` | 124-183 (deduct_order_items_stock) |
| 🟠 ALTA | `backend_api/services/inventory_service.py` | 67-98 (reverse_stock_for_item) |
| 🟠 ALTA | `backend_api/routers/modules/restaurant/orders.py` | 839-850 (split modifiers) |
| 🟡 MEDIA | `backend_api/routers/modules/restaurant/orders.py` | 561-565 (aggregate_factor) |
| 🟡 MEDIA | `backend_api/routers/modules/restaurant/orders.py` | 269-276 (warning silencioso) |

---

## CONCLUSIÓN

El problema reportado ("no stock" en checkout aunque items fueron consumidos) es causado por **2 bugs CRÍTICOS**:

1. **Split Order:** Cuando se divide una cuenta, los items de la nueva orden heredan `stock_deducted=True` del item original, pero el stock **nunca fue deductado para esa orden específica**. Al hacer checkout, el sistema no puede distinguir entre stock ya usado (porque fue a la orden original) vs stock disponible.

2. **Race Condition:** `deduct_order_items_stock()` no valida disponibilidad antes de deductar, permitiendo que múltiples órdenes se creen cuando solo hay stock para una.

La arquitectura base del flag `stock_deducted` y el mecanismo `skip_stock_deduction` en checkout es **correcta y bien diseñada**, pero falla en los casos de Split Order y alta concurrencia.

**Recomendación de acción inmediata:** Corregir el Bug 1 (Split Order) es prioritario, ya que es el escenario más probable del bug reportado. El Bug 2 (Race Condition) requiere una refactorización mayor de la validación de stock.
