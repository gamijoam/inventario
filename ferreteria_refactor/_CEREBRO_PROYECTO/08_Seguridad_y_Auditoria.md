# 08 - Seguridad y Auditoría (RBAC y Trazabilidad)

Protocolos de seguridad y aseguramiento de datos en **Mi Inventario Fácil**.

## 1. Aislamiento Multi-Tenant
*   **Schema Isolation**: Cada cliente (Ferretería, Lavandería, etc.) tiene su propia base de datos lógica.
*   **Validation**: El middleware valida cada petición garantizando que un usuario solo acceda a los datos de su propia suscripción.

## 2. Roles y Permisos (RBAC)
*   **ADMIN**: Control total del negocio y configuraciones globales.
*   **CASHIER**: Limitado a ventas y gestión de efectivo de su turno.
*   **WAREHOUSE**: Permisos específicos para recepciones y conteos de stock.

## 3. Autorización por PIN
Acciones sensibles (Descuentos altos, crédito a morosos) disparan una solicitud de PIN. Un administrador debe ingresar su código de autorización para que el sistema permita procesar la excepción.

## 4. AuditLog (Registro de Actividad)
Toda modificación de datos genera una entrada en la tabla de auditoría:
*   **Timestamp**: Momento exacto de la acción.
*   **User**: Quién lo hizo.
*   **Action**: `CREATE`, `UPDATE` o `DELETE`.
*   **State**: Snapshot de los datos antes y después del cambio para auditorías técnicas.
