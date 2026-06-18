-- ============================================================
-- Migration: Colores por IMEI / serial
-- ============================================================
-- Fecha: 2026-06-16
-- Objetivo:
--   Guardar color por unidad serializada sin duplicar productos.
--   Se agregan color_name y color_hex en product_instances.
-- ============================================================

DO $$
DECLARE
    tenant_schema text;
BEGIN
    FOR tenant_schema IN
        SELECT schema_name
        FROM public.tenants
        WHERE is_active = true
    LOOP
        EXECUTE format(
            'ALTER TABLE %I.product_instances ADD COLUMN IF NOT EXISTS color_name VARCHAR(60)',
            tenant_schema
        );

        EXECUTE format(
            'ALTER TABLE %I.product_instances ADD COLUMN IF NOT EXISTS color_hex VARCHAR(16)',
            tenant_schema
        );
    END LOOP;
END $$;
