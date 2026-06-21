-- Currency policy for price lists and payment methods.
-- Safe to run multiple times. Existing behavior remains flexible by default.

CREATE EXTENSION IF NOT EXISTS unaccent;

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
        IF EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = tenant_record.schema_name
              AND table_name = 'price_lists'
        ) THEN
            EXECUTE format('ALTER TABLE %I.price_lists ADD COLUMN IF NOT EXISTS currency_code VARCHAR(16) DEFAULT ''FLEX''', tenant_record.schema_name);
            EXECUTE format('ALTER TABLE %I.price_lists ADD COLUMN IF NOT EXISTS payment_policy VARCHAR(32) DEFAULT ''flexible''', tenant_record.schema_name);
            EXECUTE format('UPDATE %I.price_lists SET currency_code = ''FLEX'' WHERE currency_code IS NULL OR TRIM(currency_code) = ''''', tenant_record.schema_name);
            EXECUTE format('UPDATE %I.price_lists SET payment_policy = ''flexible'' WHERE payment_policy IS NULL OR TRIM(payment_policy) = ''''', tenant_record.schema_name);
            EXECUTE format('ALTER TABLE %I.price_lists ALTER COLUMN currency_code SET DEFAULT ''FLEX''', tenant_record.schema_name);
            EXECUTE format('ALTER TABLE %I.price_lists ALTER COLUMN payment_policy SET DEFAULT ''flexible''', tenant_record.schema_name);
        END IF;

        IF EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = tenant_record.schema_name
              AND table_name = 'payment_methods'
        ) THEN
            EXECUTE format('ALTER TABLE %I.payment_methods ADD COLUMN IF NOT EXISTS currency_code VARCHAR(16) DEFAULT ''FLEX''', tenant_record.schema_name);
            EXECUTE format('ALTER TABLE %I.payment_methods ADD COLUMN IF NOT EXISTS allows_change BOOLEAN DEFAULT TRUE', tenant_record.schema_name);
            EXECUTE format($sql$
                UPDATE %I.payment_methods
                SET currency_code = CASE
                    WHEN lower(unaccent(coalesce(name, ''))) LIKE '%%zelle%%'
                      OR lower(unaccent(coalesce(name, ''))) LIKE '%%usd%%'
                      OR lower(unaccent(coalesce(name, ''))) LIKE '%%dolar%%'
                      OR lower(unaccent(coalesce(name, ''))) LIKE '%%dollar%%'
                      OR lower(unaccent(coalesce(name, ''))) LIKE '%%binance%%'
                      OR lower(unaccent(coalesce(name, ''))) LIKE '%%paypal%%'
                    THEN 'USD'
                    WHEN lower(unaccent(coalesce(name, ''))) LIKE '%%pago movil%%'
                      OR lower(unaccent(coalesce(name, ''))) LIKE '%%punto%%'
                      OR lower(unaccent(coalesce(name, ''))) LIKE '%%biopago%%'
                      OR lower(unaccent(coalesce(name, ''))) LIKE '%%ves%%'
                      OR lower(unaccent(coalesce(name, ''))) LIKE '%%bs%%'
                      OR lower(unaccent(coalesce(name, ''))) LIKE '%%bolivar%%'
                    THEN 'VES'
                    ELSE 'FLEX'
                END
                WHERE currency_code IS NULL OR TRIM(currency_code) = '' OR UPPER(TRIM(currency_code)) = 'FLEX'
            $sql$, tenant_record.schema_name);
            EXECUTE format('UPDATE %I.payment_methods SET allows_change = TRUE WHERE allows_change IS NULL', tenant_record.schema_name);
            EXECUTE format('ALTER TABLE %I.payment_methods ALTER COLUMN currency_code SET DEFAULT ''FLEX''', tenant_record.schema_name);
            EXECUTE format('ALTER TABLE %I.payment_methods ALTER COLUMN allows_change SET DEFAULT TRUE', tenant_record.schema_name);
        END IF;
    END LOOP;
END $$;
