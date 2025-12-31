# Documentación de Refactorización: Arquitectura Cliente-Servidor

Esta carpeta contiene la implementación de referencia para dividir el sistema POS en Backend y Frontend.

## 1. Diagrama de Flujo de Venta

```mermaid
sequenceDiagram
    participant Asesor/Vista
    participant POSController (Cliente)
    participant ProductService (Cliente)
    participant API Backend
    participant Base de Datos

    Asesor/Vista->>POSController: add_to_cart("Martillo", 1)
    POSController->>POSController: Busca en caché local (previamente cargado)
    POSController-->>Asesor/Vista: Item Agregado (UI actualiza)
    
    Asesor/Vista->>POSController: finalize_sale()
    POSController->>ProductService: record_sale(payload_json)
    ProductService->>API Backend: POST /api/v1/products/sales/
    
    API Backend->>Base de Datos: Validar Stock
    API Backend->>Base de Datos: Crear Venta y Detalles
    API Backend->>Base de Datos: Descontar Inventario
    Base de Datos-->>API Backend: OK
    
    API Backend-->>ProductService: {status: "success", sale_id: 123}
    ProductService-->>POSController: OK
    POSController->>POSController: Limpiar Carrito
    POSController-->>Asesor/Vista: Mostrar Ticket / Éxito
```

## 2. Guía de Instalación y Despliegue

### PC Servidor (Administra DB y Lógica)
1.  **Requisitos**: Python 3.12, PostgreSQL (recomendado) o SQLite.
2.  **Ubicación**: Copiar la carpeta `backend_api` y el entorno virtual.
3.  **Configuración**:
    -   Editar `backend_api/.env` (o `config.py`) con la `DATABASE_URL`.
    -   Ejemplo: `DATABASE_URL=postgresql://user:pass@localhost/ferreteria_db`
4.  **Arranque**:
    ```bash
    # Desde la carpeta raíz ferreteria-refactor
    uvicorn backend_api.main:app --host 0.0.0.0 --port 8000 --workers 4
    ```
    *Nota: `0.0.0.0` permite conexiones desde otras PC en la red.*

### PCs Cliente (Cajas / Puntos de Venta)
1.  **Requisitos**: Python 3.12, Librerías `requests`, `PyQt6`.
2.  **Ubicación**: Copiar la carpeta `frontend_caja`.
3.  **Configuración**:
    -   Editar `frontend_caja/config.py`.
    -   Establecer `API_BASE_URL = "http://<IP_DEL_SERVIDOR>:8000"`.
4.  **Arranque**:
    -   Ejecutar la aplicación PyQt6 normalmente (ej. `python main.py`).
    -   El sistema cargará los productos del servidor al iniciar.

## Estructura de Directorios Nueva
-   **backend_api/**: NÚCLEO. Nadie toca la DB excepto esto.
-   **frontend_caja/**: INTERFAZ. Cliente "tonto" que solo pide datos y envía órdenes de venta.
