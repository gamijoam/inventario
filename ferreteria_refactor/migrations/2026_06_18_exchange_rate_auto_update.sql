-- Add explicit automatic/manual exchange-rate controls per tenant.
-- Only rates marked as automatic BCV are touched by the scheduler.

DO $$
DECLARE
    tenant_schema TEXT;
BEGIN
    FOR tenant_schema IN
        SELECT schema_name
        FROM public.tenants
        WHERE is_active = TRUE
    LOOP
        IF EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = tenant_schema
              AND table_name = 'exchange_rates'
        ) THEN
            EXECUTE format('ALTER TABLE %I.exchange_rates ADD COLUMN IF NOT EXISTS auto_update_enabled BOOLEAN NOT NULL DEFAULT FALSE', tenant_schema);
            EXECUTE format('ALTER TABLE %I.exchange_rates ADD COLUMN IF NOT EXISTS auto_update_source VARCHAR(32) NOT NULL DEFAULT ''manual''', tenant_schema);

            -- Preserve manual/custom rates. Only existing rates explicitly named BCV start automatic.
            EXECUTE format($sql$
                UPDATE %I.exchange_rates
                   SET auto_update_enabled = TRUE,
                       auto_update_source = 'bcv_usd'
                 WHERE is_active = TRUE
                   AND name ILIKE '%%BCV%%'
                   AND COALESCE(auto_update_source, 'manual') = 'manual'
            $sql$, tenant_schema);
        END IF;
    END LOOP;
END $$;
