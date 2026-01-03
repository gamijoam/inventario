"""
Script para aplicar la migración de unit_id a sale_details
Ejecutar con: python apply_unit_id_migration.py
"""
from backend_api.database.db import engine
from sqlalchemy import text

def apply_migration():
    """Aplica la migración de unit_id a la tabla sale_details."""
    
    with engine.connect() as conn:
        try:
            # 1. Agregar columna unit_id
            print("📝 Agregando columna unit_id...")
            conn.execute(text(
                "ALTER TABLE sale_details "
                "ADD COLUMN IF NOT EXISTS unit_id INTEGER NULL"
            ))
            conn.commit()
            print("✅ Columna unit_id agregada")
            
            # 2. Agregar foreign key constraint
            print("📝 Agregando foreign key constraint...")
            conn.execute(text("""
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
            """))
            conn.commit()
            print("✅ Foreign key constraint agregado")
            
            # 3. Crear índice
            print("📝 Creando índice...")
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_sale_details_unit_id "
                "ON sale_details(unit_id)"
            ))
            conn.commit()
            print("✅ Índice creado")
            
            # 4. Verificar
            print("\n📊 Verificando...")
            result = conn.execute(text("""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'sale_details' 
                  AND column_name = 'unit_id'
            """))
            
            row = result.fetchone()
            if row:
                print(f"✅ ¡Migración exitosa!")
                print(f"   Columna: {row[0]}")
                print(f"   Tipo: {row[1]}")
                print(f"   Nullable: {row[2]}")
            else:
                print("❌ Error: La columna no se creó")
                
        except Exception as e:
            print(f"❌ Error durante la migración: {e}")
            conn.rollback()
            raise

if __name__ == "__main__":
    print("🚀 Iniciando migración de unit_id...\n")
    apply_migration()
    print("\n✅ Migración completada exitosamente!")
