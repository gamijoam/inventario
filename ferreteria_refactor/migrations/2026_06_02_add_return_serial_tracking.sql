-- ============================================================
-- Migración: Tracking explicito de IMEIs/serials en devoluciones
-- ============================================================
-- Fecha: 2026-06-02
-- Contexto: Fix 4 de la auditoria de devoluciones. Hasta ahora
--   ReturnDetail no guardaba QUÉ ProductInstance (IMEI/serial)
--   específico se devolvía — solo product_id + quantity. Eso causaba:
--     - Bug de restauracion no determinista (Fix 2: ahora con
--       order_by, pero sigue siendo "best-effort")
--     - Phantom link en SaleDetailInstance (la venta vieja seguia
--       reclamando el IMEI devuelto y re-vendido)
--     - Imposibilidad de limpiar devoluciones dañadas parciales
--       pasadas (no se sabía cuáles instancias específicas)
--
-- Esta migración agrega:
--   1. Tabla junction return_detail_instances (N:M entre
--      return_details y product_instances) — audit trail de QUÉ
--      IMEIs se devolvieron en cada línea.
--   2. Columnas status/returned_at/returned_in_return_id en
--      sale_detail_instances — el link venta↔instancia ahora
--      tiene un status (SOLD|RETURNED) para distinguir el link
--      activo del devuelto, en vez de eliminarlo (eliminario
--      rompía /rma/check y el lookup de garantía).
--
-- Con esto:
--   - El frontend puede pedirle al cajero "marca cuáles IMEIs
--     devuelves" y el backend lo trackea explicitamente.
--   - Las queries por IMEI distinguen "link activo" (status=SOLD)
--     vs "link histórico devuelto" (status=RETURNED).
--   - La junction permite auditoría completa: "el IMEI X fue
--     devuelto en la venta V, línea L, condición C".
--
-- Idempotente: CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS.
-- Backfill: existing sale_detail_instances quedan con status='SOLD'
-- (default) y returned_at NULL (consistente con su estado actual).
--
-- Ejecutar con: SET search_path TO <schema_tenant>, public;
-- ============================================================

-- 1) Junction: qué IMEIs específicos se devolvieron
CREATE TABLE IF NOT EXISTS return_detail_instances (
    id SERIAL PRIMARY KEY,
    return_detail_id INTEGER NOT NULL REFERENCES return_details(id) ON DELETE CASCADE,
    product_instance_id INTEGER NOT NULL REFERENCES product_instances(id),
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rdi_return_detail ON return_detail_instances(return_detail_id);
CREATE INDEX IF NOT EXISTS idx_rdi_product_instance ON return_detail_instances(product_instance_id);

-- 2) Estado del link venta↔instancia (SOLD = activo, RETURNED = devuelto)
ALTER TABLE sale_detail_instances
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'SOLD';
ALTER TABLE sale_detail_instances
    ADD COLUMN IF NOT EXISTS returned_at TIMESTAMP;
ALTER TABLE sale_detail_instances
    ADD COLUMN IF NOT EXISTS returned_in_return_id INTEGER REFERENCES returns(id);

-- Backfill defensivo (por si la tabla existia sin default en alguna migracion vieja)
UPDATE sale_detail_instances SET status = 'SOLD' WHERE status IS NULL;

-- Indice para queries de warranty/RMA (filtrar por status='SOLD' = link activo)
CREATE INDEX IF NOT EXISTS idx_sdi_status ON sale_detail_instances(status);
