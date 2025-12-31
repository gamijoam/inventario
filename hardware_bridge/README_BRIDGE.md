# Guía de Instalación: BridgeInvensoft (Windows)

Este programa (`BridgeInvensoft.exe`) permite que la aplicación web **InvenSoft** se comunique con tu impresora térmica local.

## Requisitos Previos

1.  **Impresora Térmica USB:** Debe estar conectada y encendida.
2.  **Drivers Zadig (Importante):**
    *   Para que el sistema pueda comunicarse directamente con la impresora USB (sin el driver de Windows spooler), a veces es necesario instalar un driver `WinUSB`.
    *   Descarga **Zadig** (https://zadig.akeo.ie/).
    *   Ábrelo, selecciona tu impresora en la lista (Options -> List All Devices).
    *   Instala el driver **WinUSB** o **libusb-win32**.
    *   *Nota: Esto reemplaza el driver de impresión normal de Windows para ese puerto USB.*

## Instalación

1.  Descarga el archivo `BridgeInvensoft.exe`.
2.  Crea una carpeta en tu disco `C:`, por ejemplo: `C:\InvenSoft\`.
3.  Copia el archivo `BridgeInvensoft.exe` dentro de esa carpeta.
4.  (Opcional) Crea un archivo `.env` al lado del ejecutable para configurar el modo:
    ```env
    PRINTER_MODE=USB
    ```

## Modos de Operación

- **Modo USB (Por defecto):** Intenta imprimir en una impresora térmica USB conectada (requiere drivers Zadig/WinUSB).
- **Modo VIRTUAL:** Simula la impresión.
    - Muestra el ticket en la ventana de comandos (consola).
    - Guarda una copia en el archivo `ticket_output.txt` en la misma carpeta.
    - Útil para probar si el sistema funciona sin gastar papel.

## Ejecución

1.  Haz doble clic en `BridgeInvensoft.exe`.
2.  No verás ninguna ventana (se ejecuta en segundo plano).
3.  Para verificar que está corriendo:
    *   Abre tu navegador y entra a: `http://localhost:5001`
    *   Deberías ver un mensaje JSON: `{"service": "Hardware Bridge", ...}`.

## Configuración de Inicio Automático (Opcional)

Para que se inicie siempre que prendas la computadora:
1.  Presiona `Win + R`, escribe `shell:startup` y pulsa Enter.
2.  Crea un **Acceso Directo** de `BridgeInvensoft.exe` y pégalo en esa carpeta.

---
**Soporte Técnico:** soporte@invensoft.lat
