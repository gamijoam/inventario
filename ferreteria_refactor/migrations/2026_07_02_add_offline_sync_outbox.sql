-- Offline sync event queue and conflict tracking.
-- This is the durable foundation for desktop/offline mode:
-- local nodes store business events, retry safely, and keep conflicts visible.
-- Safe to run repeatedly. Applies to active tenant schemas.

DO $$
DECLARE
    tenant_record RECORD;
BEGIN
    FOR tenant_record IN
        SELECT schema_name
        FROM public.tenants
        WHERE is_active = TRUE
          AND schema_name IS NOT NULL
    LOOP
        EXECUTE format($sql$
            CREATE TABLE IF NOT EXISTS %I.sync_outbox (
                id SERIAL PRIMARY KEY,
                event_uuid VARCHAR(36) NOT NULL UNIQUE,
                event_type VARCHAR(80) NOT NULL,
                aggregate_type VARCHAR(80),
                aggregate_uuid VARCHAR(36),
                source_terminal_id VARCHAR(120),
                cash_session_uuid VARCHAR(36),
                payload JSONB NOT NULL DEFAULT '{}'::jsonb,
                status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
                attempts INTEGER NOT NULL DEFAULT 0,
                last_error TEXT,
                locked_at TIMESTAMP WITHOUT TIME ZONE,
                pushed_at TIMESTAMP WITHOUT TIME ZONE,
                created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
            )
        $sql$, tenant_record.schema_name);

        EXECUTE format($sql$
            CREATE INDEX IF NOT EXISTS %I
            ON %I.sync_outbox(status, created_at)
        $sql$, 'ix_sync_outbox_status_' || substr(md5(tenant_record.schema_name), 1, 10), tenant_record.schema_name);

        EXECUTE format($sql$
            CREATE INDEX IF NOT EXISTS %I
            ON %I.sync_outbox(event_type, aggregate_uuid)
        $sql$, 'ix_sync_outbox_event_' || substr(md5(tenant_record.schema_name), 1, 10), tenant_record.schema_name);

        EXECUTE format($sql$
            CREATE TABLE IF NOT EXISTS %I.sync_state (
                id SERIAL PRIMARY KEY,
                scope VARCHAR(80) NOT NULL UNIQUE,
                cursor_value VARCHAR(160),
                last_pull_at TIMESTAMP WITHOUT TIME ZONE,
                last_push_at TIMESTAMP WITHOUT TIME ZONE,
                last_success_at TIMESTAMP WITHOUT TIME ZONE,
                last_error TEXT,
                metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
                updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
            )
        $sql$, tenant_record.schema_name);

        EXECUTE format($sql$
            CREATE TABLE IF NOT EXISTS %I.sync_conflicts (
                id SERIAL PRIMARY KEY,
                conflict_uuid VARCHAR(36) NOT NULL UNIQUE,
                event_uuid VARCHAR(36),
                event_type VARCHAR(80),
                aggregate_type VARCHAR(80),
                aggregate_uuid VARCHAR(36),
                severity VARCHAR(20) NOT NULL DEFAULT 'BLOCKING',
                status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
                reason TEXT NOT NULL,
                local_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
                cloud_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
                resolved_by INTEGER,
                resolved_at TIMESTAMP WITHOUT TIME ZONE,
                resolution_note TEXT,
                created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
            )
        $sql$, tenant_record.schema_name);

        EXECUTE format($sql$
            CREATE INDEX IF NOT EXISTS %I
            ON %I.sync_conflicts(status, severity, created_at)
        $sql$, 'ix_sync_conflicts_status_' || substr(md5(tenant_record.schema_name), 1, 10), tenant_record.schema_name);

        EXECUTE format($sql$
            INSERT INTO %I.sync_state(scope, metadata)
            VALUES
              ('catalog', '{"description":"Catalog bootstrap and delta cursor"}'::jsonb),
              ('sales', '{"description":"Offline sales event queue"}'::jsonb),
              ('cash', '{"description":"Cash sessions and cash movements"}'::jsonb),
              ('returns', '{"description":"Returns and exchanges"}'::jsonb),
              ('layaways', '{"description":"Layaways and deposits"}'::jsonb)
            ON CONFLICT (scope) DO NOTHING
        $sql$, tenant_record.schema_name);
    END LOOP;
END $$;
