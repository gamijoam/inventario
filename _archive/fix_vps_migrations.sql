-- ========================================
-- SOLUCIÓN PARA VPS: Marcar migraciones como aplicadas
-- Ejecutar dentro del contenedor Docker
-- ========================================

-- Este script soluciona el problema de columnas duplicadas
-- marcando las migraciones problemáticas como ya aplicadas

-- 1. Crear tabla alembic_version si no existe
CREATE TABLE IF NOT EXISTS alembic_version (
    version_num VARCHAR(32) NOT NULL,
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- 2. Marcar todas las migraciones hasta e4c79bc471b0 como aplicadas
-- (Esto evita que intente crear columnas que ya existen)
INSERT INTO alembic_version (version_num) 
VALUES ('e4c79bc471b0')
ON CONFLICT (version_num) DO NOTHING;

-- 3. Ahora aplicar la migración de unit_id manualmente
ALTER TABLE sale_details 
ADD COLUMN IF NOT EXISTS unit_id INTEGER NULL;

-- 4. Agregar foreign key
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

-- 5. Crear índice
CREATE INDEX IF NOT EXISTS idx_sale_details_unit_id 
ON sale_details(unit_id);

-- 6. Marcar la migración de unit_id como aplicada
INSERT INTO alembic_version (version_num) 
VALUES ('7459b903ac5f')
ON CONFLICT (version_num) DO UPDATE SET version_num = '7459b903ac5f';

-- 7. Verificar
SELECT * FROM alembic_version;
SELECT column_name FROM information_schema.columns WHERE table_name = 'sale_details' AND column_name = 'unit_id';

-- Resultado esperado:
-- alembic_version: 7459b903ac5f
-- unit_id: existe
