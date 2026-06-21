-- Persistent print job audit for thermal tickets and raw print payloads.
-- Safe to run multiple times. Applies to every active tenant schema that has sales/cash_registers.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
                AND table_name = 'sales'
          )
          AND EXISTS (
              SELECT 1
              FROM information_schema.tables
              WHERE table_schema = schema_name
                AND table_name = 'cash_registers'
          )
    LOOP
        EXECUTE format($sql$
            CREATE TABLE IF NOT EXISTS %I.print_jobs (
                id SERIAL PRIMARY KEY,
                job_uuid UUID NOT NULL DEFAULT gen_random_uuid(),
                job_type VARCHAR(32) NOT NULL DEFAULT 'ticket',
                status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
                sale_id INTEGER NULL REFERENCES %I.sales(id) ON DELETE SET NULL,
                register_id INTEGER NULL REFERENCES %I.cash_registers(id) ON DELETE SET NULL,
                user_id INTEGER NULL REFERENCES public.users(id) ON DELETE SET NULL,
                requested_client_id VARCHAR(128),
                resolved_client_id VARCHAR(128),
                route VARCHAR(64),
                source VARCHAR(64) NOT NULL DEFAULT 'web',
                request_payload JSONB,
                response_payload JSONB,
                error_message TEXT,
                attempts INTEGER NOT NULL DEFAULT 1,
                created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
                sent_at TIMESTAMP WITHOUT TIME ZONE,
                failed_at TIMESTAMP WITHOUT TIME ZONE,
                updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
            )
        $sql$, tenant_record.schema_name, tenant_record.schema_name, tenant_record.schema_name);

        EXECUTE format(
            'CREATE UNIQUE INDEX IF NOT EXISTS ix_%s_print_jobs_job_uuid ON %I.print_jobs(job_uuid)',
            tenant_record.schema_name,
            tenant_record.schema_name
        );
        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS ix_%s_print_jobs_status_created ON %I.print_jobs(status, created_at DESC)',
            tenant_record.schema_name,
            tenant_record.schema_name
        );
        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS ix_%s_print_jobs_sale_id ON %I.print_jobs(sale_id)',
            tenant_record.schema_name,
            tenant_record.schema_name
        );
        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS ix_%s_print_jobs_register_id ON %I.print_jobs(register_id)',
            tenant_record.schema_name,
            tenant_record.schema_name
        );
        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS ix_%s_print_jobs_client_id ON %I.print_jobs(resolved_client_id)',
            tenant_record.schema_name,
            tenant_record.schema_name
        );
    END LOOP;
END $$;
