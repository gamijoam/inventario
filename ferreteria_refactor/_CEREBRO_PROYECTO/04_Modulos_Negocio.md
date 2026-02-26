# 04 - Módulos de Negocio y Reglas Multi-Rubro

**Mi Inventario Fácil** es una plataforma versátil diseñada para adaptarse a Ferreterías, Venta de Repuestos, Lavanderías y Servicios Técnicos.

## 1. Módulos Operativos Actuales

### A. Ferretería y Venta de Repuestos
*   **Control de Stock**: Gestión de existencias por almacenes (Principal, Mostrador, Depósito).
*   **Venta a Crédito**: Bloqueo automático por facturas vencidas y límites de deuda configurables por cliente.

### B. Servicio Técnico (Celulares / Electrónica)
*   **Recepción y Diagnóstico**: Captura detallada de dispositivos (Marca, Modelo, IMEI/Serial, Estado Visual).
*   **Abonos (Pagos Anticipados)**: Registro de pagos previos a la reparación que se descuentan automáticamente del total final en el POS.

### C. Lavandería (Laundry)
*   **Órdenes de Servicio**: Gestión de prendas, tipos de lavado y estados de entrega.
*   **Metadata Flexible**: Captura de detalles específicos de la orden de lavado.

### D. Restaurante (Gestión de Salón y Takeout)
*   **Mapa de Mesas**: Interfaz interactiva de alta fidelidad para el control visual del salón.
*   **Modo Para Llevar (Takeout)**: Soporte nativo para órdenes sin mesa con registro de nombre del cliente y visualización prioritaria.
*   **Comandas (KDS)**: Pantalla de cocina inteligente que diferencia visualmente tipos de servicio y gestiona tiempos de preparación.
*   **Gestión Multimoneda**: Cierre de cuentas con pagos mixtos y conversión automática de tasas.

## 2. Gestión Financiera (Cashiering)

*   **Apertura y Cierre de Caja**: Proceso obligatorio para habilitar ventas.
*   **Arqueo Conciliado**: El sistema compara el efectivo declarado por el cajero contra las transacciones registradas (Ventas - Gastos + Ingresos).

## 3. Inventario Forense (Product Tracking)

*   **IMEI / Seriales**: Trazabilidad absoluta para equipos electrónicos y repuestos críticos.
*   **Kardex Valorado**: Historial de movimientos reflejando variaciones de costo en USD para proteger el valor del inventario.

## 4. Gestión Multimoneda (USD / VES / COP)

*   **Anclaje de Tasa**: Cada transacción queda vinculada a la tasa de cambio del momento.
*   **Pagos Mixtos**: Flexibilidad total para cobrar una sola factura con diferentes métodos y monedas (Efectivo USD + Pago Móvil VES).
