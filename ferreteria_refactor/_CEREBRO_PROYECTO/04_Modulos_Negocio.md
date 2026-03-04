# 04 - Módulos de Negocio y Reglas Multi-Rubro

**Mi Inventario Fácil** es una plataforma versátil diseñada para adaptarse a Ferreterías, Venta de Repuestos, Restaurantes, Barberías/Salones de Belleza, Lavanderías y Servicios Técnicos.

## 1. Sistema de Segmentación por Rubros

Al registrar una empresa en el SaaS, el sistema detecta automáticamente el rubro basándose en palabras clave y activa los módulos correspondientes:

| Rubro | Módulos Activados | Palabras Clave |
|---|---|---|
| Ferretería / Retail | `has_hardware_module` | *Por defecto si no hay coincidencia* |
| Restaurante / Comida | `has_restaurant_module` | Restaurant, Comida, Pizza, Café, Helado, Panadería |
| Lavandería | `has_laundry_module` | Lavandería, Tintorería |
| Servicio Técnico | `has_services_module` | Taller, Servicio, Reparación, Electrónica |
| Barbería / Belleza | `has_barbershop_module` | Barbería, Peluquería, Belleza, Estética, Spa |

Esta lógica reside en `TenantService.create_tenant()`.

## 2. Módulos Operativos Actuales

### A. Ferretería y Venta de Repuestos
*   **Control de Stock**: Gestión de existencias por almacenes (Principal, Mostrador, Depósito).
*   **Venta a Crédito**: Bloqueo automático por facturas vencidas y límites de deuda configurables por cliente.
*   **Listas de Precios**: Múltiples listas de precios por producto (Mayor, Detal, Especial).
*   **Transferencias**: Movimiento de stock entre almacenes con trazabilidad Kardex.

### B. Servicio Técnico (Celulares / Electrónica)
*   **Recepción y Diagnóstico**: Captura detallada de dispositivos (Marca, Modelo, IMEI/Serial, Estado Visual).
*   **Abonos (Pagos Anticipados)**: Registro de pagos previos a la reparación que se descuentan automáticamente del total final en el POS.
*   **Garantías RMA**: Sistema de garantías y devoluciones con estados de resolución.

### C. Lavandería (Laundry)
*   **Órdenes de Servicio**: Gestión de prendas, tipos de lavado y estados de entrega.
*   **Metadata Flexible**: Captura de detalles específicos de la orden de lavado.

### D. Restaurante (Gestión Completa de Salón y Takeout) ✅ OPERATIVO
> Documentación completa en `16_Modulo_Restaurante.md`

*   **Mapa de Mesas**: Interfaz interactiva con auto-refresh (10s) para el control visual del salón.
*   **Modo Para Llevar (Takeout)**: Soporte nativo para órdenes sin mesa con registro de nombre del cliente.
*   **Comandas (KDS)**: Pantalla de cocina inteligente con estados granulares por ítem.
*   **Menú Digital**: Secciones organizadas con alias y precios override.
*   **Escandallo (Recetas)**: Definición de ingredientes por plato para deducción automática del inventario.
*   **Deducción Inteligente de Inventario**: Al vender un plato, se deducen sus ingredientes (no el plato en sí) si existe receta definida.

### E. Barbería / Salón de Belleza ✅ OPERATIVO
> Documentación completa en `15_Modulo_Barberia.md`

*   **Gestión de Empleados**: Registro de barberos/estilistas con porcentaje de comisión base.
*   **Comisiones**: Cálculo automático por venta de servicios asignados.
*   **Dashboard Unificado**: Hub central en `/barbershop` con POS y gestión de personal.

## 3. Gestión Financiera (Cashiering) — Sistema Multicaja ✅

*   **Cajas Registradoras Múltiples**: La empresa puede configurar N cajas físicas (`CashRegister`). Cada caja tiene nombre y código único (C01, C02…). Se gestiona desde Finanzas → Gestión de Cajas (`/cash-registers`, solo ADMIN).
*   **Apertura de Turno con Selector**: Al abrir caja, el cajero selecciona la terminal disponible (no ocupada). Si solo hay una, se selecciona automáticamente.
*   **Aislamiento por Caja**: PostgreSQL garantiza con un índice único parcial que solo haya una sesión `OPEN` por caja a la vez. Es imposible abrir la misma caja dos veces en simultáneo.
*   **Trazabilidad Completa**: Ventas, créditos y cotizaciones registran qué cajero y qué caja los procesó.
*   **Arqueo Conciliado**: El sistema compara el efectivo declarado por el cajero contra las transacciones registradas (Ventas - Gastos + Ingresos) por sesión.
*   **Reporte Z**: Incluye nombre de caja (`C01 - Caja Principal`), cajero, horario de apertura/cierre y desglose por método de pago y moneda.

### Flujo Multicaja
```
Admin crea empresa  →  Caja Principal (C01) se crea automáticamente
Admin va a /cash-registers  →  Crea C02, C03, etc.
Cajero abre POS  →  Modal selector de cajas libres
Cajero elige caja  →  Ingresa montos iniciales
Venta  →  Se vincula a esa sesión/caja
Cierre de turno  →  Reporte Z con nombre de caja
```

### Visibilidad por Módulo
| Módulo | Cajero | Caja |
|--------|--------|------|
| Historial de Caja | ✅ | ✅ badge |
| Historial de Ventas | ✅ columna | ✅ badge |
| Cuentas por Cobrar | ✅ | ✅ badge |
| Cotizaciones | ✅ badge creador | — |
| Reporte Z | ✅ | ✅ en template |

## 4. Inventario Forense (Product Tracking)

*   **IMEI / Seriales**: Trazabilidad absoluta para equipos electrónicos y repuestos críticos.
*   **Kardex Valorado**: Historial de movimientos reflejando variaciones de costo en USD para proteger el valor del inventario.
*   **Escandallo (Restaurante)**: Deducción automática de ingredientes basada en recetas. La lógica reside en `SalesService.create_sale()`.

## 5. Gestión Multimoneda (USD / VES / COP)

*   **Anclaje de Tasa**: Cada transacción queda vinculada a la tasa de cambio del momento.
*   **Moneda de Referencia**: USD como moneda ancla del sistema. Se gestiona mediante la tabla `currencies` con flag `is_anchor`.
*   **Pagos Mixtos**: Flexibilidad total para cobrar una sola factura con diferentes métodos y monedas (Efectivo USD + Pago Móvil VES).
*   **Tasas Disponibles**: BCV (Oficial), Paralelo (Mercado), Personalizada.
