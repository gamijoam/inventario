"""
Apply is_superuser migration to all tenant schemas.

This script applies the is_superuser column to all existing tenant schemas.
Run this after creating the Alembic migration.
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend_api.database.db import engine
from sqlalchemy import text

def apply_migration_to_all_tenants():
    """Apply is_superuser column to all tenant schemas."""
    
    with engine.connect() as conn:
        # Get all tenant schemas
        result = conn.execute(text("""
            SELECT schema_name 
            FROM tenants 
            WHERE schema_name IS NOT NULL
        """))
        
        schemas = [row[0] for row in result]
        
        print(f"Found {len(schemas)} tenant schemas")
        print("=" * 60)
        
        for schema in schemas:
            try:
                print(f"\n📦 Processing schema: {schema}")
                
                # Check if column already exists
                check_query = text(f"""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_schema = :schema 
                    AND table_name = 'users' 
                    AND column_name = 'is_superuser'
                """)
                
                result = conn.execute(check_query, {"schema": schema})
                exists = result.fetchone() is not None
                
                if exists:
                    print(f"   ✅ Column 'is_superuser' already exists in {schema}.users")
                else:
                    # Add the column
                    alter_query = text(f"""
                        ALTER TABLE {schema}.users 
                        ADD COLUMN is_superuser BOOLEAN DEFAULT FALSE NOT NULL
                    """)
                    
                    conn.execute(alter_query)
                    conn.commit()
                    print(f"   ✅ Added 'is_superuser' column to {schema}.users")
                    
            except Exception as e:
                print(f"   ❌ Error processing {schema}: {e}")
                conn.rollback()
        
        print("\n" + "=" * 60)
        print("✅ Migration complete!")
        print("\nYou can now create superusers with:")
        print("   python scripts/create_superuser.py admin")

if __name__ == "__main__":
    print("🔧 Applying is_superuser migration to all tenant schemas...")
    print("=" * 60)
    apply_migration_to_all_tenants()
