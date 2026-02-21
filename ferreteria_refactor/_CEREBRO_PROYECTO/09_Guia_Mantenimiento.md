# 09 - Guía de Mantenimiento y Operaciones de Datos

Procedimientos para la continuidad operativa de **Mi Inventario Fácil**.

## 1. Gestión de Esquemas Globales
El mantenimiento de la estructura de tablas se realiza mediante el script de migración masiva:
`python scripts/migrate_tenants.py`
Este script itera por cada base de datos de cliente instalada y aplica los cambios definidos en Alembic.

## 2. Ciclo de Vida del Cliente
1.  Creación de registro en el panel de control SaaS.
2.  Generación automática de esquema PostgreSQL dedicado.
3.  Carga de catálogo base inicial (opcional).

## 3. Mantenimiento de Hardware
*   Revisión de logs locales en las estaciones de trabajo para diagnosticar fallas de impresión.
*   Actualización remota del Bridge C# cuando se agregan nuevas funciones de hardware (como balanza o lectores biométricos).

## 4. Resguardo de la Información
*   **DB Backups**: Dump diario del motor PostgreSQL.
*   **Media Backups**: Sincronización de la carpeta de imágenes de productos y comprobantes de servicios técnicos hacia almacenamiento seguro fuera del servidor.

## 5. Módulo Restaurante (ADVERTENCIA)
> [!IMPORTANT]
> Los procedimientos de mantenimiento para el módulo de restaurante aún no están definidos, ya que el módulo se encuentra en fase de desarrollo activo.
