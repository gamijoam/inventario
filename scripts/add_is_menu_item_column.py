import sys
import os

# Add the current directory and the backend path to sys.path
# Based on Cwd: /home/gamijoam/Documentos/inventario
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from ferreteria_refactor.backend_api.database.db import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        # Get all schemas (excluding system schemas)
        result = conn.execute(text("""
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast', 'public')
        """))
        schemas = [row[0] for row in result.fetchall()]
        
        print(f"Encontrados {len(schemas)} esquemas para migrar.")
        
        for schema in schemas:
            print(f"Migrando esquema: {schema}...")
            try:
                # Transacción para cada esquema
                # 1. Añadir is_menu_item
                conn.execute(text(f'ALTER TABLE "{schema}".products ADD COLUMN IF NOT EXISTS is_menu_item BOOLEAN DEFAULT FALSE'))
                
                # 2. Añadir is_barbershop_service (por si acaso no existía)
                conn.execute(text(f'ALTER TABLE "{schema}".products ADD COLUMN IF NOT EXISTS is_barbershop_service BOOLEAN DEFAULT FALSE'))
                
                conn.commit()
                print(f"✅ Esquema {schema} migrado con éxito.")
            except Exception as e:
                print(f"❌ Error migrando esquema {schema}: {e}")
                # En connect() de SQLAlchemy 2.0+, commit/rollback son necesarios si no se usa autocommit
                try:
                    conn.rollback()
                except:
                    pass

if __name__ == "__main__":
    migrate()
