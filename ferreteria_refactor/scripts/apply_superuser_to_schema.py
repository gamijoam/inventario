"""
Quick fix: Apply is_superuser column to a specific tenant schema.

Usage:
    python apply_superuser_to_schema.py <schema_name>

Example:
    python apply_superuser_to_schema.py tenant_ferreteria
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend_api.database.db import engine
from sqlalchemy import text

def apply_to_schema(schema_name):
    """Apply is_superuser column to a specific schema."""
    
    with engine.connect() as conn:
        try:
            # Check if column already exists
            check_query = text(f"""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = :schema 
                AND table_name = 'users' 
                AND column_name = 'is_superuser'
            """)
            
            result = conn.execute(check_query, {"schema": schema_name})
            exists = result.fetchone() is not None
            
            if exists:
                print(f"✅ Column 'is_superuser' already exists in {schema_name}.users")
            else:
                # Add the column
                alter_query = text(f"""
                    ALTER TABLE "{schema_name}".users 
                    ADD COLUMN is_superuser BOOLEAN DEFAULT FALSE NOT NULL
                """)
                
                conn.execute(alter_query)
                conn.commit()
                print(f"✅ Added 'is_superuser' column to {schema_name}.users")
                
        except Exception as e:
            print(f"❌ Error: {e}")
            conn.rollback()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python apply_superuser_to_schema.py <schema_name>")
        print("\nAvailable schemas:")
        
        with engine.connect() as conn:
            result = conn.execute(text("SELECT schema_name FROM tenants"))
            for row in result:
                print(f"  - {row[0]}")
        sys.exit(1)
    
    schema = sys.argv[1]
    apply_to_schema(schema)
