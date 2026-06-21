-- Layaway / Apartados module.
-- Safe to run multiple times across public permissions and all tenant schemas.

INSERT INTO public.permissions (code, module, resource, action, label, description, risk_level, sort_order)
VALUES
    ('layaways.view', 'sales', 'layaways', 'view', 'Ver apartados', 'Permite consultar apartados y su historial.', 'basic', 590),
    ('layaways.create', 'sales', 'layaways', 'create', 'Crear apartados', 'Permite reservar productos con abono inicial.', 'sensitive', 591),
    ('layaways.payments.add', 'sales', 'layaway_payments', 'add', 'Registrar abonos de apartado', 'Permite registrar pagos parciales sobre apartados.', 'sensitive', 592),
    ('layaways.complete', 'sales', 'layaways', 'complete', 'Completar apartados', 'Permite convertir un apartado pagado en venta/entrega.', 'critical', 593),
    ('layaways.cancel', 'sales', 'layaways', 'cancel', 'Cancelar apartados', 'Permite cancelar apartados activos.', 'critical', 594),
    ('layaways.extend', 'sales', 'layaways', 'extend', 'Prorrogar apartados', 'Permite extender la fecha limite de un apartado.', 'sensitive', 595),
    ('layaways.release', 'sales', 'layaways', 'release', 'Liberar productos apartados', 'Permite liberar stock o IMEI reservados.', 'critical', 596),
    ('layaways.refund', 'sales', 'layaway_payments', 'refund', 'Devolver abonos de apartado', 'Permite devolver dinero de apartados cancelados.', 'critical', 597),
    ('layaways.settings.manage', 'config', 'layaways', 'manage', 'Configurar apartados', 'Permite cambiar dias, inicial minima y politica de vencimiento.', 'critical', 870),
    ('layaways.reports.view', 'reports', 'layaways', 'view', 'Ver reportes de apartados', 'Permite ver reportes de apartados, abonos y vencimientos.', 'sensitive', 750)
ON CONFLICT (code) DO UPDATE SET
    module = EXCLUDED.module,
    resource = EXCLUDED.resource,
    action = EXCLUDED.action,
    label = EXCLUDED.label,
    description = EXCLUDED.description,
    risk_level = EXCLUDED.risk_level,
    sort_order = EXCLUDED.sort_order,
    is_active = TRUE;

WITH cashier_permissions(permission_code) AS (
    VALUES
        ('layaways.view'),
        ('layaways.create'),
        ('layaways.payments.add')
), warehouse_permissions(permission_code) AS (
    VALUES
        ('layaways.view')
)
INSERT INTO public.role_profile_permissions (role_profile_id, permission_code, allowed)
SELECT rp.id, p.permission_code, TRUE
FROM public.role_profiles rp
JOIN cashier_permissions p ON rp.code = 'CASHIER'
ON CONFLICT (role_profile_id, permission_code) DO UPDATE SET allowed = TRUE;

WITH warehouse_permissions(permission_code) AS (
    VALUES ('layaways.view')
)
INSERT INTO public.role_profile_permissions (role_profile_id, permission_code, allowed)
SELECT rp.id, p.permission_code, TRUE
FROM public.role_profiles rp
JOIN warehouse_permissions p ON rp.code = 'WAREHOUSE'
ON CONFLICT (role_profile_id, permission_code) DO UPDATE SET allowed = TRUE;

INSERT INTO public.role_profile_permissions (role_profile_id, permission_code, allowed)
SELECT rp.id, p.code, TRUE
FROM public.role_profiles rp
JOIN public.permissions p ON p.is_active = TRUE
WHERE rp.code = 'ADMIN'
ON CONFLICT (role_profile_id, permission_code) DO UPDATE SET allowed = TRUE;

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
        IF to_regclass(format('%I.products', tenant_schema)) IS NULL THEN
            CONTINUE;
        END IF;

        IF EXISTS (
            SELECT 1
            FROM pg_type t
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = tenant_schema
              AND t.typname = 'productinstancestatus'
        ) THEN
            EXECUTE format('ALTER TYPE %I.productinstancestatus ADD VALUE IF NOT EXISTS ''RESERVED''', tenant_schema);
        END IF;

        EXECUTE format($sql$
            CREATE TABLE IF NOT EXISTS %I.layaway_settings (
                id INTEGER PRIMARY KEY DEFAULT 1,
                enabled BOOLEAN NOT NULL DEFAULT TRUE,
                default_term_days INTEGER NOT NULL DEFAULT 10,
                max_term_days INTEGER NOT NULL DEFAULT 30,
                minimum_down_payment_type VARCHAR(16) NOT NULL DEFAULT 'percent',
                minimum_down_payment_value NUMERIC(18,4) NOT NULL DEFAULT 30.0000,
                expiration_action VARCHAR(32) NOT NULL DEFAULT 'manual_review',
                expired_payment_policy VARCHAR(32) NOT NULL DEFAULT 'store_credit',
                allow_extensions BOOLEAN NOT NULL DEFAULT TRUE,
                require_customer BOOLEAN NOT NULL DEFAULT TRUE,
                allow_serialized BOOLEAN NOT NULL DEFAULT TRUE,
                allow_non_serialized BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
                CONSTRAINT layaway_settings_singleton CHECK (id = 1),
                CONSTRAINT layaway_minimum_type_check CHECK (minimum_down_payment_type IN ('percent', 'fixed', 'none')),
                CONSTRAINT layaway_expiration_action_check CHECK (expiration_action IN ('manual_review', 'auto_release', 'auto_cancel')),
                CONSTRAINT layaway_expired_payment_policy_check CHECK (expired_payment_policy IN ('refund', 'forfeit', 'store_credit', 'manual_review'))
            )
        $sql$, tenant_schema);

        EXECUTE format($sql$
            INSERT INTO %I.layaway_settings (id)
            VALUES (1)
            ON CONFLICT (id) DO NOTHING
        $sql$, tenant_schema);

        EXECUTE format($sql$
            CREATE TABLE IF NOT EXISTS %I.layaways (
                id SERIAL PRIMARY KEY,
                code VARCHAR(40) UNIQUE NOT NULL,
                customer_id INTEGER REFERENCES %I.customers(id) ON DELETE SET NULL,
                created_by_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
                warehouse_id INTEGER REFERENCES %I.warehouses(id) ON DELETE SET NULL,
                sale_id INTEGER REFERENCES %I.sales(id) ON DELETE SET NULL,
                status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
                total_amount NUMERIC(18,4) NOT NULL DEFAULT 0.0000,
                paid_amount NUMERIC(18,4) NOT NULL DEFAULT 0.0000,
                balance_amount NUMERIC(18,4) NOT NULL DEFAULT 0.0000,
                currency VARCHAR(16) NOT NULL DEFAULT 'USD',
                expires_at TIMESTAMP NOT NULL,
                completed_at TIMESTAMP NULL,
                cancelled_at TIMESTAMP NULL,
                notes TEXT NULL,
                cancellation_reason TEXT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
                CONSTRAINT layaways_status_check CHECK (status IN ('ACTIVE', 'PAID', 'COMPLETED', 'CANCELLED', 'EXPIRED'))
            )
        $sql$, tenant_schema, tenant_schema, tenant_schema, tenant_schema);

        EXECUTE format($sql$
            CREATE TABLE IF NOT EXISTS %I.layaway_items (
                id SERIAL PRIMARY KEY,
                layaway_id INTEGER NOT NULL REFERENCES %I.layaways(id) ON DELETE CASCADE,
                product_id INTEGER NOT NULL REFERENCES %I.products(id) ON DELETE RESTRICT,
                warehouse_id INTEGER REFERENCES %I.warehouses(id) ON DELETE SET NULL,
                product_instance_id INTEGER REFERENCES %I.product_instances(id) ON DELETE SET NULL,
                quantity NUMERIC(12,3) NOT NULL DEFAULT 1.000,
                unit_price NUMERIC(18,4) NOT NULL DEFAULT 0.0000,
                subtotal NUMERIC(18,4) NOT NULL DEFAULT 0.0000,
                status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
                product_name_snapshot TEXT,
                serial_number_snapshot VARCHAR(255),
                color_name VARCHAR(60),
                color_hex VARCHAR(16),
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                CONSTRAINT layaway_items_quantity_check CHECK (quantity > 0),
                CONSTRAINT layaway_items_status_check CHECK (status IN ('ACTIVE', 'RELEASED', 'DELIVERED'))
            )
        $sql$, tenant_schema, tenant_schema, tenant_schema, tenant_schema, tenant_schema);

        EXECUTE format($sql$
            CREATE TABLE IF NOT EXISTS %I.layaway_payments (
                id SERIAL PRIMARY KEY,
                layaway_id INTEGER NOT NULL REFERENCES %I.layaways(id) ON DELETE CASCADE,
                amount NUMERIC(18,4) NOT NULL,
                currency VARCHAR(16) NOT NULL DEFAULT 'USD',
                exchange_rate NUMERIC(14,4) NOT NULL DEFAULT 1.0000,
                payment_method VARCHAR(120) NOT NULL DEFAULT 'Efectivo',
                reference VARCHAR(255),
                session_id INTEGER REFERENCES %I.cash_sessions(id) ON DELETE SET NULL,
                created_by_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
                status VARCHAR(24) NOT NULL DEFAULT 'APPLIED',
                notes TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                CONSTRAINT layaway_payments_amount_check CHECK (amount > 0),
                CONSTRAINT layaway_payments_status_check CHECK (status IN ('APPLIED', 'VOIDED', 'REFUNDED'))
            )
        $sql$, tenant_schema, tenant_schema, tenant_schema);

        EXECUTE format($sql$
            CREATE TABLE IF NOT EXISTS %I.layaway_events (
                id SERIAL PRIMARY KEY,
                layaway_id INTEGER NOT NULL REFERENCES %I.layaways(id) ON DELETE CASCADE,
                event_type VARCHAR(40) NOT NULL,
                user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
                description TEXT,
                payload JSONB,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        $sql$, tenant_schema, tenant_schema);

        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.layaways(status, expires_at)', 'idx_layaways_status_expires', tenant_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.layaways(customer_id)', 'idx_layaways_customer_id', tenant_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.layaway_items(product_id, warehouse_id, status)', 'idx_layaway_items_product_reserved', tenant_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.layaway_payments(layaway_id, created_at)', 'idx_layaway_payments_layaway', tenant_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.layaway_events(layaway_id, created_at DESC)', 'idx_layaway_events_layaway', tenant_schema);

        EXECUTE format($sql$
            CREATE UNIQUE INDEX IF NOT EXISTS uq_layaway_active_instance
            ON %I.layaway_items(product_instance_id)
            WHERE product_instance_id IS NOT NULL AND status = 'ACTIVE'
        $sql$, tenant_schema);
    END LOOP;
END $$;
