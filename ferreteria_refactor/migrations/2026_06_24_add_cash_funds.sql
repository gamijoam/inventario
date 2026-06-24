-- Physical cash fund layer for multi-register setups.
-- Safe to run multiple times. Applies to every active tenant with cash_registers/cash_sessions.

DO $$
DECLARE
    tenant_record RECORD;
    register_record RECORD;
    fund_id INTEGER;
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
                AND table_name = 'cash_registers'
          )
    LOOP
        index_prefix := 'ix_cf_' || substr(md5(tenant_record.schema_name), 1, 12);

        EXECUTE format($sql$
            CREATE TABLE IF NOT EXISTS %I.cash_funds (
                id SERIAL PRIMARY KEY,
                name VARCHAR NOT NULL,
                code VARCHAR(40) NOT NULL,
                description TEXT,
                is_shared BOOLEAN NOT NULL DEFAULT FALSE,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
            )
        $sql$, tenant_record.schema_name);

        EXECUTE format(
            'CREATE UNIQUE INDEX IF NOT EXISTS %I ON %I.cash_funds(code)',
            index_prefix || '_code',
            tenant_record.schema_name
        );
        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS %I ON %I.cash_funds(is_active, is_shared)',
            index_prefix || '_active_shared',
            tenant_record.schema_name
        );

        EXECUTE format('ALTER TABLE %I.cash_registers ADD COLUMN IF NOT EXISTS cash_fund_id INTEGER', tenant_record.schema_name);
        EXECUTE format('ALTER TABLE %I.cash_sessions ADD COLUMN IF NOT EXISTS cash_fund_id INTEGER', tenant_record.schema_name);

        constraint_name := 'fk_' || substr(md5(tenant_record.schema_name || '_cash_registers_cash_fund'), 1, 20);
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = constraint_name) THEN
            EXECUTE format(
                'ALTER TABLE %I.cash_registers ADD CONSTRAINT %I FOREIGN KEY (cash_fund_id) REFERENCES %I.cash_funds(id) ON DELETE SET NULL',
                tenant_record.schema_name,
                constraint_name,
                tenant_record.schema_name
            );
        END IF;

        constraint_name := 'fk_' || substr(md5(tenant_record.schema_name || '_cash_sessions_cash_fund'), 1, 20);
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = constraint_name) THEN
            EXECUTE format(
                'ALTER TABLE %I.cash_sessions ADD CONSTRAINT %I FOREIGN KEY (cash_fund_id) REFERENCES %I.cash_funds(id) ON DELETE SET NULL',
                tenant_record.schema_name,
                constraint_name,
                tenant_record.schema_name
            );
        END IF;

        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS %I ON %I.cash_registers(cash_fund_id)',
            index_prefix || '_reg_fund',
            tenant_record.schema_name
        );
        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS %I ON %I.cash_sessions(cash_fund_id)',
            index_prefix || '_sess_fund',
            tenant_record.schema_name
        );

        FOR register_record IN EXECUTE format(
            'SELECT id, code, name FROM %I.cash_registers WHERE cash_fund_id IS NULL ORDER BY id',
            tenant_record.schema_name
        )
        LOOP
            EXECUTE format($sql$
                INSERT INTO %I.cash_funds (name, code, description, is_shared, is_active)
                VALUES ($1, $2, $3, FALSE, TRUE)
                ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
                RETURNING id
            $sql$, tenant_record.schema_name)
            INTO fund_id
            USING
                concat(register_record.code, ' ', register_record.name),
                left('FONDO-' || regexp_replace(upper(coalesce(register_record.code, register_record.id::text)), '[^A-Z0-9_-]+', '-', 'g'), 40),
                'Fondo individual creado por migración para esta caja.';

            EXECUTE format(
                'UPDATE %I.cash_registers SET cash_fund_id = $1 WHERE id = $2',
                tenant_record.schema_name
            ) USING fund_id, register_record.id;
        END LOOP;

        EXECUTE format($sql$
            UPDATE %I.cash_sessions s
            SET cash_fund_id = r.cash_fund_id
            FROM %I.cash_registers r
            WHERE s.register_id = r.id
              AND s.cash_fund_id IS NULL
        $sql$, tenant_record.schema_name, tenant_record.schema_name);
    END LOOP;
END $$;
