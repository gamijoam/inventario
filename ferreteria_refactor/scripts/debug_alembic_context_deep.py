"""
Debug Alembic Environment Context
"""
import sys
import os
from sqlalchemy import create_engine, text, inspect
from alembic.config import Config
from alembic import command
from alembic.script import ScriptDirectory
from alembic.runtime.migration import MigrationContext

sys.path.insert(0, os.getcwd())
from backend_api.config import settings

def debug_alembic_context():
    url = settings.DATABASE_URL
    engine = create_engine(url)
    
    print(f"Connecting to: {url}")
    
    with engine.connect() as conn:
        # Check PUBLIC alembic_version
        public_ver = conn.execute(text("SELECT * FROM public.alembic_version")).fetchall()
        print(f"PUBLIC alembic_version: {public_ver}")
        
        # Check FERRETERIA alembic_version
        try:
            tenant_ver = conn.execute(text("SELECT * FROM ferreteria.alembic_version")).fetchall()
            print(f"FERRETERIA alembic_version: {tenant_ver}")
        except Exception:
            print("FERRETERIA alembic_version: Table not found or empty")

        # Check Context for 'shared' branch
        print("\n--- Alembic Context Check ---")
        config = Config("alembic.ini")
        script = ScriptDirectory.from_config(config)
        
        # What is the head of 'shared' branch?
        shared_head = script.get_heads()
        print(f"Script Heads: {shared_head}")
        
        context = MigrationContext.configure(conn)
        current_rev = context.get_current_revision()
        print(f"Context Current Revision: {current_rev}")
        
        heads = context.get_current_heads()
        print(f"Context Current Heads: {heads}")

if __name__ == "__main__":
    debug_alembic_context()
