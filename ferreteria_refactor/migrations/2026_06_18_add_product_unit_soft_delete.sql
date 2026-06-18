-- Migration: logical deletion for product presentations
-- Date: 2026-06-18
--
-- Presentations are referenced by sale history, so they must not be physically
-- deleted when a user removes them from the product form. This column lets the
-- app hide archived presentations from POS/catalog while preserving history.

DO $$
DECLARE
    tenant_schema text;
BEGIN
    FOR tenant_schema IN
        SELECT n.nspname
        FROM pg_namespace n
        WHERE n.nspname NOT IN ('public', 'information_schema')
          AND n.nspname NOT LIKE 'pg_%'
          AND to_regclass(format('%I.product_units', n.nspname)) IS NOT NULL
    LOOP
        EXECUTE format(
            'ALTER TABLE %I.product_units ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true',
            tenant_schema
        );

        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS %I ON %I.product_units (product_id, is_active)',
            'idx_product_units_product_active',
            tenant_schema
        );

        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS %I ON %I.product_units (lower(unit_name), conversion_factor) WHERE is_active = true',
            'idx_product_units_active_name_factor',
            tenant_schema
        );

        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS %I ON %I.product_units (lower(barcode)) WHERE is_active = true AND barcode IS NOT NULL',
            'idx_product_units_active_lower_barcode',
            tenant_schema
        );
    END LOOP;
END $$;
