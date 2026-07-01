-- Offline sync metadata foundation.
-- Adds idempotency/status columns to operational tenant tables so local desktop nodes
-- can push/retry movements without duplicating cash, returns, credits or layaways.
-- Safe to run repeatedly. Applies only to active tenants and existing tables.

DO $$
DECLARE
    tenant_record RECORD;
    target_table TEXT;
    index_prefix TEXT;
    sync_tables TEXT[] := ARRAY[
        'sale_payments',
        'sale_details',
        'sale_detail_instances',
        'cash_sessions',
        'cash_session_currencies',
        'cash_movements',
        'returns',
        'return_details',
        'return_detail_instances',
        'payments',
        'layaways',
        'layaway_items',
        'layaway_payments',
        'layaway_events',
        'accounting_ledger_entries'
    ];
BEGIN
    FOR tenant_record IN
        SELECT schema_name
        FROM public.tenants
        WHERE is_active = TRUE
          AND schema_name IS NOT NULL
    LOOP
        FOREACH target_table IN ARRAY sync_tables
        LOOP
            IF EXISTS (
                SELECT 1
                FROM information_schema.tables t
                WHERE t.table_schema = tenant_record.schema_name
                  AND t.table_name = target_table
            ) THEN
                index_prefix := 'ix_sync_' || substr(md5(tenant_record.schema_name || '_' || target_table), 1, 16);

                EXECUTE format('ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS sync_uuid VARCHAR(36)', tenant_record.schema_name, target_table);
                EXECUTE format('ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS sync_status VARCHAR(20) DEFAULT ''SYNCED''', tenant_record.schema_name, target_table);
                EXECUTE format('ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS is_offline_origin BOOLEAN DEFAULT FALSE', tenant_record.schema_name, target_table);
                EXECUTE format('ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS synced_at TIMESTAMP WITHOUT TIME ZONE', tenant_record.schema_name, target_table);
                EXECUTE format('ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS sync_error TEXT', tenant_record.schema_name, target_table);

                EXECUTE format(
                    'CREATE UNIQUE INDEX IF NOT EXISTS %I ON %I.%I(sync_uuid) WHERE sync_uuid IS NOT NULL',
                    index_prefix || '_uuid',
                    tenant_record.schema_name,
                    target_table
                );
                EXECUTE format(
                    'CREATE INDEX IF NOT EXISTS %I ON %I.%I(sync_status, is_offline_origin)',
                    index_prefix || '_status',
                    tenant_record.schema_name,
                    target_table
                );
            END IF;
        END LOOP;
    END LOOP;
END $$;
