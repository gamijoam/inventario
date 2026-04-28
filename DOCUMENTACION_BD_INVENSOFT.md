# 📂 Documentación Técnica: Estructura de Base de Datos - Invensoft ERP

Este documento contiene la auditoría completa de la base de datos de Invensoft, diseñada para ser visualizada en [dbdiagram.io](https://dbdiagram.io/).

---

## 1. Código DBML para dbdiagram.io (Copia este bloque)

```dbml
// ======================================================
// INVENSOFT MASTER DATABASE SCHEMA (Auditado 2026)
// ======================================================

Project Invensoft_ERP {
  database_type: 'PostgreSQL'
  Note: 'Arquitectura Multi-Tenant SaaS con módulos verticales.'
}

// ------------------------------------------------------
// 🌐 NÚCLEO SAAS (ESQUEMA PUBLIC)
// ------------------------------------------------------

Table public.tenants {
  id int [pk, increment]
  name varchar
  schema_name varchar [unique]
  domain varchar
  license_type varchar [default: "trial"]
  subscription_expires_at datetime
  config json // {"restaurant": true, "pharmacy": false}
  business_type varchar
  has_restaurant_module boolean
  has_pharmacy_module boolean
  has_hardware_module boolean
  has_services_module boolean
  has_barbershop_module boolean
}

Table public.users {
  id int [pk, increment]
  username varchar
  email varchar [unique]
  password_hash varchar
  pin varchar [note: "PIN para autorizaciones rápidas"]
  role varchar // ADMIN, CASHIER, WAITER, TECHNICIAN
  tenant_id int [ref: > public.tenants.id]
  commission_vendor_pct numeric
  commission_technician_pct numeric
  is_active boolean [default: true]
}

// ------------------------------------------------------
// 📦 INVENTARIO, ALMACÉN Y KARDEX (ESQUEMA PRIVADO TENANT)
// ------------------------------------------------------

Table products {
  id int [pk, increment]
  name varchar
  sku varchar [unique]
  price numeric
  cost_price numeric
  stock numeric
  min_stock numeric
  category_id int [ref: > categories.id]
  supplier_id int [ref: > suppliers.id]
  is_combo boolean
  is_service boolean
  has_imei boolean
  unit_type varchar
  tax_rate numeric
}

Table categories {
  id int [pk, increment]
  name varchar
  parent_id int [ref: > categories.id]
}

Table suppliers {
  id int [pk, increment]
  name varchar [unique]
  current_balance numeric
  credit_limit numeric
}

Table warehouses {
  id int [pk, increment]
  name varchar [unique]
  address varchar
  is_active boolean
  is_main boolean
}

Table product_stocks {
  id int [pk, increment]
  product_id int [ref: > products.id]
  warehouse_id int [ref: > warehouses.id]
  quantity numeric
}

Table product_units {
  id int [pk, increment]
  product_id int [ref: > products.id]
  unit_name varchar
  conversion_factor numeric
}

Table kardex {
  id int [pk, increment]
  product_id int [ref: > products.id]
  movement_type varchar // PURCHASE, SALE, ADJUSTMENT
  quantity numeric
  balance_after numeric
  warehouse_id int [ref: > warehouses.id]
}

// ------------------------------------------------------
// 🛒 VENTAS, CRÉDITO Y CAJA (ESQUEMA PRIVADO TENANT)
// ------------------------------------------------------

Table customers {
  id int [pk, increment]
  name varchar
  id_number varchar
  credit_limit numeric
}

Table sales {
  id int [pk, increment]
  date datetime
  total_amount numeric
  currency varchar
  exchange_rate_used numeric
  customer_id int [ref: > customers.id]
  is_credit boolean
  paid boolean
  session_id int [ref: > cash_sessions.id]
  warehouse_id int [ref: > warehouses.id]
}

Table sale_details {
  id int [pk, increment]
  sale_id int [ref: > sales.id]
  product_id int [ref: > products.id]
  quantity numeric
  unit_price numeric
  unit_id int [ref: > product_units.id]
}

Table cash_sessions {
  id int [pk, increment]
  user_id int [ref: > public.users.id]
  register_id int [ref: > cash_registers.id]
  status varchar // OPEN, CLOSED
  initial_cash numeric
}

Table cash_registers {
  id int [pk, increment]
  name varchar
  code varchar [unique]
  hardware_client_id varchar
}

// ------------------------------------------------------
// 🍽️ RESTAURANTE Y COCINA (ESQUEMA PRIVADO TENANT)
// ------------------------------------------------------

Table restaurant_tables {
  id int [pk, increment]
  name varchar
  zone varchar
  status varchar
}

Table restaurant_orders {
  id int [pk, increment]
  table_id int [ref: > restaurant_tables.id]
  waiter_id int [ref: > public.users.id]
  status varchar
  sale_id int [ref: - sales.id]
}

Table restaurant_order_items {
  id int [pk, increment]
  order_id int [ref: > restaurant_orders.id]
  product_id int [ref: > products.id]
  quantity numeric
  status varchar
}

Table restaurant_recipes {
  id int [pk, increment]
  product_id int [ref: > products.id]
  ingredient_id int [ref: > products.id]
  quantity numeric
}

// ------------------------------------------------------
// 🛠️ TALLER, SERVICIOS Y GARANTÍAS (ESQUEMA PRIVADO TENANT)
// ------------------------------------------------------

Table service_orders {
  id int [pk, increment]
  ticket_number varchar [unique]
  customer_id int [ref: > customers.id]
  technician_id int [ref: > public.users.id]
  status varchar
}

Table product_lots {
  id int [pk, increment]
  product_id int [ref: > products.id]
  lot_number varchar
  expiry_date date
}

Table commission_logs {
  id int [pk, increment]
  user_id int [ref: > public.users.id]
  amount numeric
  status varchar
  sale_id int [ref: > sales.id]
}
```

---

## 2. Análisis de la Arquitectura

### Multi-Tenancy (Aislamiento Total)
El sistema utiliza **Esquemas de PostgreSQL**. 
- **Esquema `public`**: Solo infraestructura SaaS (`tenants`, `users`).
- **Esquema `tenant`**: Todo el corazón del negocio (`warehouses`, `products`, `sales`, `cash_sessions`, etc.).

Este diseño garantiza que los inventarios y cajas de diferentes negocios nunca se mezclen, permitiendo que cada cliente tenga su propia configuración de almacenes y proveedores.

### Flujo de Venta Unificado
Todas las operaciones (Restaurante, Taller, POS) terminan en la tabla `sales`, centralizando el control financiero en el esquema privado de cada cliente.

---
**Generado por Gemini CLI**
