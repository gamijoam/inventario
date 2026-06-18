-- ============================================================
-- Migration: Galeria de imagenes por producto
-- ============================================================
-- Fecha: 2026-06-16
-- Objetivo:
--   Permitir multiples imagenes por producto, opcionalmente
--   asociadas a un color/presentacion visual.
--   Mantiene compatibilidad con products.image_url.
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
            'CREATE TABLE IF NOT EXISTS %I.product_images (
                id SERIAL PRIMARY KEY,
                product_id INTEGER NOT NULL REFERENCES %I.products(id) ON DELETE CASCADE,
                image_url VARCHAR(500) NOT NULL,
                color_name VARCHAR(60),
                color_hex VARCHAR(16),
                sort_order INTEGER NOT NULL DEFAULT 0,
                is_primary BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
            )',
            tenant_schema,
            tenant_schema
        );

        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS %I ON %I.product_images(product_id, sort_order)',
            tenant_schema || '_product_images_product_id_sort_order_idx',
            tenant_schema
        );

        EXECUTE format(
            'INSERT INTO %I.product_images (product_id, image_url, color_name, color_hex, sort_order, is_primary)
             SELECT p.id, p.image_url, NULL, NULL, 0, TRUE
             FROM %I.products p
             WHERE COALESCE(p.image_url, '''') <> ''''
               AND NOT EXISTS (
                   SELECT 1
                   FROM %I.product_images pi
                   WHERE pi.product_id = p.id
               )',
            tenant_schema,
            tenant_schema,
            tenant_schema
        );
    END LOOP;
END $$;
