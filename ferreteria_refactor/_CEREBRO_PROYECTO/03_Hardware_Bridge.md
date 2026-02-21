# 03 - Hardware Bridge (Protocolo y Comunicación)

El **Hardware Bridge** es el middleware de escritorio (C#/.NET) de **Mi Inventario Fácil** que actúa como servidor de impresión local, permitiendo la interacción con periféricos en diversos rubros comerciales.

## 1. El Proceso de Registro (Handshake)

Cuando el Bridge detecta una conexión a internet, inicia una negociación con la nube:

1.  **Conexión Inicial**: El Bridge abre un WebSocket a `wss://api.miinventariofacil.com/ws/hardware/{client_id}`.
2.  **Identificación de Tenant**: El servidor usa el **Subdominio de la petición** (o header X-Tenant-ID) para asentar el socket en el mapa del tenant correcto.
3.  **Aceptación**: Si el `client_id` es válido y el Tenant está activo, el servidor responde con un JSON de bienvenida.

## 2. Protocolo "Magic Link" (URI Scheme)

Para facilitar la configuración al usuario final, el instalador de Windows registra el esquema `miinventariofacil://`.

*   **Flujo**:
    1. El usuario hace clic en el botón "Vincular mi PC" en el Dashboard Web.
    2. La web lanza una redirección a `miinventariofacil://config?id=caja-pos-1&tenant=cliente-demo`.
    3. Windows lanza el Bridge, el cual lee los parámetros y configura la conexión automáticamente.

## 3. Protocolo de Comandos e Impresión (JSON)

### A. Estructura de Factura / Ticket (`print_order`)
```json
{
  "type": "print_order",
  "payload": {
    "header": "REPUESTOS EL RAPIDO\nRIF: J-40000000-0",
    "body": "FILTRO ACEITE x 1   $15.00\nBUJIA x 4          $20.00",
    "footer": "Gracias por su preferencia",
    "cut": true,
    "open_drawer": true
  }
}
```

## 4. Gestión de Errores y Reconexión

*   **Heartbeat**: El servidor monitorea la conexión cada 60s. Si el Bridge no responde, la interfaz web muestra el estado de hardware como desconectado.
*   **Buffer Local**: Si falla la impresión por falta de papel, el Bridge encola el trabajo localmente hasta que el hardware esté listo.
*   **Ancho de Papel Dinámico**: El Bridge permite configurar el ancho físico del papel (58mm o 80mm). 
    *   **58mm**: Formatea líneas y separadores a un máximo de 32 caracteres.
    *   **80mm**: Formatea líneas y separadores a un máximo de 48 caracteres.
*   **Logs Locales**: Registro de errores en `%APPDATA%/MiInventarioFacil/logs`.
