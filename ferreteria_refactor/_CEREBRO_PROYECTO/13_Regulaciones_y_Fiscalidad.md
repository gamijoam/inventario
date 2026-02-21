# 12 - Regulaciones, Fiscalidad y Multimoneda

Este documento describe cómo **Mi Inventario Fácil** maneja el complejo entorno legal e impositivo (especialmente en el mercado venezolano) manteniendo la flexibilidad operativa.

## 1. Naturaleza de los Documentos (No Fiscal vs Legal)

El sistema genera por defecto tickets denominados **"No Fiscales"** o "Notas de Entrega".
*   **Razón**: Evita la dependencia directa de impresoras fiscales homologadas por el SENIAT que son costosas y rígidas.
*   **Validez**: Las notas de entrega son documentos legales de soporte de inventario. El sistema está preparado para que la data exportada sea entregada a un contador para la declaración formal de impuestos.

## 2. Impuestos Configurables (IVA)

*   **IVA 16%**: El sistema permite configurar tasas por rubro.
*   **Exentos**: Productos de canasta básica o servicios específicos pueden marcarse como exentos en la ficha técnica del producto.
*   **Cálculo**: El backend calcula el impuesto al momento de crear la venta y lo ancla tanto en USD como en la moneda fiscal (Bs).

## 3. IGTF (Impuesto a las Grandes Transacciones Financieras)

Para los rubros que operan en Venezuela, el sistema permite activar el **3% de IGTF** para pagos en divisas.
*   **Lógica**: Si el sistema detecta un pago en Efectivo USD, aplica automáticamente el recargo del 3% sobre esa porción del pago, registrándolo en una cuenta contable separada para su fácil auditoría.

## 4. Gestión Multimoneda y Contabilidad en USD

*   **Moneda de Referencia (Anchor)**: El sistema usa el USD como moneda base para evitar que los precios se "pulvericen" por la devaluación local.
*   **Varios Tipos de Cambio**:
    *   **BCV**: Tasa oficial.
    *   **Paralelo**: Tasa de mercado común.
    *   **Preferencial**: Tasa personalizada para clientes fieles.
*   **Dualidad en Recibos**: Todos los tickets impresos por el Hardware Bridge muestran el total en USD y su equivalente en la moneda fiscal del día, garantizando transparencia para el ente regulador y el cliente.

## 5. Auditoría de Precios y Márgenes

*   **Margen de Ganancia**: El sistema alerta si el usuario intenta vender por debajo del costo unitario registrado en el `ProductInstance`.
*   **Protección de Inflación**: Existe una herramienta de **"Ajuste Masivo de Precios"** que permite incrementar todos los precios de un rubro (ej. Repuestos) por un porcentaje fijo con un solo clic.
