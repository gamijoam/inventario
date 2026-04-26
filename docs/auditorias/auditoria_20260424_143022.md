# 🍽️ AUDITORÍA MÓDULO RESTAURANTE
## Fecha: 2026-04-24
## Auditor: Claude Code (Auditoría Integral)

---

## 1. RESUMEN EJECUTIVO

### Estado General: ⚠️ OPERATIVO CON DEUDA TÉCNICA MODERADA

El módulo restaurante de "Mi Inventario Fácil" está **funcionalmente operativo** para un restaurante básico de ventas mostrador (takeout) y servicio de salón. Sin embargo, comparándolo con las necesidades del cliente potencial (pollo asado, medio pollo, pizza, víveres) y las expectativas de un sistema de restaurante profesional, existen **brechas significativas** que deben resolverse antes de producción.

### Posición frente al cliente potencial:
| Necesidad del Cliente | Estado |
|---|---|
| Flujo de comandas a cocina | ✅ Implementado (KDS) |
| Manejo de mesas con cuentas abiertas | ✅ Implementado |
| Impresión WiFi | ⚠️ Parcial (WebSocket broadcasting, sin driver ESC/POS nativo) |
| Venta de medio pollo (0.5) | ✅ Soporta decimales en quantity |
| Módulo víveres coexistiendo | ✅ Feature flags + multi-módulo |
| Módulo restaurante listo para producción | ⚠️ Requiere desarrollo adicional |

### Evaluación de Riesgo: MEDIA
- **Funcionalidades Core**: Implementadas (mesas, órdenes, KDS, checkout)
- **Deuda Técnica**: Moderada (sin impresoras WiFi nativas, sin modificadores de productos)
- **Capacidad Multi-Tenant**: ✅ Funcionando
- **Facturación/Posteo Fiscal**: ❌ No implementado

---

## 2. ARQUITECTURA DE DATOS

### 2.1 Modelos Encontrados ✅

| Tabla | Archivo | Propósito |
|---|---|---|
| `restaurant_tables` | `models/restaurant.py:36` | Mesas del salón (nombre, zona, capacidad, estado) |
| `restaurant_orders` | `models/restaurant.py:53` | Órdenes (vinculadas a mesa o takeout) |
| `restaurant_order_items` | `models/restaurant.py:80` | Ítems individuales (plato, cantidad, notas, estado KDS) |
| `restaurant_recipes` | `models/restaurant.py:104` | Escandallo (ingredientes por plato) |
| `restaurant_menu_sections` | `models/restaurant.py:115` | Secciones del menú |
| `restaurant_menu_items` | `models/restaurant.py:125` | Ítems con alias y price_override |

### 2.2 Relaciones con Inventario

```
Product (plato) ←──recipe──→ Product (ingrediente)
     │                            │
     ↓                            ↓
RestaurantOrderItem          → Desconta Stock via Kardex
     │                           
     ↓                           
SaleItem → Sale → checkout → SalesService.create_sale()
                                 │
                                 ↓
                    ¿Recipe existe? → SÍ: desconta ingredientes
                                      → NO: desconta producto directamente
```

**Archivo:** `services/sales_service.py:314-385`

### 2.3 Diagramas Conceptuales

```
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND                                                     │
│ ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│ │ TableMap.jsx│  │KitchenDisplay│  │ RecipeEditor.jsx     │ │
│ │ (Mapa mesas)│  │  (KDS)       │  │ (Escandallo)        │ │
│ └─────────────┘  └──────────────┘  └──────────────────────┘ │
└───────────────────────────┬─────────────────────────────────┘
                            │ Axios
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ BACKEND                                                      │
│                                                              │
│  /restaurant/tables   → tables.py:17 (GET)                   │
│  /restaurant/orders/* → orders.py (full CRUD)                │
│  /restaurant/menu/*   → menu.py (menu + recipes)             │
│                                                              │
│  ┌─────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │ Models/     │    │ SalesService    │    │ PrinterService│ │
│  │ restaurant  │    │ (checkout +     │    │ (templates)   │ │
│  │ (SQLAlchemy)│    │  escandallo)    │    │              │ │
│  └─────────────┘    └─────────────────┘    └──────────────┘ │
│         │                    │                    │         │
│         ↓                    ↓                    ↓         │
│  ┌─────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │ PostgreSQL  │    │ Kardex entries   │    │ WebSocket    │ │
│  │ (multi-schema)│   │ (inventory deduction)│  (broadcast)  │ │
│  └─────────────┘    └─────────────────┘    └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. FLUJO DE COMANDAS (Kitchen Tickets)

### 3.1 Endpoint de Creación ✅

**Archivos:** `routers/modules/restaurant/orders.py:117-182`

```
POST /restaurant/orders/{order_id}/items
  → Agrega productos a la orden
  → Recalcula total_amount
  → Trigger: background task → WebSocket "print_kitchen_ticket"
```

**Flujo completo:**
1. Mesero abre mesa (`POST /restaurant/orders/open/{table_id}`)
2. Agrega items (`POST /restaurant/orders/{order_id}/items`)
3. Items se guardan con status `PENDING`
4. Mesero hace click en "Enviar a Cocina"
5. Items cambian a status `SENT`
6. KitchenDisplay (KDS) recibe via polling cada 5 segundos
7. Cocinero cambia status: PENDING → PREPARING → READY → SERVED

### 3.2 Lógica de Impresión ⚠️ INCOMPLETA

**Problema identificada:** El módulo restaurant NO tiene driver ESC/POS nativo.

**Lo que existe:**
- `PrinterService.generate_kitchen_ticket()` (`services/printer_service.py:7-52`)
  - Genera template Jinja2 para ticket de cocina
  - Solo retorna JSON con `target`, `template`, `context`
  
- Broadcasting WebSocket (`routers/websocket.py`)
  - Endpoint: `/ws/hardware/connect`
  - Solo valida tokens y retransmite

**Lo que NO existe:**
- ❌ Driver de impresoras ESC/POS (Ethernet/WiFi)
- ❌ Cola de impresión persistente
- ❌ Reintentos automáticos
- ❌ Configuración de IP de impresoras por tenant
- ❌ Hardware bridge (C# .NET) conectado al módulo restaurant

**Investigación del módulo hardware_bridge:**
```
glob **/hardware_bridge/**/* → NO ENCONTRADO
grep "hardware_bridge" → 0 resultados en el codebase
```

El proyecto menciona `hardware_bridge` en CLAUDE.md (C# .NET WPF + WebSocket ESC/POS) pero **NO existe en el código fuente auditado**. Esto es una deuda técnica crítica.

### 3.3 Estado Actual

| Aspecto | Estado | Detalle |
|---|---|---|
| Crear orden | ✅ | Endpoint existe |
| Agregar items | ✅ | Soporta notas y cantidad |
| Enviar a cocina | ✅ | Status PENDING → SENT |
| Pantalla KDS | ✅ | KitchenDisplay.jsx con polling 5s |
| Impresión real | ❌ | Solo broadcasting, sin driver |
| WebSocket kitchen | ⚠️ | Parcial (broadcast-only) |

---

## 4. SISTEMA DE RECETAS

### 4.1 Modelo Recipe ✅

**Archivo:** `models/restaurant.py:104-113`

```python
class RestaurantRecipe(Base):
    __tablename__ = "restaurant_recipes"
    id            = Column(Integer, primary_key=True)
    product_id    = Column(Integer, ForeignKey("products.id"))  # El Plato
    ingredient_id = Column(Integer, ForeignKey("products.id"))  # El Ingrediente
    quantity      = Column(Numeric(12, 3))                       # Cantidad por plato
```

### 4.2 Descuento de Inventario ✅

**Archivo:** `services/sales_service.py:314-385`

La lógica centralizada:
1. Al procesar cada item de venta, consulta `RestaurantRecipe` por `product_id`
2. Si existe receta → itera ingredientes → `qty_to_deduct = item.quantity * recipe_item.quantity`
3. Valida stock de cada ingrediente
4. Genera movimiento `Kardex` con descripción: `"Venta via Receta: {product.name} (Venta #{sale_id})"`

**Para el cliente (pollo asado):**
```
Vender 1 Pollo Asado
  → Receta: 1 Pollo entero, 1 pacote de especias, 0.5 lt aceite
  → Desconta: 1 unidad de producto "Pollo entero"
  → Desconta: 1 unidad de producto "Especias para pollo"
```

### 4.3 Variantes (medio pollo, pizza grande) ❌ NO IMPLEMENTADO

**Problema identificado:** No existe modelo para modificadores de productos.

El cliente necesita:
- Pollo entero vs medio pollo
- Pizza mediana vs grande
- Toppings extras

**Lo que existe:**
- `quantity` Decimal permite decimales (ej: 0.5 para medio pollo) ✅
- `RestaurantRecipe.quantity` es `Numeric(12, 3)` ✅

**Lo que NO existe:**
- ❌ `product_modifiers` o `modifier_groups`
- ❌ Tabla de variantes/tamaños
- ❌ Precio diferenciado por variante
- ❌ Ingredientes variables por tamaño

**Impacto:** Si el cliente vende "media pizza" con diferentes ingredientes que "pizza completa", el sistema actual no lo soporta. Debería crearse una tabla `restaurant_product_modifiers`.

---

## 5. MANEJO DE MESAS

### 5.1 Modelo Table ✅

**Archivo:** `models/restaurant.py:36-51`

```python
class RestaurantTable(Base):
    __tablename__ = "restaurant_tables"
    id       = Column(Integer, primary_key=True)
    name     = Column(String)  # "Mesa 1", "Barra 3"
    zone     = Column(String, index=True)  # "Terraza", "Salón Principal"
    capacity = Column(Integer, default=4)
    status   = Column(Enum(TableStatusDB))  # AVAILABLE, OCCUPIED, RESERVED, CLEANING
    is_active = Column(Boolean, default=True)
```

### 5.2 Cuentas Abiertas ✅

El sistema soporta:
- Múltiples productos por orden
- Actualización incremental de `total_amount`
- Checkout parcial no soportado (una orden = una cuenta)

**Flujo de checkout:**
1. Orden con múltiples items
2. `POST /restaurant/orders/{order_id}/checkout`
3. `SalesService.create_sale()` genera la venta
4. Mesa queda libre

### 5.3 Funcionalidades de split/move ✅

**Archivos:**
- `MoveTableModal.jsx` → Mover orden a otra mesa
- `SplitCheckModal.jsx` → Dividir cuenta por items

**Endpoints:** `POST /restaurant/orders/{order_id}/move` y `POST /restaurant/orders/{order_id}/split`

### 5.4 Estado Actual

| Aspecto | Estado | Detalle |
|---|---|---|
| CRUD mesas | ✅ | tables.py:17-78 |
| Mapa interactivo | ✅ | TableMap.jsx con auto-refresh 10s |
| Estados de mesa | ✅ | AVAILABLE, OCCUPIED, RESERVED, CLEANING |
| Órdenes Takeout | ✅ | `is_takeout=True`, `customer_name` opcional |
| Mover mesa | ✅ | Endpoint existe |
| Dividir cuenta | ✅ | Split por item y cantidad |

---

## 6. IMPRESIÓN

### 6.1 Soporte ESC/POS ❌ NO IMPLEMENTADO

**Hallazgo crítico:** El sistema NO tiene driver ESC/POS para impresoras WiFi/Ethernet.

**Lo que existe:**
- `PrinterService` genera templates Jinja2 (`services/printer_service.py:7-52`)
- `WebSocketManager` retransmite eventos broadcast (`routers/websocket.py`)
- Endpoint `/ws/hardware/connect` para "hardware bridge"

**Lo que NO existe:**
- Driver de comunicación con impresoras ESC/POS (Ethernet)
- Cola de impresión con reintentos
- Configuración de impresoras por tenant (IP, nombre)
- El módulo `hardware_bridge` mencionado en CLAUDE.md

### 6.2 Impresoras WiFi ⚠️ NO VERIFICADO

El proyecto menciona en CLAUDE.md:
> "Hardware Bridge: C# .NET WPF + WebSocket ESC/POS"

**Sin embargo:**
- La carpeta `hardware_bridge/` NO existe en el codebase auditado
- Los endpoints de impresión solo generan JSON, no envían a impresoras
- El flujo completo de impresión requiere desarrollo adicional

### 6.3 Estado Actual

| Aspecto | Estado | Notas |
|---|---|---|
| Template kitchen ticket | ✅ | PrinterService genera el template |
| Template pre-cuenta | ✅ | Genera ticket pro-forma |
| Envío a cocina | ⚠️ | Solo broadcasting WebSocket |
| Impresión real | ❌ | Sin driver, sin cola, sin IP config |
| Hardware bridge | ❌ | No existe en código |

---

## 7. MULTI-MÓDULO (Restaurante + Víveres)

### 7.1 Feature Flags ✅

**Archivo:** `models/tenant.py:31`

```python
has_restaurant_module = Column(Boolean, default=False)
```

**Dependencia protegida:** `dependencies.py:173-186`
```python
def require_restaurant_module(db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.schema_name == current_schema).first()
    if not tenant or not tenant.has_restaurant_module:
        raise HTTPException(status_code=403, detail="Restaurant module is disabled")
```

**Activación automática:** `services/tenant_service.py` detecta palabras clave:
- "Restaurant", "Comida", "Pizza", "Café", "Helado", "Panadería" → activa `has_restaurant_module`

### 7.2 Cómo Coexisten ✅

El mismo tenant puede tener:
- `has_restaurant_module = True` → módulo restaurante visible
- Productos con categoría "Restaurante" y productos de víveres
- Inventario unificado con Kardex

**Detalle:** Los productos son únicos. Una "Pizza" y un "Tornillo" conviven en la misma tabla `products`. La diferencia es si tienen `RestaurantRecipe` (escandallo) o no.

### 7.3 Estado Actual

| Aspecto | Estado |
|---|---|
| Feature flag `has_restaurant_module` | ✅ |
| Activación por palabras clave | ✅ |
| Múltiples módulos por tenant | ✅ |
| Inventario unificado | ✅ |
| Menú digital por sección | ✅ |

---

## 8. DEUDA TÉCNICA Y FALTANTES

### 8.1 Funcionalidades Faltantes Críticas

| # | Funcionalidad | Prioridad | Impacto |
|---|---|---|---|
| 1 | **Driver ESC/POS para impresoras WiFi** | 🔴 CRÍTICA | No se puede imprimir comandas de cocina |
| 2 | **Configuración de impresoras por tenant** | 🔴 CRÍTICA | Sin IPs, sin modelo de impresoras |
| 3 | **Modificador de productos (tamaños/variantes)** | 🟠 ALTA | No soporta "medio pollo" vs "pollo entero" con precios distintos |
| 4 | **Facturación fiscal (IVA/impuesto)** | 🟠 ALTA | Venezuela requiere facturación fiscal |
| 5 | **Reservaciones con anticipo** | 🟡 MEDIA | No hay booking ni depósito por reserva |

### 8.2 Bugs Identificados

| # | Archivo | Línea | Problema |
|---|---|---|---|
| B1 | `services/sales_service.py:329` | El cálculo `qty_to_deduct = item.quantity * recipe_item.quantity` multiplica quantities sin verificar que `item.quantity` sea el total vendido vs cantidad en esta transacción específica (el mismo item puede aparecer múltiples veces) |
| B2 | `routers/modules/restaurant/menu.py:66` | Usa `.dict()` deprecated en Pydantic v2, debería ser `.model_dump()` |
| B3 | `frontend_web/src/pages/Restaurant/RecipeEditor.jsx:211` | Llama `handleRemoveItem(item.id)` pero la función se llama `handleRemoveIngredient(id)` en línea 68 — **BUG** |

### 8.3 Migraciones Pendientes

- `2abfc9e544a2_add_takeout_support_to_restaurant_orders.py` ✅ Aplicada
- No hay migraciones pendientes para restaurant (no se encontraron archivos `alembic/versions/*restaurant*` adicionales)

### 8.4 Deuda Técnica Conocida

```
❌ Sin módulo hardware_bridge (C# .NET no existe en codebase)
❌ Sin driver ESC/POS
❌ Sin modelo de modificadores de producto
❌ Sin facturación fiscal
⚠️ RecipeEditor.jsx tiene bug en remove ingredient (línea 211)
⚠️ menu.py usa .dict() en vez de .model_dump()
```

---

## 9. RECOMENDACIONES

### 9.1 ¿Está Listo para el Cliente?

**Respuesta: NO para restaurante profesional, SÍ para prueba de concepto.**

| Criterio | Listo? | Nota |
|---|---|---|
| Ventas mostrador/takeout | ✅ | Funcional |
| Manejo de mesas | ✅ | Funcional |
| KDS (cocina) | ✅ | Polling cada 5s funciona |
| Descuento inventario (recetas) | ✅ | Validado en código |
| Impresión WiFi cocina | ❌ | Sin driver |
| Variantes producto (tamaños) | ❌ | No existe |
| Facturación fiscal | ❌ | No existe |
| Reservaciones | ❌ | No existe |

**El cliente (pollo asado, pizza, víveres) necesita:**
1. Impresión WiFi para cocina → **CRÍTICO**
2. Soporte "medio pollo" → modificar modelo o crear modificadores

### 9.2 Qué Desarrollar Primero

**Orden de prioridad:**

1. **🔴 Driver ESC/POS** (2-3 semanas)
   - Crear tabla `printers` (tenant_id, name, ip_address, type: kitchen/cashier)
   - Implementar `EscPosPrinterService` con socket TCP
   - Integrar con `PrinterService.generate_kitchen_ticket()`
   - Endpoint CRUD de impresoras

2. **🟠 Modificador de productos** (1-2 semanas)
   - Crear tabla `restaurant_product_modifiers` (product_id, name, price_adjustment, is_default)
   - O usar la misma tabla `restaurant_recipes` con tipo (base vs modifier)
   - Actualizar OrderModal para mostrar selector de variante

3. **🟡 Bug fixes** (1 día)
   - Corregir RecipeEditor.jsx línea 211
   - Actualizar menu.py a .model_dump()

### 9.3 Timeline Estimado

| Fase | Duración | Entregable |
|---|---|---|
| Fase 1: Driver ESC/POS | 2-3 semanas | Impresión WiFi operativa |
| Fase 2: Modificadores | 1-2 semanas | Soporte variantes (medio pollo) |
| Fase 3: Bug fixes | 1 día | Código limpio |
| **Total** | **3-5 semanas** | Módulo producción-ready |

---

## 10. CHECKLIST DE PRODUCCIÓN

### Funcionalidades Core

| # | Requisito | Estado | Archivo/Nota |
|---|---|---|---|
| ✅ | Modelo RestaurantTable existe | ✅ | `models/restaurant.py:36` |
| ✅ | Modelo RestaurantOrder existe | ✅ | `models/restaurant.py:53` |
| ✅ | Modelo RestaurantOrderItem existe | ✅ | `models/restaurant.py:80` |
| ✅ | Modelo RestaurantRecipe existe | ✅ | `models/restaurant.py:104` |
| ✅ | Crear orden restaurante → endpoint existe | ✅ | `POST /restaurant/orders/open/{table_id}` |
| ✅ | Agregar items a orden | ✅ | `POST /restaurant/orders/{order_id}/items` |
| ✅ | Enviar a cocina (cambiar status) | ✅ | `PUT /restaurant/orders/items/{id}/status` |
| ✅ | Manejo de mesas → existe modelo | ✅ | `RestaurantTable` con status enum |
| ✅ | Cuenta abierta → funcionalidad | ✅ | `total_amount` actualizado incrementalmente |
| ✅ | Dividir cuenta | ✅ | `POST /restaurant/orders/{order_id}/split` |
| ✅ | Mover mesa | ✅ | `POST /restaurant/orders/{order_id}/move` |
| ✅ | Checkout genera Sale | ✅ | `POST /restaurant/orders/{order_id}/checkout` → `SalesService.create_sale` |
| ✅ | Feature flag `has_restaurant_module` | ✅ | `models/tenant.py:31`, `dependencies.py:173` |

### Descuento de Inventario (Escandallo)

| # | Requisito | Estado | Archivo/Nota |
|---|---|---|---|
| ✅ | Recipe con ingredientes → descuento automático | ✅ | `services/sales_service.py:314-385` |
| ✅ | Si NO hay recipe → descuenta producto | ✅ | Línea 383-385: `pass` (skip dish deduction) |
| ✅ | Soporte cantidad decimal (0.5) | ✅ | `quantity = Column(Numeric(12, 3))` |
| ✅ | Genera Kardex por ingrediente | ✅ | Línea 362-370 |

### Menú Digital

| # | Requisito | Estado | Archivo/Nota |
|---|---|---|---|
| ✅ | Menu sections | ✅ | `RestaurantMenuSection` |
| ✅ | Menu items con alias y price_override | ✅ | `RestaurantMenuItem` |
| ✅ | GET /restaurant/menu/full | ✅ | `menu.py:21-62` |

### KDS (Kitchen Display System)

| # | Requisito | Estado | Archivo/Nota |
|---|---|---|---|
| ✅ | GET /restaurant/orders/kitchen/pending | ✅ | `orders.py:186-219` |
| ✅ | Polling cada 5s | ✅ | `KitchenDisplay.jsx:78` |
| ✅ | Sonido de alerta | ✅ | `KitchenDisplay.jsx:22-53` |
| ✅ | Estados: PENDING → PREPARING → READY → SERVED | ✅ | `OrderItemStatusDB` enum |
| ✅ | Urgencia por tiempo (>10min warning, >20min critical) | ✅ | `KitchenDisplay.jsx:112-138` |

### Impresión ⚠️ PARCIAL

| # | Requisito | Estado | Archivo/Nota |
|---|---|---|---|
| ⚠️ | Template comanda cocina | ✅ | `PrinterService.generate_kitchen_ticket()` |
| ⚠️ | Template pre-cuenta | ✅ | `PrinterService.generate_pre_check_ticket()` |
| ❌ | Driver ESC/POS (WiFi/Ethernet) | ❌ | NO EXISTE |
| ❌ | Configuración IP impresoras | ❌ | NO EXISTE |
| ❌ | Cola de impresión con reintentos | ❌ | NO EXISTE |
| ❌ | Hardware bridge (C# .NET) | ❌ | NO EXISTE |

### Multi-Módulo

| # | Requisito | Estado | Archivo/Nota |
|---|---|---|---|
| ✅ | Feature flag `has_restaurant_module` | ✅ | `models/tenant.py:31` |
| ✅ | Protección `require_restaurant_module` | ✅ | `dependencies.py:173` |
| ✅ | Activación automática por keywords | ✅ | `tenant_service.py:64-78` |
| ✅ | Productos únicos (plato + víveres) | ✅ | Misma tabla products |

---

## RESUMEN DE HALLAZGOS

| Categoría | Total | CRÍTICA | ALTA | MEDIA |
|---|---|---|---|---|
| Seguridad | 0 | 0 | 0 | 0 |
| Arquitectura | 0 | 0 | 0 | 0 |
| Impresión | 3 | 1 | 2 | 0 |
| Variantes/Modificadores | 1 | 0 | 1 | 0 |
| Bugs | 2 | 0 | 1 | 1 |
| **TOTAL** | **6** | **1** | **4** | **1** |

### 🔴 CRÍTICA: Impresión WiFi inexistente
El módulo restaurant NO puede imprimir en impresoras de cocina reales. Se requiere desarrollar driver ESC/POS y configuración de impresoras por tenant.

### 🟠 ALTA: Sin soporte para modificadores/variantes de productos
No existe forma de vender "medio pollo" vs "pollo entero" con precios y recetas diferentes. El modelo `RestaurantRecipe` solo soporta una receta fija por producto.

### 🟠 ALTA: Menú usa .dict() deprecated
En `menu.py:66` se usa `.dict()` que está deprecado en Pydantic v2. Debe cambiarse a `.model_dump()`.

### 🟠 ALTA: Bug en RecipeEditor.jsx línea 211
Llama `handleRemoveItem(item.id)` pero la función se llama `handleRemoveIngredient(id)`. El botón de eliminar NO funcionará.

### 🟡 MEDIA: Multiplicación de quantities en recipe
La línea `qty_to_deduct = item.quantity * recipe_item.quantity` en `sales_service.py:329` multiplica el quantity total de la venta por la cantidad de receta, sin considerar si el item ya fue dividido por split. Podría causar deducciones incorrectas en casos edge.

---

## ARCHIVOS AFECTADOS

| Prioridad | Archivo | Cambio Necesario |
|---|---|---|
| 🔴 CRÍTICA | `services/printer_service.py` | Crear driver ESC/POS TCP |
| 🔴 CRÍTICA | Nuevo archivo | `services/escpos_printer.py` (crear) |
| 🟠 ALTA | `frontend_web/src/pages/Restaurant/RecipeEditor.jsx:211` | Cambiar `handleRemoveItem` → `handleRemoveIngredient` |
| 🟠 ALTA | `backend_api/routers/modules/restaurant/menu.py:66` | `.dict()` → `.model_dump()` |
| 🟠 ALTA | Nuevo archivo | Tabla `printers` (ip, name, tenant_id) + CRUD endpoints |
| 🟡 MEDIA | `backend_api/services/sales_service.py:329` | Considerar validación extra en multiplicación de quantities |