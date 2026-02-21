# 06 - Referencia de la API (Endpoints Core)

Guía de integración para los servicios de **Mi Inventario Fácil**.

## 1. Autenticación e Identidad (`/api/v1/auth`)

| Método | Endpoint | Propósito |
| :--- | :--- | :--- |
| **POST** | `/discovery` | Determina el subdominio de acceso mediante el email del usuario. |
| **POST** | `/token` | Validación de credenciales y entrega de JWT. |

## 2. Operaciones de Venta y Cobro (`/api/v1/sales`)

*   **Idempotencia**: Uso obligatorio de `unique_uuid` para prevenir duplicados en entornos de baja conectividad.
*   **SaaS Context**: Cada petición debe incluir el Host correcto o el header `X-Tenant-ID`.

## 3. Inventario y Logística (`/api/v1/inventory`)

*   **Multimoneda**: Los precios y costos se manejan principalmente en USD para evitar desajustes por inflación, con conversión dinámica a monedas locales.
*   **Transferencias**: Endpoints para mover stock entre almacenes de un mismo tenant.

## 4. Gestión de Caja (`/api/v1/cash`)

*   **Control de Flujo**: La API bloquea ventas si detecta que la `CashSession` del día no ha sido abierta.
*   **Cierres**: Endpoint para el arqueo final de jornada (`/sessions/close`).

## 5. Ejemplo de Payload: Venta Multi-Rubro
```json
{
  "customer_id": 10,
  "items": [
    { "product_id": 50, "quantity": 1, "unit_price": 25.0 }
  ],
  "payment_method": "VES_PAGO_MOVIL",
  "exchange_rate": 36.5,
  "unique_uuid": "abc-123-xyz"
}
```
