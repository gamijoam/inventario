-- Promotional gift items for products.
-- Lets a sale charge the parent product while including stock-deducted bonus items at $0.
-- Safe to run repeatedly across tenant schemas.

DO $$
DECLARE
    tenant_record RECORD;
    index_prefix TEXT;
    constraint_name TEXT;
BEGIN
    FOR tenant_record IN
        SELECT schema_name
        FROM public.tenants
        WHERE is_active = TRUE
          AND schema_name IS NOT NULL
          AND EXISTS (
              SELECT 1
              FROM information_schema.tables
              WHERE table_schema = schema_name
                AND table_name = 'products'
          )
    LOOP
        index_prefix := 'ix_ppromo_' || substr(md5(tenant_record.schema_name), 1, 10);

        EXECUTE format($sql$
            CREATE TABLE IF NOT EXISTS %I.product_promotion_items (
                id SERIAL PRIMARY KEY,
                parent_product_id INTEGER NOT NULL,
                child_product_id INTEGER NOT NULL,
                quantity NUMERIC(12, 3) NOT NULL DEFAULT 1.000,
                unit_id INTEGER NULL,
                label VARCHAR(120),
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
                CONSTRAINT product_promotion_items_qty_check CHECK (quantity > 0),
                CONSTRAINT product_promotion_items_not_self CHECK (parent_product_id <> child_product_id)
            )
        $sql$, tenant_record.schema_name);

        constraint_name := 'fk_' || substr(md5(tenant_record.schema_name || '_ppromo_parent'), 1, 22);
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = constraint_name) THEN
            EXECUTE format(
                'ALTER TABLE %I.product_promotion_items ADD CONSTRAINT %I FOREIGN KEY (parent_product_id) REFERENCES %I.products(id) ON DELETE CASCADE',
                tenant_record.schema_name, constraint_name, tenant_record.schema_name
            );
        END IF;

        constraint_name := 'fk_' || substr(md5(tenant_record.schema_name || '_ppromo_child'), 1, 22);
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = constraint_name) THEN
            EXECUTE format(
                'ALTER TABLE %I.product_promotion_items ADD CONSTRAINT %I FOREIGN KEY (child_product_id) REFERENCES %I.products(id) ON DELETE RESTRICT',
                tenant_record.schema_name, constraint_name, tenant_record.schema_name
            );
        END IF;

        constraint_name := 'fk_' || substr(md5(tenant_record.schema_name || '_ppromo_unit'), 1, 22);
        IF to_regclass(format('%I.product_units', tenant_record.schema_name)) IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = constraint_name) THEN
            EXECUTE format(
                'ALTER TABLE %I.product_promotion_items ADD CONSTRAINT %I FOREIGN KEY (unit_id) REFERENCES %I.product_units(id) ON DELETE SET NULL',
                tenant_record.schema_name, constraint_name, tenant_record.schema_name
            );
        END IF;

        EXECUTE format(
            'CREATE UNIQUE INDEX IF NOT EXISTS %I ON %I.product_promotion_items(parent_product_id, child_product_id, COALESCE(unit_id, 0)) WHERE is_active = TRUE',
            index_prefix || '_uniq_active', tenant_record.schema_name
        );
        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS %I ON %I.product_promotion_items(parent_product_id, is_active)',
            index_prefix || '_parent_active', tenant_record.schema_name
        );
        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS %I ON %I.product_promotion_items(child_product_id)',
            index_prefix || '_child', tenant_record.schema_name
        );
    END LOOP;
END $$;
