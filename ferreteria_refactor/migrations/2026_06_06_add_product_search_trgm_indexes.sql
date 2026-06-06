-- Speed up POS catalog searches that use ILIKE '%term%' on product name/SKU.
-- Safe to run multiple times.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$
DECLARE
    s text;
BEGIN
    FOR s IN
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
          AND schema_name NOT LIKE 'pg_temp_%'
          AND schema_name NOT LIKE 'pg_toast_temp_%'
    LOOP
        IF to_regclass(format('%I.products', s)) IS NOT NULL THEN
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS ix_products_name_trgm ON %I.products USING gin (name gin_trgm_ops)',
                s
            );
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS ix_products_sku_trgm ON %I.products USING gin (sku gin_trgm_ops)',
                s
            );
        END IF;
    END LOOP;
END $$;
