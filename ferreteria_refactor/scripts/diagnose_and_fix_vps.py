"""
Diagnostic script to list all schemas and check users table structure.
"""
import sys
import os
from sqlalchemy import text, inspect

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend_api.database.db import engine

def diagnose_schemas():
    print("🔍 DIAGNOSTIC: Listing all schemas and users table columns...")
    
    with engine.connect() as conn:
        # Get ALL schemas
        schemas = conn.execute(text("""
            SELECT nspname 
            FROM pg_namespace 
            WHERE nspname NOT LIKE 'pg_%' 
            AND nspname != 'information_schema'
        """)).fetchall()
        
        schemas = [s[0] for s in schemas]
        print(f"found {len(schemas)} schemas: {schemas}")
        
        for schema in schemas:
            print(f"\n📂 Schema: {schema}")
            
            # Check if users table exists
            has_users = conn.execute(text(f"""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = '{schema}' 
                    AND table_name = 'users'
                )
            """)).scalar()
            
            if not has_users:
                print("   ❌ No 'users' table found")
                continue
                
            # List columns in users table
            columns = conn.execute(text(f"""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_schema = '{schema}' 
                AND table_name = 'users'
            """)).fetchall()
            
            cols_names = [c[0] for c in columns]
            
            if 'is_superuser' in cols_names:
                print("   ✅ 'is_superuser' column EXISTS")
            else:
                print("   ⚠️  'is_superuser' column MISSING")
                
                # Attempt to fix immediately
                print("   🛠️  Attempting to add column...")
                try:
                    conn.execute(text(f"ALTER TABLE \"{schema}\".users ADD COLUMN is_superuser BOOLEAN DEFAULT FALSE NOT NULL"))
                    conn.commit()
                    print("   ✅ FIXED: Column added successfully")
                except Exception as e:
                    print(f"   ❌ FAILED to add column: {e}")
                    conn.rollback()

if __name__ == "__main__":
    diagnose_schemas()
