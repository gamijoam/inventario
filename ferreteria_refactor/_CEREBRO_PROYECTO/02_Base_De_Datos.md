# 02 - Base de Datos y Modelado (Esquemas y SQL)

Este documento detalla la estructura lógica y física de la base de datos PostgreSQL de **Mi Inventario Fácil**, detallando el modelo relacional y las estrategias de aislamiento para múltiples industrias.

## 1. Estrategia de Esquemas y Multi-Tenancy

El sistema opera bajo un modelo de **Aislamiento por Esquema Híbrido**:
1.  **Esquema `public`**: Aloja las entidades globales (Tenants, Users, Logs de Auditoría Global).
2.  **Esquemas Tenant**: Cada cliente tiene un esquema físico (ej. `tienda_repuestos`) donde residen las tablas de operación diaria (Ventas, Inventario, Caja).

## 2. Modelos Globales de Infraestructura (Esquema `public`)

### A. Registro de Empresas (Tenants)
Controla el acceso y las licencias de uso de la plataforma para diversos rubros (Ferreterías, Repuestos, Servicios, Lavandería).
```python
class Tenant(Base):
    __tablename__ = "tenants"
    __table_args__ = {"schema": "public"}
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    schema_name = Column(String, unique=True, index=True, nullable=False) # El slug para search_path
    is_active = Column(Boolean, default=True)
    is_demo = Column(Boolean, default=True)
    subscription_expires_at = Column(DateTime, nullable=True)
    # Configuración de Módulos (Feature Flags)
    config = Column(JSON, default=dict) # {"restaurant": false, "laundry": true, "services": true}
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

### A. Gestión Financiera (Caja y Efectivo)
```python
class CashSession(Base):
    __tablename__ = "cash_sessions"
    id = Column(Integer, primary_key=True, index=True)
    status = Column(String, default="OPEN") # OPEN, CLOSED
    initial_cash = Column(Numeric(18, 4)) # Saldo inicial en USD
    initial_cash_bs = Column(Numeric(18, 4)) # Saldo inicial en Bolívares
    start_time = Column(DateTime, default=datetime.now)
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

### D. Restaurante (Mesas y Órdenes)
```python
class RestaurantOrder(Base):
    __tablename__ = "restaurant_orders"
    id = Column(Integer, primary_key=True)
    table_id = Column(Integer, ForeignKey("restaurant_tables.id"), nullable=True) # NULL para Takeout
    is_takeout = Column(Boolean, default=False)
    customer_name = Column(String, nullable=True)
    status = Column(String, default="OPEN") # OPEN, CLOSED, CANCELLED
    created_at = Column(DateTime, server_default=func.now())
```

## 4. Índices y Optimización de Consultas

*   **Índices Compuestos**: Mejoran el rendimiento en consultas de stock por almacén.
*   **Búsqueda Global**: El esquema `public` permite el login instantáneo centralizado.
*   **Case Insensitivity**: Índices `UPPER()` en nombres de productos y clientes para búsquedas ágiles en POS.
