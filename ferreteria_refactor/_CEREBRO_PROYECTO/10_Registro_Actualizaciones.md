# 10 - Registro de Actualizaciones (Changelog)

Este documento actúa como la bitácora oficial de cambios de **Mi Inventario Fácil**, permitiendo una trazabilidad técnica de las mejoras, correcciones y refactorizaciones realizadas en el ecosistema.

## [2026-02-20] - Refactor de Seguridad y Módulo de Servicios

### 1. Hardware Bridge: Seguridad y Multi-tenancy
**Descripción**: Migración de la arquitectura de comunicación de hardware para soportar un entorno SaaS escalable y seguro.
- **Cambios Técnicos**:
  - Transición de una lógica de conexión monolítica a un esquema **Multi-Tenant** dinámico.
  - Implementación de autenticación robusta: el WebSocket ahora requiere `tenant_id` y un **Hardware Token** válido en la URL.
  - Creación de un flujo de **Emparejamiento (Pairing)** mediante códigos de 6 dígitos para autorizar nuevas estaciones de trabajo.
  - Reescritura completa del cliente local en **C# (.NET)**, permitiendo ejecución silenciosa en segundo plano y una integración directa con el **Spooler de Windows** para mayor estabilidad en la impresión.
- **Modelos de Datos Afectados (PostgreSQL)**:
  - `PairingCode` (NUEVO): Gestiona los códigos temporales de vinculación.
  - `HardwareToken` (NUEVO): Almacena los tokens de acceso persistentes vinculados a cada `client_id` y `tenant_id`.

### 2. Módulo de Servicios Técnicos: Finanzas e Integridad
**Descripción**: Refuerzo de la seguridad de datos y nueva lógica contable para abonos en órdenes de reparación.
- **Cambios Técnicos**:
  - **Identidad**: Inyección forzada del filtro `.filter(ServiceOrder.tenant_id == current_tenant)` en todas las consultas para eliminar brechas de visibilidad entre empresas.
  - **Lógica Contable**: Implementación de un sistema de **Abonos/Anticipos**. Ahora la lógica de Checkout (`service_checkout_service.py`) calcula el total de la orden, resta la suma de abonos previos y solo cobra el **Saldo Pendiente** en el POS.
  - **Móvil & UX**: 
    - Optimización del modal de importación (`ServiceImportModal`) para diseño responsivo.
    - Implementación visual de captura de **Patrón de Desbloqueo** para mejorar la recepción de dispositivos móviles.
- **Modelos de Datos Afectados (PostgreSQL)**:
  - `ServicePayment` (NUEVO): Modelo para el registro detallado de cada abono realizado a una orden.
  - `ServiceOrder` (MODIFICADO): Actualización de esquemas para relacionar pagos anticipados y estados financieros.

## [2026-02-21] - Soporte Multiformato de Impresión

### 1. Hardware Bridge: Configuración de Ancho de Papel
**Descripción**: Implementación de soporte para impresoras térmicas de 80mm (48 caracteres) manteniendo compatibilidad con 58mm (32 caracteres).
- **Cambios Técnicos**:
  - **Configuración Dinámica**: Se agregó la propiedad `PaperWidth` al modelo de configuración local.
  - **Interfaz de Usuario**: Inclusión de un selector de ancho de papel en el panel de `Configuración Manual` de la aplicación C#.
  - **Adaptación de Formato**: La lógica de renderizado en `PrinterService.cs` y las plantillas en el backend ahora ajustan dinámicamente el ancho de los separadores y el contenido según el papel (58mm vs 80mm).
  - **Distribución**: Generación de un nuevo binario `ConexionImpresora.exe` distribuido automáticamente a la carpeta de descargas del Frontend.
  - `bridge_config.json`: Nueva clave `"PaperWidth"` persistente.

### 2. Estabilización de Sesiones (Fix "Kick-out")
**Descripción**: Corrección del cierre de sesión inesperado mediante la extensión de vida de los tokens de acceso.
- **Cambios Técnicos**:
  - **Vida del Token**: Se aumentó `ACCESS_TOKEN_EXPIRE_MINUTES` de 30 a **1440 minutos** (24 horas).
  - **Sincronización de Cookies**: El campo `max_age` de las cookies HttpOnly ahora refleja la nueva duración de la sesión.
  - **UX**: Eliminación de redirecciones intrusivas al login durante transacciones largas.

### 3. POS: Optimización Visual y Legibilidad
**Descripción**: Rediseño de la interfaz de venta para mejorar la presentación de productos y evitar recortes de texto.
- **Cambios Técnicos**:
  - **Componente de Imagen**: Se flexibilizó `ProductImage.jsx` para permitir ajustes de aspecto dinámicos sin sobrescribir estilos de contenedor.
  - **Tarjeta de Producto**: 
    - Aumento de altura mínima de `220px` a **`360px`** en `ProductCard.jsx`.
    - Área de imagen expandida a `h-40` con escala interactiva en hover.
    - Soporte para nombres de artículos de hasta **3 líneas** (`line-clamp-3`).
    - Compactación de la sección de precios para maximizar el espacio de descripción.

## [2026-02-26] - Módulo Restaurante (Takeout) y Estabilidad SaaS

### 1. Restaurante: Soporte para Modo "Para Llevar" (Takeout)
**Descripción**: Implementación integral de órdenes sin mesa y optimización del flujo de cocina.
- **Cambios Técnicos**:
  - **Backend**: Creación del endpoint `/open_takeout` y adaptación de `/checkout` para manejar órdenes sin `table_id`.
  - **KDS**: Implementación de etiquetas visuales distintivas en la Pantalla de Cocina para identificar servicios de Takeout.
  - **Flujo POS**: Integración de captura opcional del nombre del cliente para órdenes externas.
- **Modelos de Datos Afectados (PostgreSQL)**:
  - `RestaurantOrder` (MODIFICADO): Columnas `is_takeout` (Boolean) y `customer_name` (String) añadidas; `table_id` ahora es **Nullable**.
  - Migración auditada de timestamps (`created_at`, `updated_at`).

### 2. Infraestructura: Propagación de Esquemas y HashRouter
**Descripción**: Automatización de la integridad de datos en el VPS y corrección de navegación.
- **Cambios Técnicos**:
  - **Migración Inteligente**: Actualización de `migrate_tenants.py` para propagar automáticamente cambios de esquema a todos los esquemas PostgreSQL de inquilinos durante el inicio (Startup Event).
  - **Navigation Fix**: Ajuste de rutas en correos de recuperación de contraseña y redirecciones de descubrimiento para compatibilidad con `HashRouter` (Inyección de `#` en URLs).
- **Archivos Afectados**:
  - `migrate_tenants.py`: Lógica de alteración de tablas distribuida.
  - `auth.py`, `email_utils.py`: Corrección de generadores de URL.
