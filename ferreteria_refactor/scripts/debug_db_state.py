"""
Debug DB State
"""
import sys
import os
from sqlalchemy import create_engine, text, inspect

sys.path.insert(0, os.getcwd())
from backend_api.config import settings

def check_db():
    print(f"Connecting to: {settings.DATABASE_URL}")
    engine = create_engine(settings.DATABASE_URL)
    
    with engine.connect() as conn:
        print("Connected.")
        
        # Check Schemas
        schemas = conn.execute(text("SELECT schema_name FROM information_schema.schemata")).fetchall()
        print(f"Schemas: {[s[0] for s in schemas]}")
        
        # Check Tables in public
        public_tables = inspect(engine).get_table_names(schema='public')
        print(f"Public Tables: {public_tables}")
        
        # Check alembic_version
        try:
            av = conn.execute(text("SELECT * FROM public.alembic_version")).fetchall()
            print(f"Alembic Version (public): {av}")
        except Exception as e:
            print(f"Could not read public.alembic_version: {e}")

if __name__ == "__main__":
    check_db()
