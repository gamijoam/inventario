# 10 - Registro de Actualizaciones (Changelog)

Este documento actúa como la bitácora oficial de cambios de **Mi Inventario Fácil**, permitiendo una trazabilidad técnica de las mejoras, correcciones y refactorizaciones realizadas en el ecosistema.

---

## [2026-03-05] — Limpieza Tauri + Fix routing QA + SaaS Admin funcional
**Branch:** `feature/tauri-desktop` | **Commits:** `a1feb74`, `4fd78ce`, `17b9a17`, `affea8f`, `73a5b95`

### feat: Eliminación completa de la feature Tauri Desktop
Se tomó la decisión de abandonar la app de escritorio. Se removió todo el código específico de Tauri conservando todos los cambios valiosos (restaurante, barbería, móvil, etc.).

**Archivos eliminados:**
- `frontend_web/src-tauri/` (Tauri config, Rust sources, 75+ icons)
- `desktop_backend/` (FastAPI local, PyInstaller spec, middleware, startup)
- `frontend_web/src/pages/LicenseActivation|DesktopFirstRun|DesktopSetup.jsx`
- `backend_api/models/desktop_license.py` + `routers/desktop_licenses.py`
- `alembic/versions/0fbdc2b894af` (migración desktop_licenses — nunca ejecutada en prod)
- `saas_admin/pages/DesktopLicenses` + modales + `api/desktopLicenses.ts`
- `build_desktop_exe.bat`, `iniciar_backend.bat`

**Archivos limpiados:**
- `App.jsx` — sin `IS_TAURI`, sin `tauriPreLicense`, sin retry loop, startup normal
- `backend_api/main.py` — sin `desktop_licenses_router`
- `saas_admin/App.tsx` y `DashboardLayout.tsx` — sin rutas/nav de licencias desktop

### fix(qa): SaaS Admin panel accesible en admin-qa.miinventariofacil.com
- **Problema 1:** Imagen Docker incorrecta: `ferreteria-saas` → `ferreteria-admin-panel`
  (el script `deploy_images.bat` usa `ferreteria-admin-panel` como nombre)
- **Problema 2:** Dominio incorrecto: `admin.qa.*` → `admin-qa.miinventariofacil.com`
  (patrón correcto: `{servicio}-qa.miinventariofacil.com`, igual que `api-qa`)
- **Problema 3 (previo):** Priority Traefik para evitar que wildcard frontend capture requests
  de dominios específicos (priority=200 en backend y saas_admin)
- **Resultado:** `https://admin-qa.miinventariofacil.com/login` funciona correctamente

### chore(docker): docker-compose.qa.yml creado
- Stack QA completo: traefik + frontend + backend + saas_admin + db
- Dominios QA: `*.qa.miinventariofacil.com` (frontend), `api-qa.*`, `admin-qa.*`
- `.dockerignore.fast` y `.dockerignore.full` actualizados para excluir `src-tauri/target/`

---

## [2026-03-05] — App Desktop Tauri: Backend local funcional + Licencias + Build pipeline
**Branch:** `feature/tauri-desktop` | **Commits:** `fb60a79`, `47d1a80`, `4122f97`

### feat(tauri): Desktop backend funcional con DB local y seeding
- **`desktop_backend/startup.py`** — `_seed_default_data()` crea automáticamente en `desktop_local`:
  tasas de cambio (BCV/Paralelo), métodos de pago (5), monedas (USD/VES/COP),
  almacén "Almacen1", caja "Caja Principal/C01". Idempotente.
- **`desktop_backend/startup.py`** — `_ensure_desktop_tenant()` ahora activa todos los módulos
  (`has_restaurant_module`, `has_laundry_module`, etc.) al crear o actualizar el tenant desktop.
- **`frontend_web/src/App.jsx`** — Retry loop de 60 segundos en modo Tauri: la app espera
  confirmación de `GET /api/v1/desktop/info` antes de montar los React Providers.
  Elimina los toasts "error del servidor" al arranque. Muestra pantalla de error si el
  backend no responde en 60s con botón "Reintentar".
- **`iniciar_backend.bat`** — Script doble-click para arrancar el backend Python en desarrollo.
- **`frontend_web/src/pages/LicenseActivation.jsx`** — Botón "Saltar licencia" solo en
  `import.meta.env.DEV` que guarda `DEV-0000-0000-0000` con expiración de 5 años.

### feat(restaurant): Mejoras módulo restaurante y móvil
- `frontend_web/src/pages/Restaurant/` — mejoras en TableMap, KitchenDisplay, MenuManager, OrderModal
- `frontend_web/src/pages/Mobile/` — mejoras en MobileOrderTaker, MobileTableGrid, WaiterLogin
- `backend_api/routers/modules/restaurant/orders.py` — mejoras en lógica de órdenes
- Documentación: `16_Modulo_Restaurante.md` creado con arquitectura completa del módulo

### feat(desktop): Sistema de licencias + PyInstaller build pipeline
- **`backend_api/models/desktop_license.py`** — Modelo `DesktopLicense` en `public.desktop_licenses`
  Campos: `license_key` (XXXX-XXXX-XXXX-XXXX), `plan_name`, flags de módulos,
  `max_devices`, `activations_count`, `expires_at` (null = perpetua), `is_active`, info del cliente
- **`alembic/versions/0fbdc2b894af_add_desktop_licenses_table.py`** — Migración crea la tabla
- **`backend_api/routers/desktop_licenses.py`** — Router con:
  - `POST /api/v1/desktop/license/activate` — endpoint **público** (sin auth)
  - `GET/POST/PUT/DELETE /api/v1/desktop/licenses` — CRUD para superadmin
- **`backend_api/main.py`** — Registra `desktop_licenses_router`
- **`desktop_backend/entry.py`** — Entry point PyInstaller (sin `__name__` guard, maneja `sys._MEIPASS`)
- **`desktop_backend/invensoft_backend.spec`** — Spec PyInstaller con hiddenimports completos
- **`build_desktop_exe.bat`** — Pipeline completo: PyInstaller → copy .exe → inject externalBin →
  `npm run tauri:build` → restaurar `tauri.conf.json`. Genera instalador NSIS.

### Pendiente (próxima fase)
- UI en SaaS Admin para gestionar licencias desktop (crear, ver activaciones, desactivar)
- DesktopFirstRun: agregar campos empresa/RIF en primer arranque
- Test real de `build_desktop_exe.bat` (pendiente correr en máquina con Rust + MSVC)
- Sidebar desktop: ocultar opciones cloud-only en modo Tauri

---

## [2026-03-03] - Visibilidad Completa: Cajero/Caja en CxC y Cotizaciones

### Cotizaciones
- `quotes.py` → `GET /quotes` ahora hace joinedload del `user` (creador)
- `schemas/__init__.py` → nuevo schema `QuoteCreatorInfo` (id, username, full_name); `QuoteRead` incluye `user: Optional[QuoteCreatorInfo]`
- `QuoteList.jsx` → badge indigo con el nombre del creador en cada tarjeta de cotización

### Cuentas por Cobrar (CxC)
- `products.py` → `GET /products/credits` ahora hace joinedload de `cash_session → user` y `cash_session → register`
- La respuesta incluye `cashier_name`, `register_name`, `register_code` por factura de crédito
- `AccountsReceivable.jsx` → celda Detalles muestra cajero en indigo + badge azul de caja

### CxP (Cuentas por Pagar)
- No aplica filtro de caja: las órdenes de compra no pasan por caja registradora sino por el módulo de compras/almacén

## [2026-03-03] - Visibilidad de Cajas en Toda la Plataforma

### Fix: Bug `db.refresh()` en CashRegister endpoints (multi-tenant)
- `POST /cash/registers` y `PUT /cash/registers/{id}` fallaban con `InvalidRequestError` al hacer `db.refresh()` después del commit porque SQLAlchemy pierde el `search_path` del tenant. Corregido usando re-query por ID/code.

### Reporte Z (cierre de caja)
- `sales_service.generate_z_report_payload()` ahora carga el `register` con joinedload
- El contexto incluye `session.register_name` y `session.register_code`
- El template imprime: `Caja: C01 - Caja Principal` justo después de `Sesion:`

### Historial de Caja (`GET /cash/sessions/history`)
- Endpoint ahora hace `joinedload(CashSession.register)`
- Respuesta incluye campo `register: {id, name, code}` por sesión
- `CashHistory.jsx` muestra badge azul con código de caja y nombre de registro en cada sesión

### Historial de Ventas (`GET /returns/sales/search`)
- Endpoint hace joinedload de `Sale → cash_session → user` y `Sale → cash_session → register`
- Respuesta enriquecida con `cashier_name`, `register_name`, `register_code` por venta
- `SalesHistory.jsx` muestra columna **Cajero / Caja** con nombre del cajero y badge de caja

### Cotizaciones: rastrear usuario creador
- Modelo `Quote` recibe campo `user_id` (FK nullable a `public.users`)
- `migrate_multicaja.py` paso 7: `ALTER TABLE quotes ADD COLUMN user_id IF NOT EXISTS`
- `quotes.py` router ahora requiere autenticación y guarda `current_user.id` al crear
- `QuoteRead` schema incluye `user_id: Optional[int]`

## [2026-03-03] - Página de Gestión de Cajas + Fix Tenant Seed

### Nuevo: `CashRegistersPage.jsx`
- Página en `/cash-registers` (solo ADMIN) bajo Finanzas → Gestión de Cajas.
- Muestra todas las cajas activas en cards con estado en tiempo real (Abierta/Cerrada, quién la tiene, desde cuándo).
- Métricas resumen: Total activas, Abiertas ahora, Cerradas.
- Crear nueva caja (nombre, código, descripción).
- Editar nombre/descripción (solo si está cerrada).
- Activar/Desactivar caja (solo si está cerrada). La Caja Principal (C01) está protegida.
- Auto-refresh cada 30 segundos.

### Fix: `tenant_service.py` — Gap en creación de nuevos tenants
- Antes: nuevos tenants creados en runtime no recibían "Caja Principal" hasta el próximo restart del servidor.
- Ahora: `seed_cash_register(schema_name)` se llama en el seed chain de `create_tenant()`, igual que warehouse, currencies, etc.
- Idempotente: si ya existe una caja, se salta el seed.

## [2026-03-03] - Soporte de Múltiples Cajas (Multi-Cash-Register)

### 1. Sistema de Multicajas
**Descripción**: Arquitectura completa para múltiples cajas simultáneas. Terminales físicas (`CashRegister`), validación por caja, vinculación de ventas a sesión, migración automática idempotente.

- **Modelo**: `CashRegister` + FK `register_id` en `CashSession` + FK `session_id` en `Sale`.
- **Constraint DB**: partial unique index `WHERE status='OPEN'` — 1 sesión por caja garantizada a nivel BD.
- **Migración**: `migrate_multicaja.py` — auto-ejecuta en startup, seed "Caja Principal", backfill sesiones existentes.
- **Endpoints**: `GET/POST/PUT /cash/registers`, `GET /cash/registers/status`.
- **Frontend**: `CashOpeningModal` en 2 pasos (selector de caja → montos). `CashContext` expone registers.
- **Rama**: `feature/multi-cash-register`
- **Archivos**: `models.py`, `schemas/__init__.py`, `migrate_multicaja.py`, `main.py`, `cash.py`, `sales_service.py`, `CashContext.jsx`, `CashOpeningModal.jsx`.

## [2026-03-03] - Créditos en Dashboard y Correcciones de Integridad

### 1. Dashboard: Resumen Global de Créditos Pendientes
**Descripción**: Integración de cuentas por cobrar en el resumen general del dashboard con datos reales y actualizados.
- **Cambios Técnicos**:
  - **Nuevo Endpoint**: `GET /reports/credits/summary` — consulta global (sin filtro de fecha) de todas las ventas a crédito pendientes (`is_credit=True, paid=False, balance_pending > 0`). Retorna `total_pending_usd`, `total_pending_bs`, `pending_count` y `exchange_rate`.
  - **KPI Card**: Nuevo indicador "Créditos Pendientes" en la grilla de KPIs del dashboard (5 columnas) con soporte multimoneda.
  - **Widget Cuentas por Cobrar**: Actualizado para usar datos del endpoint real en vez de calcular desde las últimas 10 transacciones (que era impreciso). Ahora muestra monto en USD, equivalente en Bs y conteo exacto de facturas activas.
  - **Actualización en Tiempo Real**: Los créditos se actualizan automáticamente cuando se registra un pago o nueva venta vía WebSocket (`sale:created`).
- **Archivos Afectados**:
  - `backend_api/routers/reports.py`: Endpoint `/reports/credits/summary`.
  - `frontend_web/src/services/unifiedReportService.js`: Método `getCreditsSummary()`.
  - `frontend_web/src/pages/Dashboard.jsx`: KPI card + widget actualizado.

### 2. Fix: Dashboard Mostraba Ingresos Inflados por Créditos
**Descripción**: El KPI "Ingresos Hoy" sumaba ventas a crédito no cobradas, inflando los números reales.
- **Cambios Técnicos**:
  - **Separación de Ingresos**: `total_revenue` ahora solo incluye dinero efectivamente cobrado. Los créditos pendientes se reportan por separado en `pending_credit` y `pending_credit_bs`.
  - **Ganancia Real**: `realized_profit` ya excluía créditos, pero `total_revenue` no lo hacía — corregido.
- **Archivos Afectados**:
  - `backend_api/routers/reports.py`: Lógica de `get_sales_summary()`.

### 3. Fix: Servicios Aparecían en Alertas de Stock Bajo
**Descripción**: Productos marcados como servicio (`is_service=True`) con stock=0 generaban alertas de inventario falsos.
- **Cambios Técnicos**:
  - Filtros adicionales en `/reports/low-stock`: `is_service == False` y `is_active == True`.
- **Archivos Afectados**:
  - `backend_api/routers/reports.py`: Endpoint `get_low_stock_products()`.

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

## [2026-02-24] - Módulo de Barbería / Salón de Belleza

### 1. Barbería: Infraestructura Multi-Tenant (Fases 1-2)
**Descripción**: Implementación completa del módulo de barbería con gestión de empleados, comisiones y dashboard.
- **Cambios Técnicos**:
  - **Modelos DB**: Tablas `employees` y `commissions` integradas en esquema multitenant.
  - **Endpoints API**: CRUD completo en `/api/v1/employees` y comisiones en `/api/v1/employees/commissions`.
  - **SaaS Panel**: Flag `has_barbershop_module` con toggle de activación por empresa (ícono de Tijeras).
  - **Frontend**: Dashboard unificado en `/barbershop`, selector de íconos Lucide-React, sidebar inteligente.
  - **Migración Automática**: Script `migrate_barbershop.py` para propagar columnas del módulo a todos los tenants.
- **Archivos Afectados**:
  - `backend_api/routers/employees.py`, `backend_api/models/models.py`, `backend_api/migrate_barbershop.py`.
  - `frontend_web/src/pages/Barbershop/`, `frontend_web/src/components/layout/Sidebar.jsx`.

## [2026-02-26] - Segmentación por Rubros y Estabilidad SaaS

### 1. Sistema de Segmentación Inteligente de Rubros
**Descripción**: Automatización de la configuración de módulos basada en el tipo de negocio seleccionado al registrarse.
- **Cambios Técnicos**:
  - **Detección por Palabras Clave**: `TenantService.create_tenant()` analiza el rubro seleccionado y activa automáticamente los módulos correspondientes.
  - **Modelo Tenant Expandido**: Nuevas columnas `business_type`, `has_restaurant_module`, `has_laundry_module`, `has_hardware_module`, `has_services_module`, `has_barbershop_module`.
  - **Panel SaaS**: Vista enriquecida con filtros por rubro y togglees de módulos por empresa.
- **Archivos Afectados**:
  - `backend_api/services/tenant_service.py`, `backend_api/models/tenant.py`.
  - `saas_admin/src/pages/TenantDetail.jsx`.

### 2. Correcciones de Estabilidad
- **Discovery Fix**: Corrección del endpoint `/auth/discovery` para manejar casos edge de usuarios sin tenant.
- **Session Fix**: Estabilización de cookies HttpOnly y tokens en entornos de producción con HTTPS.
- **DB Repair**: Función `repair_public_schema()` para recuperación automática de `alembic_version` y columnas faltantes.

## [2026-02-27] - Rediseño Completo del Módulo Restaurante (Fases 1-5)

### 1. Restaurante: Arquitectura Completa (5 Fases)
**Descripción**: Rediseño integral del módulo de restaurante, desde la base de datos hasta el frontend.
- **Fase 1: Modelos y Endpoints Base**
  - Modelos: `RestaurantTable`, `RestaurantOrder`, `RestaurantOrderItem`.
  - Endpoints CRUD para mesas y órdenes.
  - Frontend: Mapa interactivo de mesas con auto-refresh.

- **Fase 2: Takeout (Para Llevar)**
  - Columnas `is_takeout` y `customer_name` en `RestaurantOrder`.
  - Endpoint `/open_takeout` para órdenes sin mesa.
  - KDS con diferenciación visual de Takeout.

- **Fase 3: Menú Digital**
  - Modelos: `RestaurantMenuSection`, `RestaurantMenuItem`.
  - Endpoints CRUD para gestión de menú con secciones, alias y precios override.

- **Fase 4: Checkout y Vinculación con Ventas**
  - Integración de cierre de cuenta con `SalesService.create_sale()`.
  - Soporte multimoneda y métodos de pago mixtos.
  - Vinculación `sale_id` en `RestaurantOrder`.

- **Fase 5: Escandallo (Recetas) y Deducción de Inventario**
  - Modelo: `RestaurantRecipe` (plato → ingredientes con cantidades).
  - Lógica centralizada en `SalesService.create_sale()`: si existe receta, se deducen ingredientes; si no, se deduce el producto directamente.
  - Eliminación de lógica redundante de deducción en `orders.py`.

- **Archivos Afectados**:
  - `backend_api/models/restaurant.py`, `backend_api/schemas/restaurant.py`.
  - `backend_api/routers/modules/restaurant/tables.py`, `orders.py`, `menu.py`.
  - `backend_api/services/sales_service.py`.
  - `frontend_web/src/pages/Restaurant/TableMap.jsx`, `KitchenDisplay.jsx`.

### 2. Eliminación de SQLite y Estabilización PostgreSQL
**Descripción**: Limpieza total de código SQLite y simplificación del cambio de esquema.
- **Cambios Técnicos**:
  - **`db.py`**: Eliminadas todas las variables `IS_SQLITE`, `IS_POSTGRES`, event listener `on_connect` (ATTACH DATABASE), y checks condicionales de dialecto. El pool y `get_db()` son ahora 100% PostgreSQL.
  - **`tenant_service.py`**: Eliminados todos los `if "sqlite" not in ...` guards. `CREATE SCHEMA`, `SET search_path` y seeding ahora se ejecutan directamente sin verificación de dialecto.
  - **Diagnóstico Mejorado**: `RuntimeError` en `get_db()` ahora incluye el mensaje exacto de la excepción de PostgreSQL para facilitar debugging.
- **Archivos Afectados**:
  - `backend_api/database/db.py`, `backend_api/services/tenant_service.py`.

