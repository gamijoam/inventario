-- ========================================
-- APLICAR MIGRACIÓN: unit_id a sale_details
-- Ejecutar con: psql -U usuario -d base_datos -f apply_unit_id.sql
-- O copiar y pegar en pgAdmin
-- ========================================

-- Agregar columna unit_id
ALTER TABLE sale_details 
ADD COLUMN IF NOT EXISTS unit_id INTEGER NULL;

-- Agregar foreign key constraint (solo si no existe)
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

-- Crear índice (solo si no existe)
CREATE INDEX IF NOT EXISTS idx_sale_details_unit_id 
ON sale_details(unit_id);

-- Verificar que se creó correctamente
SELECT 
    'unit_id column created successfully' AS status,
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'sale_details' 
  AND column_name = 'unit_id';
