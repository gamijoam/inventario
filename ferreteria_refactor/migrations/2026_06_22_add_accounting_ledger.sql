-- Accounting ledger foundation.
-- Creates one append-only/idempotent ledger table per tenant schema.
-- Safe to run repeatedly. It does not replace current reports yet.

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
        IF to_regclass(format('%I.cash_sessions', tenant_schema)) IS NOT NULL THEN
            EXECUTE format($sql$
                CREATE TABLE IF NOT EXISTS %I.accounting_ledger_entries (
                    id SERIAL PRIMARY KEY,
                    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
                    occurred_at TIMESTAMP NOT NULL,
                    posted_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    source_type VARCHAR(64) NOT NULL,
                    source_id INTEGER,
                    source_line_id INTEGER,
                    source_ref VARCHAR(160),
                    event_type VARCHAR(64) NOT NULL,
                    direction VARCHAR(16) NOT NULL DEFAULT 'neutral',
                    account_code VARCHAR(80) NOT NULL,
                    account_name VARCHAR(160),
                    currency VARCHAR(16) NOT NULL DEFAULT 'USD',
                    amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
                    exchange_rate NUMERIC(14, 4) NOT NULL DEFAULT 1,
                    anchor_currency VARCHAR(16) NOT NULL DEFAULT 'USD',
                    amount_anchor NUMERIC(18, 4) NOT NULL DEFAULT 0,
                    payment_method VARCHAR(160),
                    payment_method_id INTEGER,
                    session_id INTEGER REFERENCES %I.cash_sessions(id) ON DELETE SET NULL,
                    register_id INTEGER REFERENCES %I.cash_registers(id) ON DELETE SET NULL,
                    user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
                    customer_id INTEGER REFERENCES %I.customers(id) ON DELETE SET NULL,
                    supplier_id INTEGER REFERENCES %I.suppliers(id) ON DELETE SET NULL,
                    warehouse_id INTEGER REFERENCES %I.warehouses(id) ON DELETE SET NULL,
                    affects_cash BOOLEAN NOT NULL DEFAULT FALSE,
                    affects_bank BOOLEAN NOT NULL DEFAULT FALSE,
                    affects_accounts_receivable BOOLEAN NOT NULL DEFAULT FALSE,
                    affects_accounts_payable BOOLEAN NOT NULL DEFAULT FALSE,
                    is_voided BOOLEAN NOT NULL DEFAULT FALSE,
                    voided_at TIMESTAMP,
                    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    CONSTRAINT accounting_ledger_direction_check CHECK (direction IN ('in', 'out', 'neutral')),
                    CONSTRAINT accounting_ledger_amount_check CHECK (amount >= 0)
                )
            $sql$, tenant_schema, tenant_schema, tenant_schema, tenant_schema, tenant_schema, tenant_schema);

            EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.accounting_ledger_entries (occurred_at DESC)', 'idx_accounting_ledger_occurred_at', tenant_schema);
            EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.accounting_ledger_entries (session_id, currency, affects_cash)', 'idx_accounting_ledger_session_currency', tenant_schema);
            EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.accounting_ledger_entries (source_type, source_id)', 'idx_accounting_ledger_source', tenant_schema);
            EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.accounting_ledger_entries (account_code, currency)', 'idx_accounting_ledger_account_currency', tenant_schema);
            EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.accounting_ledger_entries (register_id, occurred_at DESC)', 'idx_accounting_ledger_register_time', tenant_schema);
            EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.accounting_ledger_entries (customer_id, occurred_at DESC) WHERE customer_id IS NOT NULL', 'idx_accounting_ledger_customer_time', tenant_schema);
            EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.accounting_ledger_entries (supplier_id, occurred_at DESC) WHERE supplier_id IS NOT NULL', 'idx_accounting_ledger_supplier_time', tenant_schema);
        END IF;
    END LOOP;
END $$;

DO $$
BEGIN
    IF to_regclass('public.permissions') IS NOT NULL THEN
        INSERT INTO public.permissions (code, module, resource, action, label, description, risk_level, sort_order)
        VALUES
            ('accounting.ledger.view', 'accounting', 'ledger', 'view', 'Ver libro contable', 'Permite consultar el libro contable central y sus eventos.', 'critical', 1250),
            ('accounting.ledger.export', 'accounting', 'ledger', 'export', 'Exportar libro contable', 'Permite exportar movimientos contables por periodo.', 'critical', 1260),
            ('accounting.ledger.rebuild', 'accounting', 'ledger', 'rebuild', 'Reconstruir libro contable', 'Permite reconstruir asientos desde modulos operativos.', 'critical', 1270)
        ON CONFLICT (code) DO UPDATE SET
            module = EXCLUDED.module,
            resource = EXCLUDED.resource,
            action = EXCLUDED.action,
            label = EXCLUDED.label,
            description = EXCLUDED.description,
            risk_level = EXCLUDED.risk_level,
            sort_order = EXCLUDED.sort_order,
            is_active = TRUE;

        IF to_regclass('public.role_profiles') IS NOT NULL
           AND to_regclass('public.role_profile_permissions') IS NOT NULL THEN
            INSERT INTO public.role_profile_permissions (role_profile_id, permission_code, allowed)
            SELECT rp.id, p.code, TRUE
            FROM public.role_profiles rp
            JOIN public.permissions p ON p.code IN (
                'accounting.ledger.view',
                'accounting.ledger.export',
                'accounting.ledger.rebuild'
            )
            WHERE rp.code = 'ADMIN'
              AND rp.is_active = TRUE
            ON CONFLICT (role_profile_id, permission_code) DO UPDATE SET allowed = TRUE;
        END IF;
    END IF;
END $$;
