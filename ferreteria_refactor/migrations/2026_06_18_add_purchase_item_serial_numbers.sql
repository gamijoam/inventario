-- Add serial tracking payload to purchase line items.
-- Backend PurchaseItem model expects this column when listing purchases.
-- Safe to run multiple times and across all active tenant schemas.

DO $$
DECLARE
    tenant_record RECORD;
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
                AND table_name = 'purchase_items'
          )
    LOOP
        EXECUTE format(
            'ALTER TABLE %I.purchase_items ADD COLUMN IF NOT EXISTS serial_numbers TEXT',
            tenant_record.schema_name
        );
    END LOOP;
END $$;
