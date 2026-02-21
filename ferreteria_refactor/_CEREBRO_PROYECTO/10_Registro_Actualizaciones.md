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
  - **Adaptación de Formato**: La lógica de renderizado en `PrinterService.cs` ahora ajusta dinámicamente el ancho de los separadores y el contenido en el **Modo Virtual**.
  - **Distribución**: Generación de un nuevo binario `ConexionImpresora.exe` distribuido automáticamente a la carpeta de descargas del Frontend.
- **Modelos de Datos Afectados (Local)**:
  - `bridge_config.json`: Nueva clave `"PaperWidth"` persistente.
