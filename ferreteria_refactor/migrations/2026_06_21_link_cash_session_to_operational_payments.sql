-- Link operational payments to cash sessions for reliable cash reconciliation.
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
        IF to_regclass(format('%I.purchase_payments', tenant_schema)) IS NOT NULL THEN
            EXECUTE format('ALTER TABLE %I.purchase_payments ADD COLUMN IF NOT EXISTS session_id INTEGER', tenant_schema);
            IF to_regclass(format('%I.cash_sessions', tenant_schema)) IS NOT NULL THEN
                EXECUTE format('
                    DO $inner$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1
                            FROM pg_constraint
                            WHERE conname = %L
                              AND conrelid = %L::regclass
                        ) THEN
                            ALTER TABLE %I.purchase_payments
                            ADD CONSTRAINT %I FOREIGN KEY (session_id) REFERENCES %I.cash_sessions(id) ON DELETE SET NULL;
                        END IF;
                    END
                    $inner$;
                ',
                    'fk_purchase_payments_session_id',
                    format('%I.purchase_payments', tenant_schema),
                    tenant_schema,
                    'fk_purchase_payments_session_id',
                    tenant_schema
                );
            END IF;
            EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.purchase_payments (session_id)', 'idx_purchase_payments_session_id', tenant_schema);
        END IF;

        IF to_regclass(format('%I.service_payments', tenant_schema)) IS NOT NULL THEN
            EXECUTE format('ALTER TABLE %I.service_payments ADD COLUMN IF NOT EXISTS session_id INTEGER', tenant_schema);
            IF to_regclass(format('%I.cash_sessions', tenant_schema)) IS NOT NULL THEN
                EXECUTE format('
                    DO $inner$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1
                            FROM pg_constraint
                            WHERE conname = %L
                              AND conrelid = %L::regclass
                        ) THEN
                            ALTER TABLE %I.service_payments
                            ADD CONSTRAINT %I FOREIGN KEY (session_id) REFERENCES %I.cash_sessions(id) ON DELETE SET NULL;
                        END IF;
                    END
                    $inner$;
                ',
                    'fk_service_payments_session_id',
                    format('%I.service_payments', tenant_schema),
                    tenant_schema,
                    'fk_service_payments_session_id',
                    tenant_schema
                );
            END IF;
            EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.service_payments (session_id)', 'idx_service_payments_session_id', tenant_schema);
        END IF;
    END LOOP;
END $$;
