# 📋 Recordatorios y Pendientes

> Archivo gestionado por Claude Code. No editar manualmente.

---

## [001] Verificar notificaciones en tiempo real del panel SaaS al cliente sobre bugs
**Fecha:** 2026-03-12 12:00
**Estado:** completado
**Completado:** 2026-03-12 18:00
**Categoría:** bug

Notificaciones WebSocket implementadas — badge en Sidebar del cliente (unread responses) y badge en admin panel (pending tickets) con polling cada 60s. Commit: cca3ced.

---

## [002] Arreglar bug: no se puede anular una venta
**Fecha:** 2026-03-12 12:00
**Estado:** completado
**Completado:** 2026-03-12 18:00
**Categoría:** bug

Anulación de ventas corregida en SalesTab.jsx — endpoint correcto + desempaquetado de respuesta paginada. Commit: b01de09.

---

## [003] Revisar el panel unificado de reportes
**Fecha:** 2026-03-12 12:00
**Estado:** completado
**Completado:** 2026-03-12 18:00
**Categoría:** feature

ReportsCenter auditado y corregido: schema mismatch CashTab, dateRange conectado en CreditsTab/InventoryTab/CommissionsTab, duplicado CashHistory eliminado, NULL currency handling, preset buttons. Commit: b01de09.

---

## [004] Permitir eliminar clientes definitivamente del sistema
**Fecha:** 2026-03-12 12:00
**Estado:** completado
**Completado:** 2026-03-12 18:00
**Categoría:** feature

Implementada eliminación lógica (is_active=False) en lugar de eliminación física para mantener integridad referencial con facturas y créditos. Columna agregada en QA. Ver nota [009] para SQL de producción.

---

## [005] Indicadores visuales de stock por colores en productos
**Fecha:** 2026-03-12 12:00
**Estado:** completado
**Completado:** 2026-03-12 18:00
**Categoría:** feature

Indicadores de color ya implementados en ProductMobileCard.jsx y en la tabla desktop de Products.jsx. Verde=en stock, Amarillo=bajo stock, Rojo=agotado. Commit: b01de09.

---

## [006] Cursor fijo en buscador de productos al seleccionar
**Fecha:** 2026-03-12 12:00
**Estado:** completado
**Completado:** 2026-03-12 18:00
**Categoría:** bug

Cursor permanece en campo buscador al seleccionar producto. Commit: b01de09.

---

## [007] Mostrar saldo disponible de crédito del cliente en el POS
**Fecha:** 2026-03-12 12:00
**Estado:** completado
**Completado:** 2026-03-12 18:00
**Categoría:** feature

Saldo de crédito disponible visible al seleccionar cliente en POS. Commit: b01de09.

---

## [008] Error del servidor al hacer un avance en el POS
**Fecha:** 2026-03-12 12:00
**Estado:** completado
**Completado:** 2026-03-12 18:00
**Categoría:** bug

Error de avance/abono corregido. Además se redujo el selector de moneda a solo 2 opciones (USD + Bs), eliminando BCV y Paralelo del selector de pagos. Commit: b01de09.

---

## [009] ⚠️ SQL PENDIENTE — Aplicar a PRODUCCIÓN al subir imagen
**Fecha:** 2026-03-12 18:00
**Estado:** pendiente
**Categoría:** deploy

SQL pendiente para PROD: M001 (is_active) y M002 (índices sales).
Ver detalle completo en: `_CEREBRO_PROYECTO/20_Migraciones_SQL_Pendientes.md`

---

## [011] Merge pendiente hotfix/suppliers-prod → feature/reports-center
**Fecha:** 2026-03-13 19:30
**Estado:** pendiente
**Categoría:** deploy

La rama `hotfix/suppliers-prod` tiene fixes de proveedores + anulación de facturas (commits 869e8d6, 4c56d1c, 6d6f1fd) que no están en `feature/reports-center`. Antes de subir `feature/reports-center` a QA, hacer:

```bash
git checkout feature/reports-center && git merge hotfix/suppliers-prod
```

La rama `feature/reports-center` tiene todos los módulos nuevos (InventoryCenter, SalesCenter, ConfigCenter, Farmacia, ReportsCenter).

---

## [010] Landing page + SaaS admin — activación módulo Farmacia
**Fecha:** 2026-03-12 19:00
**Estado:** completado
**Completado:** 2026-03-12 20:00
**Categoría:** feature

Dos cosas pendientes del módulo farmacia:

(1) **Landing page**: Cuando el usuario elige "Farmacia" como tipo de negocio en el formulario de registro, debe activarse `has_pharmacy_module` automáticamente. El keyword detection en `tenant_service.py` ya cubre "FARMACIA"/"DROGUERIA"/"BOTICA" — verificar que el dropdown/formulario de la landing envía ese valor. Si usa opciones predefinidas, asegurarse de que "Farmacia" esté listada y mapee correctamente.

(2) **Panel SaaS admin**: En `saas_admin/`, agregar el módulo Farmacia al panel de gestión de módulos por tenant (donde se activan/desactivan Restaurante, Barbería, Lavandería, Servicios). El admin SaaS debe poder activar/desactivar `has_pharmacy_module` desde la interfaz, igual que los demás módulos.

---
