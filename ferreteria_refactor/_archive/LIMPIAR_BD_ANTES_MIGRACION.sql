-- ============================================
-- SCRIPT PARA LIMPIAR BASE DE DATOS ANTES DE MIGRACIÓN
-- ============================================
-- 
-- ADVERTENCIA: Este script eliminará TODOS los productos y stocks
-- de la base de datos. Úsalo SOLO si quieres empezar desde cero.
--
-- Uso:
--   1. Conéctate a la base de datos "pruebita2_db"
--   2. Ejecuta este script completo
--   3. Luego ejecuta: python migrate_from_lico.py
--

-- 1. Eliminar todos los stocks primero (por la foreign key)
TRUNCATE TABLE product_stocks CASCADE;

-- 2. Eliminar todos los productos y resetear la secuencia de IDs
TRUNCATE TABLE products RESTART IDENTITY CASCADE;

-- 3. Verificar que todo esté limpio
SELECT COUNT(*) as productos_restantes FROM products;
SELECT COUNT(*) as stocks_restantes FROM product_stocks;

-- Si ambos muestran 0, estás listo para migrar
