-- Migration script: Update PROD database to match QA schema
-- This script adds missing tables and columns for the restaurant module

-- ============================================
-- STEP 1: Create ENUM type in public schema
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'selectiontypedb') THEN
        CREATE TYPE selectiontypedb AS ENUM ('SINGLE', 'MULTIPLE');
        RAISE NOTICE 'Created enum type selectiontypedb';
    ELSE
        RAISE NOTICE 'Enum type selectiontypedb already exists';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error creating enum: %', SQLERRM;
END $$;

-- ============================================
-- STEP 2: Create tables in public schema
-- ============================================

CREATE TABLE IF NOT EXISTS public.product_modifier_groups (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL,
    name VARCHAR NOT NULL,
    selection_type selectiontypedb,
    is_required BOOLEAN
);

CREATE TABLE IF NOT EXISTS public.product_modifier_options (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES product_modifier_groups(id) ON DELETE CASCADE,
    name VARCHAR NOT NULL,
    price_adjustment NUMERIC(12, 2),
    recipe_factor NUMERIC(12, 3),
    is_active BOOLEAN DEFAULT TRUE,
    ingredient_id INTEGER,
    quantity_consumed NUMERIC(10, 3) DEFAULT 1.000
);

CREATE TABLE IF NOT EXISTS public.restaurant_order_item_modifiers (
    id SERIAL PRIMARY KEY,
    order_item_id INTEGER NOT NULL,
    option_id INTEGER NOT NULL,
    price_applied NUMERIC(12, 2)
);

-- ============================================
-- STEP 3: Add columns to tenant schemas (quoted identifiers)
-- ============================================
DO $$
DECLARE
    tenant_record RECORD;
    statement TEXT;
BEGIN
    FOR tenant_record IN
        SELECT schema_name FROM information_schema.schemata
        WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'public', 'pg_toast')
        AND schema_name NOT LIKE 'pg_toast%'
    LOOP
        -- Quote schema name to handle hyphens and special chars
        EXECUTE format('ALTER TABLE %I.categories ADD COLUMN IF NOT EXISTS is_no_kitchen_category BOOLEAN DEFAULT FALSE', tenant_record.schema_name);
        RAISE NOTICE 'Altered categories for schema: %', tenant_record.schema_name;

        EXECUTE format('ALTER TABLE %I.restaurant_order_items ADD COLUMN IF NOT EXISTS stock_deducted BOOLEAN DEFAULT FALSE', tenant_record.schema_name);
        RAISE NOTICE 'Altered restaurant_order_items for schema: %', tenant_record.schema_name;
    END LOOP;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error on schema %: %', tenant_record.schema_name, SQLERRM;
END $$;

RAISE NOTICE 'Migration completed successfully!';