import sys
import os

# 1. Asegurar ruta correcta
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

from sqlalchemy import create_engine, text
from backend_api.database.db import Base
from backend_api.config import settings

# 2. Configurar conexión a BD
DATABASE_URL = settings.DATABASE_URL
engine = create_engine(DATABASE_URL)

def fix_missing_columns():
    print("🚀 Starting manual migration for 'is_commissionable' column...")
    
    with engine.connect() as connection:
        # Get all schemas
        result = connection.execute(text("SELECT schema_name FROM tenants"))
        schemas = [row[0] for row in result.fetchall()]
        
        # Also include 'public' for completeness (though usually not used for products)
        schemas.append("public")
        
        for schema in schemas:
            print(f"\n🔍 Checking schema: {schema}")
            try:
                # Check if products table exists
                has_table_query = text(f"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = '{schema}' AND table_name = 'products')")
                table_exists = connection.execute(has_table_query).scalar()
                
                if not table_exists:
                    print(f"   ⚠️ Table 'products' not found in schema '{schema}'. Skipping.")
                    continue

                # Check if column exists
                has_col_query = text(f"SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = '{schema}' AND table_name = 'products' AND column_name = 'is_commissionable')")
                column_exists = connection.execute(has_col_query).scalar()
                
                if column_exists:
                     print(f"   ✅ Column 'is_commissionable' already exists.")
                else:
                    print(f"   🛠️ Column MISSING. Adding 'is_commissionable'...")
                    # Quoting schema name for safety
                    alter_query = text(f'ALTER TABLE "{schema}".products ADD COLUMN is_commissionable BOOLEAN DEFAULT FALSE')
                    connection.execute(alter_query)
                    connection.commit()
                    print(f"   ✅ Column added successfully.")
                    
            except Exception as e:
                print(f"   ❌ Error processing schema '{schema}': {e}")
                connection.rollback()
                
    print("\n🎉 Migration completed.")

if __name__ == "__main__":
    fix_missing_columns()
