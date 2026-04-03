-- ================================================================
-- MIGRACIÓN PROD v3 — Herramientas Módulo de Compras
-- Aplicar ANTES del deploy de feature/herramientas
-- Fecha: 2026-04-03
-- ================================================================
-- IMPORTANTE: Ejecutar con:
-- docker exec -i db_prod_server psql -U postgres -d invensoft_prod < migrate_prod_v3_herramientas.sql

-- ── 1. Descuentos globales en purchase_orders (por tenant) ────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT t.schema_name FROM public.tenants t
    WHERE t.is_active = true
      AND EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = t.schema_name
          AND table_name = 'purchase_orders'
      )
  LOOP
    EXECUTE 'ALTER TABLE "' || r.schema_name || '".purchase_orders
      ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(18,4) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS discount_type   VARCHAR(20)   DEFAULT ''NONE'',
      ADD COLUMN IF NOT EXISTS discount_notes  TEXT';
  END LOOP;
END $$;

-- ── 2. Descuentos por ítem en purchase_items (por tenant) ─────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT t.schema_name FROM public.tenants t
    WHERE t.is_active = true
      AND EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = t.schema_name
          AND table_name = 'purchase_items'
      )
  LOOP
    EXECUTE 'ALTER TABLE "' || r.schema_name || '".purchase_items
      ADD COLUMN IF NOT EXISTS discount_pct    NUMERIC(10,4) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(18,4) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS subtotal        NUMERIC(18,4)';
  END LOOP;
END $$;

-- ── Verificación ──────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name='purchase_orders'
   AND column_name='discount_amount'
   AND table_schema NOT IN ('public','information_schema','pg_catalog'))
  AS tenants_con_descuento_orden,

  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name='purchase_items'
   AND column_name='discount_pct'
   AND table_schema NOT IN ('public','information_schema','pg_catalog'))
  AS tenants_con_descuento_item;
