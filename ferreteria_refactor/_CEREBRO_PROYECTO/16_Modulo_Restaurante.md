# 16 - Módulo de Restaurante (Operativo - Fases 1 a 5 Completadas)

## ✅ Estado Actual: Operativo y Estable
El módulo de restaurante ha sido completamente rediseñado y está operativo. Soporta gestión de mesas, órdenes, takeout (para llevar), pantalla de cocina (KDS), menú digital, escandallo (recetas) y deducción automática de inventario.

---

## 🏗️ Arquitectura de Datos (PostgreSQL)

### Tablas del Módulo

| Tabla | Propósito |
|---|---|
| `restaurant_tables` | Mesas del salón (nombre, zona, capacidad, estado) |
| `restaurant_orders` | Órdenes activas o históricas (vinculadas a mesa o takeout) |
| `restaurant_order_items` | Ítems individuales de cada orden (plato, cantidad, notas, estado KDS) |
| `restaurant_recipes` | Escandallo: asocia un plato con sus ingredientes y cantidades |
| `restaurant_menu_sections` | Secciones del menú (Entradas, Platos Fuertes, Postres, etc.) |
| `restaurant_menu_items` | Ítems del menú organizados por sección, con alias y precio override |

### Modelo: `RestaurantOrder`
```python
class RestaurantOrder(Base):
    __tablename__ = "restaurant_orders"
    id           = Column(Integer, primary_key=True)
    table_id     = Column(Integer, ForeignKey("restaurant_tables.id"), nullable=True) # NULL = Takeout
    waiter_id    = Column(Integer, ForeignKey("public.users.id"), nullable=True)
    is_takeout   = Column(Boolean, default=False)
    customer_name= Column(String, nullable=True)         # Nombre del cliente (Takeout)
    status       = Column(Enum(OrderStatusDB))            # PENDING | PREPARING | READY | DELIVERED | PAID | CANCELLED
    total_amount = Column(Numeric(12, 2), default=0.00)
    sale_id      = Column(Integer, ForeignKey("sales.id"), nullable=True) # Vinculación al checkout
    created_at   = Column(DateTime)
    updated_at   = Column(DateTime)
```

### Modelo: `RestaurantRecipe` (Escandallo)
```python
class RestaurantRecipe(Base):
    __tablename__ = "restaurant_recipes"
    id            = Column(Integer, primary_key=True)
    product_id    = Column(Integer, ForeignKey("products.id"))   # El Plato (ej: Hamburguesa)
    ingredient_id = Column(Integer, ForeignKey("products.id"))   # El Ingrediente (ej: Pan)
    quantity      = Column(Numeric(12, 3))                       # Cantidad a descontar por plato
```

---

## 🔄 Flujo Operativo

### A. Apertura de Orden (Mesa o Takeout)
1. **Mesa**: El mesero selecciona una mesa disponible en el mapa interactivo → La mesa pasa a estado `OCCUPIED`.
2. **Takeout**: Se selecciona el botón "Para Llevar" → Se crea una orden sin `table_id`, con campo `customer_name` opcional.

### B. Gestión de Ítems y KDS
1. El mesero agrega ítems a la orden seleccionando productos del catálogo.
2. Cada ítem registra su `status` individual para la pantalla de cocina (KDS):
   - `PENDING` → `SENT` → `PREPARING` → `READY` → `SERVED`
3. La pantalla de cocina muestra las órdenes activas con diferenciación visual entre Mesa y Takeout.

### C. Checkout (Cierre de Cuenta)
1. Al cerrar la orden, se genera una `Sale` (venta) en el sistema central.
2. El endpoint `/checkout` acepta pagos multimoneda y métodos mixtos.
3. La orden se vincula a la venta mediante `sale_id`.
4. La mesa regresa a estado `AVAILABLE`.

### D. Deducción de Inventario (Escandallo)
Lógica centralizada en `SalesService.create_sale`:
1. Al procesar una venta, el sistema busca `RestaurantRecipe` asociadas a cada producto vendido.
2. **Si existe receta**: Se deducen los **ingredientes** (no el plato en sí).
   - Ejemplo: Vender 1 Hamburguesa → Deduce 1 Pan, 1 Carne, 1 Lechuga (según receta).
3. **Si NO existe receta**: Se deduce el **producto directamente** del inventario.
4. Cada deducción genera un movimiento de `Kardex` para trazabilidad completa.

---

## 📋 Menú Digital

### Estructura
- **Secciones** (`restaurant_menu_sections`): Agrupaciones lógicas (Entradas, Platos Fuertes, Bebidas, Postres).
- **Ítems** (`restaurant_menu_items`): Productos vinculados a una sección, con posibilidad de:
  - `alias`: Nombre alternativo para el menú (ej: "Burger Clásica" en vez del nombre técnico del producto).
  - `price_override`: Precio especial solo para el menú del restaurante.
  - `sort_order`: Orden de aparición personalizable.

### Endpoints
| Método | Endpoint | Propósito |
|---|---|---|
| GET | `/api/v1/restaurant/menu` | Obtener menú completo con secciones e ítems |
| POST | `/api/v1/restaurant/menu/sections` | Crear sección del menú |
| POST | `/api/v1/restaurant/menu/items` | Agregar ítem al menú |
| PUT | `/api/v1/restaurant/menu/items/{id}` | Editar ítem del menú |
| DELETE | `/api/v1/restaurant/menu/items/{id}` | Eliminar ítem del menú |

---

## 🔧 Endpoints del Módulo

| Método | Endpoint | Propósito |
|---|---|---|
| GET | `/api/v1/restaurant/tables` | Listar mesas con estado actual |
| POST | `/api/v1/restaurant/tables` | Crear/editar mesa |
| POST | `/api/v1/restaurant/orders/open` | Abrir orden para mesa |
| POST | `/api/v1/restaurant/orders/open_takeout` | Abrir orden para llevar |
| POST | `/api/v1/restaurant/orders/{id}/items` | Agregar ítems a orden |
| PUT | `/api/v1/restaurant/orders/items/{id}/status` | Actualizar estado KDS de un ítem |
| POST | `/api/v1/restaurant/orders/{id}/checkout` | Cerrar cuenta y generar venta |
| GET | `/api/v1/restaurant/orders/kitchen` | Vista de cocina (KDS) |

---

## 📂 Archivos Clave

| Archivo | Rol |
|---|---|
| `backend_api/models/restaurant.py` | Modelos SQLAlchemy del módulo |
| `backend_api/schemas/restaurant.py` | Esquemas Pydantic de validación |
| `backend_api/routers/modules/restaurant/tables.py` | Endpoints de mesas |
| `backend_api/routers/modules/restaurant/orders.py` | Endpoints de órdenes y checkout |
| `backend_api/routers/modules/restaurant/menu.py` | Endpoints del menú digital |
| `backend_api/services/sales_service.py` | Lógica centralizada de deducción de inventario (incluye escandallo) |
| `frontend_web/src/pages/Restaurant/TableMap.jsx` | Mapa interactivo de mesas (auto-refresh 10s) |
| `frontend_web/src/pages/Restaurant/KitchenDisplay.jsx` | Pantalla de cocina (KDS) |

---

> [!NOTE]
> La deducción de inventario es **exclusiva** de `SalesService.create_sale`. El router de órdenes (`orders.py`) NO realiza deducción directa, manteniendo la lógica centralizada y coherente con el resto del sistema.
