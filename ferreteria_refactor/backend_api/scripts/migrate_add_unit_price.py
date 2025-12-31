"""
Migration script to add unit_price column to return_details table
Run this script to apply the migration
"""
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from backend_api.database.db import engine

def apply_migration():
    print("Applying migration: Add unit_price to return_details...")
    
    try:
        with engine.connect() as conn:
            # Check if column already exists
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='return_details' AND column_name='unit_price'
            """))
            
            if result.fetchone():
                print("✅ Column 'unit_price' already exists. No migration needed.")
                return
            
            # Add the column
            conn.execute(text("""
                ALTER TABLE return_details 
                ADD COLUMN unit_price FLOAT DEFAULT 0.0
            """))
            
            conn.commit()
            print("✅ Migration applied successfully!")
            print("   - Added column 'unit_price' to 'return_details' table")
            
    except Exception as e:
        print(f"❌ Error applying migration: {e}")
        raise

if __name__ == "__main__":
    apply_migration()
