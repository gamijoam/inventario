-- Migration: add indexes for POS catalog and sale hot paths
-- Date: 2026-06-06
--
-- WHY
-- The POS catalog loads products, then related units, stocks and price-list rows
-- through product_id batches. Sale flows also validate available IMEI instances by
-- product/warehouse/status. These indexes keep those reads fast as tenants grow.
--
-- TARGET
-- Multi-tenant schemas. Safe to re-run; indexes are created only when missing.
-- Apply to QA first. For production, run this same SQL during a low-traffic window.

DO $$
DECLARE
    tenant_schema text;
BEGIN
    FOR tenant_schema IN
        SELECT n.nspname
        FROM pg_namespace n
        WHERE n.nspname NOT IN ('public', 'information_schema')
          AND n.nspname NOT LIKE 'pg_%'
          AND to_regclass(format('%I.products', n.nspname)) IS NOT NULL
    LOOP
        IF to_regclass(format('%I.product_stocks', tenant_schema)) IS NOT NULL THEN
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS %I ON %I.product_stocks (product_id, warehouse_id)',
                'idx_product_stocks_product_warehouse', tenant_schema
            );
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS %I ON %I.product_stocks (warehouse_id, product_id) WHERE quantity > 0',
                'idx_product_stocks_available_by_warehouse', tenant_schema
            );
        END IF;

        IF to_regclass(format('%I.product_units', tenant_schema)) IS NOT NULL THEN
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS %I ON %I.product_units (product_id)',
                'idx_product_units_product_id', tenant_schema
            );
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS %I ON %I.product_units (lower(barcode)) WHERE barcode IS NOT NULL',
                'idx_product_units_lower_barcode', tenant_schema
            );
        END IF;

        IF to_regclass(format('%I.product_prices', tenant_schema)) IS NOT NULL THEN
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS %I ON %I.product_prices (product_id, price_list_id)',
                'idx_product_prices_product_list', tenant_schema
            );
        END IF;

        IF to_regclass(format('%I.product_instances', tenant_schema)) IS NOT NULL THEN
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS %I ON %I.product_instances (product_id, warehouse_id, status)',
                'idx_product_instances_product_warehouse_status', tenant_schema
            );
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS %I ON %I.product_instances (warehouse_id, status) WHERE status = ''AVAILABLE''',
                'idx_product_instances_available_by_warehouse', tenant_schema
            );
        END IF;
    END LOOP;
END $$;
