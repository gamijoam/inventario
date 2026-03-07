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

## 5. Configuración (`/api/v1/config`)

| Método | Endpoint | Auth | Propósito |
| :--- | :--- | :--- | :--- |
| **GET** | `/exchange-rates` | Sí | Lista todas las tasas de cambio del tenant |
| **POST** | `/exchange-rates` | Sí | Crea una nueva tasa de cambio |
| **GET** | `/exchange-rates/bcv` | No | Scraping en tiempo real de bcv.org.ve → devuelve `{usd_ves, eur_ves, fetched_at}` |
| **GET** | `/exchange-rates/{id}` | Sí | Obtiene una tasa por ID |
| **PUT** | `/exchange-rates/{id}` | Sí | Actualiza una tasa |
| **DELETE** | `/exchange-rates/{id}` | Sí | Elimina una tasa |

> ⚠️ **Orden de rutas**: `/exchange-rates/bcv` DEBE estar definido ANTES de `/exchange-rates/{id}` en el router. FastAPI evalúa rutas en orden de declaración; si `/{id}` está primero, intenta castear `"bcv"` como `int` y devuelve un error de validación Pydantic.

## 6. Servicios Técnicos (`/api/v1/services`)

| Método | Endpoint | Propósito |
| :--- | :--- | :--- |
| **POST** | `/orders` | Crea una nueva orden de recepción técnica |
| **GET** | `/orders/{id}` | Detalle de una orden |
| **GET** | `/orders/{id}/print/thermal` | Genera payload de impresión para ticket de recepción (58mm/80mm). Incluye datos del equipo + garantía por defecto del tenant. |
| **POST** | `/orders/{id}/payments` | Registra un abono/anticipo a una orden |
| **POST** | `/orders/{id}/checkout` | Cierra la orden y genera la venta en el POS (descuenta abonos previos) |

## 7. Mensajes del Sistema (`/api/v1/system` y `/api/v1/admin`)

| Método | Endpoint | Auth | Propósito |
| :--- | :--- | :--- | :--- |
| **GET** | `/system/messages/active` | No | Lista mensajes activos no expirados (banners + anuncios) |
| **GET** | `/admin/messages` | Superuser | Lista todos los mensajes (CRUD admin) |
| **POST** | `/admin/messages` | Superuser | Crea mensaje. `message_type: 'banner'|'announcement'`, `version_tag` opcional. Broadcast WS inmediato. |
| **DELETE** | `/admin/messages/{id}` | Superuser | Desactiva un mensaje (soft-delete) |

**Tipos de mensaje:**
- `banner`: Aparece en la esquina superior derecha. Se muestra cada vez que el usuario accede si no lo ha descartado.
- `announcement`: Modal centrado con lista de novedades. Se muestra **una sola vez** por usuario (rastreado en `localStorage: announced_<id>`).

**Payload WebSocket** (tipo `system:notification`):
```json
{
  "id": 42,
  "title": "Novedades de marzo",
  "content": "🔧 Impresión | El ticket...\n📱 IMEI | El serial...",
  "level": "info",
  "message_type": "announcement",
  "version_tag": "v2.5",
  "is_active": true
}
```

## 8. Ejemplo de Payload: Venta Multi-Rubro
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
