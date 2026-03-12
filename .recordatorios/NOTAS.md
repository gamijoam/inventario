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

SQL ya aplicado en QA. Debe correrse en PROD después de subir la imagen Docker.

Correr en el VPS con:
```bash
sshpass -p 'GaboMac12' ssh root@212.28.176.157 \
  "docker exec db_prod_server psql -U postgres -d invensoft_prod -c \
  \"DO \\\$\\\$ DECLARE s TEXT; BEGIN FOR s IN SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('public','information_schema','pg_catalog','pg_toast') LOOP EXECUTE format('ALTER TABLE %I.customers ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE', s); EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_sales_is_credit ON %I.sales(is_credit) WHERE is_credit = true', replace(s,''-'',''_''), s); EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_sales_paid ON %I.sales(paid)', replace(s,''-'',''_''), s); EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_sales_due_date ON %I.sales(due_date) WHERE due_date IS NOT NULL', replace(s,''-'',''_''), s); END LOOP; END \\\$\\\$;\""
```

O paso a paso:
1. ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
2. CREATE INDEX IF NOT EXISTS idx_sales_is_credit ON sales(is_credit) WHERE is_credit = true;
3. CREATE INDEX IF NOT EXISTS idx_sales_paid ON sales(paid);
4. CREATE INDEX IF NOT EXISTS idx_sales_due_date ON sales(due_date) WHERE due_date IS NOT NULL;

---
