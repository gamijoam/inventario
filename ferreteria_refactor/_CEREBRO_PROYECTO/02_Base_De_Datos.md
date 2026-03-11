# 02 - Base de Datos y Modelado (Esquemas y SQL)

Este documento detalla la estructura lógica y física de la base de datos PostgreSQL de **Mi Inventario Fácil**, detallando el modelo relacional y las estrategias de aislamiento para múltiples industrias.

> [!IMPORTANT]
> El sistema opera **exclusivamente con PostgreSQL**. No se utiliza SQLite en ningún entorno (desarrollo, pruebas o producción). Toda la lógica de `db.py` y `tenant_service.py` es específica para PostgreSQL.

## 1. Estrategia de Esquemas y Multi-Tenancy

El sistema opera bajo un modelo de **Aislamiento por Esquema Híbrido**:
1.  **Esquema `public`**: Aloja las entidades globales (Tenants, Users, Logs de Auditoría Global).
2.  **Esquemas Tenant**: Cada cliente tiene un esquema físico (ej. `tienda_repuestos`) donde residen las tablas de operación diaria (Ventas, Inventario, Caja).

### Cambio de Esquema (`search_path`)
El cambio de contexto se realiza exclusivamente en `get_db()` (`database/db.py`):
```python
db.execute(text(f'SET search_path TO "{schema}", public'))
```
- Al finalizar la petición, se resetea a `public` para evitar fugas de datos entre tenants.
- Si falla el cambio de esquema, se lanza `RuntimeError` con el detalle exacto del error de PostgreSQL.

## 2. Modelos Globales de Infraestructura (Esquema `public`)

### A. Registro de Empresas (Tenants)
Controla el acceso, licencias y la segmentación de módulos por rubro.
```python
class Tenant(Base):
    __tablename__ = "tenants"
    __table_args__ = {"schema": "public"}
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    schema_name = Column(String, unique=True, index=True, nullable=False)
    domain = Column(String, nullable=True, unique=True)
    is_active = Column(Boolean, default=True)
    is_demo = Column(Boolean, default=True)
    subscription_expires_at = Column(DateTime, nullable=True)
    config = Column(JSON, default=dict)           # {"restaurant": true, "laundry": false}
    business_type = Column(String, nullable=True)  # Label exacto del rubro (ej: "Abasto")
    # Flags de Módulos (Sistema de Feature Flags)
    has_restaurant_module = Column(Boolean, default=False)
    has_laundry_module = Column(Boolean, default=False)
    has_hardware_module = Column(Boolean, default=False)
    has_services_module = Column(Boolean, default=False)
    has_barbershop_module = Column(Boolean, default=False)
```

### B. Gestión de Usuarios y Seguridad
Los usuarios son globales pero se vinculan a un Tenant específico.
```python
class User(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "public"}
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    pin = Column(String, nullable=True) # PIN de 4-6 dígitos para autorizaciones rápidas
    role = Column(Enum(UserRole), default=UserRole.CASHIER)
    tenant_id = Column(Integer, ForeignKey("public.tenants.id"), nullable=True)
    is_superuser = Column(Boolean, default=False) # Acceso al panel de control SaaS
```

## 3. Módulos de Operación (Esquema de la Empresa)

### A. Gestión Financiera — Sistema Multicaja

El sistema soporta **múltiples cajas registradoras físicas simultáneas**. Cada caja es independiente: puede estar abierta por distintos cajeros al mismo tiempo.

```python
class CashRegister(Base):
    """Terminal física de caja. Se crea una por defecto ('Caja Principal', C01) al crear el tenant."""
    __tablename__ = "cash_registers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)          # "Caja Principal", "Caja 2", etc.
    code = Column(String(20), nullable=False, unique=True)  # "C01", "C02"
    description = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)

class CashSession(Base):
    """Turno de caja abierto por un cajero en una caja específica."""
    __tablename__ = "cash_sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("public.users.id"), nullable=True)  # Cajero
    register_id = Column(Integer, ForeignKey("cash_registers.id"), nullable=True)  # Caja física
    status = Column(String, default="OPEN")  # OPEN, CLOSED
    initial_cash = Column(Numeric(18, 4))
    initial_cash_bs = Column(Numeric(18, 4))
    start_time = Column(DateTime, default=datetime.now)
```

**Restricción de BD**: Índice único parcial garantiza que solo haya una sesión OPEN por caja:
```sql
CREATE UNIQUE INDEX uq_{schema}_one_open_per_register
ON cash_sessions (register_id) WHERE status = 'OPEN';
```

**Campos añadidos a `Sale`:**
```python
session_id = Column(Integer, ForeignKey("cash_sessions.id"), nullable=True)
# Permite saber en qué caja/turno se realizó cada venta
```

**Campos añadidos a `Quote`:**
```python
user_id = Column(Integer, ForeignKey("public.users.id"), nullable=True)
# Registra quién creó cada cotización
```

### B. Clientes y Créditos (Ferreterías y Repuestos)
```python
class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    credit_limit = Column(Numeric(18, 2), default=0.00)
    is_blocked = Column(Boolean, default=False) 
    payment_term_days = Column(Integer, default=0) 
```

### C. Inventario y Kardex Multi-Almacén
```python
class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String, unique=True, index=True)
    is_service = Column(Boolean, default=False) # True para Servicios Técnicos o Lavandería

class Kardex(Base):
    __tablename__ = "kardex"
    id = Column(Integer, primary_key=True, index=True)
    movement_type = Column(Enum(MovementType))
    balance_after = Column(Numeric(12, 3)) 
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"))
```

### D. Restaurante (Mesas, Órdenes, Recetas y Menú)
> Documentado en detalle en `16_Modulo_Restaurante.md`

```python
class RestaurantOrder(Base):
    __tablename__ = "restaurant_orders"
    id = Column(Integer, primary_key=True)
    table_id = Column(Integer, ForeignKey("restaurant_tables.id"), nullable=True) # NULL para Takeout
    is_takeout = Column(Boolean, default=False)
    customer_name = Column(String, nullable=True)
    status = Column(String, default="OPEN")       # PENDING | PREPARING | READY | DELIVERED | PAID | CANCELLED
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=True) # Vinculación al checkout

class RestaurantRecipe(Base):
    __tablename__ = "restaurant_recipes"
    product_id = Column(Integer, ForeignKey("products.id"))    # El plato
    ingredient_id = Column(Integer, ForeignKey("products.id")) # El ingrediente
    quantity = Column(Numeric(12, 3))                          # Cantidad a descontar por unidad del plato

class RestaurantMenuSection(Base):
    __tablename__ = "restaurant_menu_sections"
    name = Column(String, nullable=False)
    sort_order = Column(Integer, default=0)

class RestaurantMenuItem(Base):
    __tablename__ = "restaurant_menu_items"
    section_id = Column(Integer, ForeignKey("restaurant_menu_sections.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    alias = Column(String, nullable=True)           # Nombre alternativo para el menú
    price_override = Column(Numeric(12, 2), nullable=True) # Precio especial del menú
```

### E. Empleados y Comisiones (Barbería)
> Documentado en detalle en `15_Modulo_Barberia.md`

## 4. Índices y Optimización de Consultas

*   **Índices Compuestos**: Mejoran el rendimiento en consultas de stock por almacén.
*   **Búsqueda Global**: El esquema `public` permite el login instantáneo centralizado.
*   **Case Insensitivity**: Índices `UPPER()` en nombres de productos y clientes para búsquedas ágiles en POS.

### Índices FK añadidos (migración `a1b2c3d4e5f6`, auditoría 2026-03-10)

| Tabla | Columna | Impacto |
|-------|---------|---------|
| `sales` | `customer_id` | JOINs con clientes |
| `sales` | `session_id` | JOINs con sesiones de caja |
| `products` | `supplier_id` | Filtros por proveedor |
| `products` | `category_id` | Filtros por categoría |
| `kardex` | `product_id` | Historial de movimientos |
| `kardex` | `warehouse_id` | Filtros por almacén |
| `product_stocks` | `product_id` | Consultas de stock |
| `product_stocks` | `warehouse_id` | Stock por almacén |

### Índices FK adicionales (migración `b2c3d4e5f6a7`)

6 índices adicionales en tablas de detalle: `SalePayment`, `SaleDetail` (x2), `CashMovement`, `ReturnDetail` (x2). Mejoran JOINs ~10x en consultas de reportes.

## 5. Provisionamiento de Esquemas de Tenant

La creación de un nuevo tenant sigue este flujo orquestado por `TenantService`:
1. Registro en `public.tenants` con segmentación inteligente de módulos basada en el rubro seleccionado.
2. `CREATE SCHEMA "{schema_name}"` en PostgreSQL.
3. **Schema Reflection**: `Base.metadata.create_all()` sobre el nuevo esquema (crea todas las tablas automáticamente).
4. **Seeding**: Se siembran datos iniciales (Admin, Tasas de Cambio, Métodos de Pago, Monedas, Almacén por defecto).
