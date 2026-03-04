# 09 - Guía de Mantenimiento y Operaciones de Datos

Procedimientos para la continuidad operativa de **Mi Inventario Fácil**.

## 1. Gestión de Esquemas Globales
El mantenimiento de la estructura de tablas se realiza mediante dos mecanismos automáticos que se ejecutan durante el `startup_event()` de FastAPI:

### A. Migraciones Alembic
```bash
alembic upgrade shared@head
```
Aplica cambios definidos en Alembic al esquema `public`.

### B. Propagación a Tenants
El script `migrate_tenants.py` itera por todos los esquemas de clientes activos y aplica cambios de columnas faltantes.

### C. Migración de Barbería
`migrate_barbershop.py` propaga automáticamente las columnas del módulo de barbería (`is_commissionable`, `is_barbershop_service`, etc.) a los esquemas de todos los tenants.

### D. Migración de Multicaja (`migrate_multicaja.py`)
Ejecutada automáticamente al startup, itera todos los schemas (public + tenants) y aplica de forma idempotente:
1. Crea tabla `cash_registers` si no existe
2. Inserta `Caja Principal (C01)` si la tabla está vacía
3. Agrega columna `register_id` a `cash_sessions` si no existe
4. Backfill: asigna sesiones sin `register_id` a C01
5. Crea índice único parcial `WHERE status = 'OPEN'` por caja
6. Agrega columna `session_id` a `sales` si no existe
7. Agrega columna `user_id` a `quotes` si no existe

### D. Reparación de Esquema Público
La función `repair_public_schema()` en `main.py` verifica y repara automáticamente:
- Existencia de la tabla `alembic_version`.
- Columnas faltantes en `public.tenants` (`business_type`, flags de módulos).

## 2. Ciclo de Vida del Cliente (Tenant)
1.  Creación de registro en el panel de control SaaS.
2.  Segmentación automática de módulos según rubro (ej: "Restaurante" → `has_restaurant_module=True`).
3.  Generación automática de esquema PostgreSQL dedicado (`CREATE SCHEMA`).
4.  Schema Reflection: `Base.metadata.create_all()` crea todas las tablas en el nuevo esquema.
5.  Seeding de datos iniciales (Admin, Tasas de Cambio, Métodos de Pago, Monedas, Almacén, **Caja Principal C01**).
6.  Creación de directorio de media (`/media/{schema_name}/products/`).

## 3. Mantenimiento de Hardware
*   Revisión de logs locales en las estaciones de trabajo para diagnosticar fallas de impresión.
*   Actualización remota del Bridge C# cuando se agregan nuevas funciones de hardware (como balanza o lectores biométricos).

## 4. Resguardo de la Información
*   **DB Backups**: Dump diario del motor PostgreSQL.
*   **Media Backups**: Sincronización de la carpeta de imágenes de productos y comprobantes de servicios técnicos hacia almacenamiento seguro fuera del servidor.

## 5. Módulo Restaurante (Mantenimiento)
*   **Escandallo**: Verificar periódicamente que las recetas (`restaurant_recipes`) reflejen las cantidades reales de ingredientes utilizados.
*   **KDS**: La pantalla de cocina se auto-refresca, pero si reportan datos obsoletos, verificar la conectividad WebSocket.
*   **Menú Digital**: Los cambios en secciones y ítems del menú son inmediatos (no requieren reinicio del servidor).

## 6. Base de Datos (Notas Técnicas)

> [!IMPORTANT]
> El sistema opera **exclusivamente con PostgreSQL**. No existe soporte para SQLite. Toda la lógica de `db.py` y `tenant_service.py` asume PostgreSQL como motor de base de datos.

*   **Pool de Conexiones**: 20 conexiones base + 10 overflow. Reciclo cada 1800s. Pre-ping activo.
*   **Schema Switching**: Se realiza exclusivamente en `get_db()`. No hay event listeners de `checkout` en el pool.
*   **Seguridad**: Cada petición resetea `search_path TO public` al terminar para prevenir fugas de datos entre tenants.
