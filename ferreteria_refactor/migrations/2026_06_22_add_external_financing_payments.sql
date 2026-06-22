-- External financing payments ledger.
-- Tracks payments received from financing companies without creating duplicate sales.
-- Safe to run repeatedly across all tenant schemas.

DO $$
DECLARE
    tenant_schema text;
BEGIN
    FOR tenant_schema IN
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
          AND schema_name NOT LIKE 'pg_temp_%'
          AND schema_name NOT LIKE 'pg_toast_temp_%'
    LOOP
        IF to_regclass(format('%I.external_financings', tenant_schema)) IS NOT NULL THEN
            EXECUTE format($sql$
                CREATE TABLE IF NOT EXISTS %I.external_financing_payments (
                    id SERIAL PRIMARY KEY,
                    external_financing_id INTEGER NOT NULL REFERENCES %I.external_financings(id) ON DELETE CASCADE,
                    amount NUMERIC(18, 4) NOT NULL,
                    currency VARCHAR(16) NOT NULL DEFAULT 'USD',
                    exchange_rate NUMERIC(14, 4) NOT NULL DEFAULT 1,
                    amount_usd NUMERIC(18, 4) NOT NULL DEFAULT 0,
                    payment_method VARCHAR(160),
                    reference VARCHAR(160),
                    notes TEXT,
                    session_id INTEGER REFERENCES %I.cash_sessions(id) ON DELETE SET NULL,
                    cash_movement_id INTEGER REFERENCES %I.cash_movements(id) ON DELETE SET NULL,
                    received_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    CONSTRAINT external_financing_payments_amount_check CHECK (amount > 0),
                    CONSTRAINT external_financing_payments_amount_usd_check CHECK (amount_usd >= 0)
                )
            $sql$, tenant_schema, tenant_schema, tenant_schema, tenant_schema);

            EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.external_financing_payments (external_financing_id, received_at DESC)', 'idx_external_financing_payments_record_time', tenant_schema);
            EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.external_financing_payments (session_id)', 'idx_external_financing_payments_session_id', tenant_schema);
            EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.external_financing_payments (cash_movement_id)', 'idx_external_financing_payments_cash_movement_id', tenant_schema);
        END IF;
    END LOOP;
END $$;
