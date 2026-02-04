-- ========================================
-- MANUAL MIGRATION: Add unit_id to sale_details
-- Date: 2026-01-03
-- Purpose: Track which presentation/unit was sold
-- ========================================

-- Step 1: Add unit_id column (nullable, allows NULL for existing records)
ALTER TABLE sale_details 
ADD COLUMN IF NOT EXISTS unit_id INTEGER NULL;

-- Step 2: Add foreign key constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_sale_details_unit_id'
    ) THEN
        ALTER TABLE sale_details 
        ADD CONSTRAINT fk_sale_details_unit_id 
        FOREIGN KEY (unit_id) REFERENCES product_units(id);
    END IF;
END $$;

-- Step 3: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_sale_details_unit_id 
ON sale_details(unit_id);

-- Step 4: Verify the changes
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'sale_details' 
  AND column_name = 'unit_id';

-- Expected output:
-- column_name | data_type | is_nullable
-- unit_id     | integer   | YES

COMMENT ON COLUMN sale_details.unit_id IS 'Foreign key to product_units - tracks which presentation/unit was sold (e.g., Saco, Kilo, Gramo)';

-- ========================================
-- ROLLBACK SCRIPT (if needed)
-- ========================================
-- DROP INDEX IF EXISTS idx_sale_details_unit_id;
-- ALTER TABLE sale_details DROP CONSTRAINT IF EXISTS fk_sale_details_unit_id;
-- ALTER TABLE sale_details DROP COLUMN IF EXISTS unit_id;
