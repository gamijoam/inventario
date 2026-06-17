-- ============================================================
-- Migration: Traslados con IMEI / seriales
-- ============================================================
-- Fecha: 2026-06-04
-- Contexto: Hasta ahora TransferDetail solo guardaba product_id + quantity.
--   Si trasladabas un celular con IMEI, el stock numérico se movia pero
--   las ProductInstance (IMEIs/seriales) quedaban en la bodega origen
--   como "fantasma" — no se movian ni se copiaban al destino.
--
-- Esta migración agrega:
--   1. Tabla junction transfer_detail_instances (N:M entre
--      transfer_details y product_instances) — audit trail de QUÉ
--      IMEIs especificos se trasladaron en cada linea.
--
-- Comportamiento (gated por feature flag 'traslados_con_imei', default OFF):
--   - Si el flag esta ON y el producto tiene has_imei=true, el POST /transfers
--     exige la misma cantidad de IMEIs en items[].instances[].
--   - Traslado INTERNO: cada ProductInstance.warehouse_id se actualiza
--     de source -> target (la instancia se "mueve" fisicamente entre bodegas).
--   - Traslado EXTERNO (inter-transfers): fase 2, no implementado aca.
--
-- Idempotente: CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS.
-- Multi-tenant: aplicar a cada schema con SET search_path.
--
-- Como aplicar (por schema de tenant):
--   SET search_path TO <schema_tenant>, public;
--   \i 2026_06_04_add_transfer_imei_support.sql
-- ============================================================

-- 1) Junction: que IMEIs especificos se trasladaron
CREATE TABLE IF NOT EXISTS transfer_detail_instances (
    id                    SERIAL PRIMARY KEY,
    transfer_detail_id    INTEGER NOT NULL REFERENCES transfer_details(id) ON DELETE CASCADE,
    product_instance_id   INTEGER NOT NULL REFERENCES product_instances(id) ON DELETE RESTRICT,
    created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(transfer_detail_id, product_instance_id)
);

CREATE INDEX IF NOT EXISTS idx_tdi_transfer_detail
    ON transfer_detail_instances(transfer_detail_id);

CREATE INDEX IF NOT EXISTS idx_tdi_product_instance
    ON transfer_detail_instances(product_instance_id);

COMMENT ON TABLE transfer_detail_instances IS
    'IMEIs/seriales especificos que se trasladaron en cada linea de un InventoryTransfer. '
    'N:M porque cada TransferDetail puede tener 0..N instancias, y cada ProductInstance '
    'puede aparecer en varios traslados a lo largo del tiempo (historico).';
