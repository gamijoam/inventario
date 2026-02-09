"""
Force Insert Shared Revision
"""
import sys
import os
from sqlalchemy import create_engine, text

sys.path.insert(0, os.getcwd())
from backend_api.config import settings

def force_insert_revision():
    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as conn:
        with conn.begin():
            # Check if exists
            current = conn.execute(text("SELECT version_num FROM public.alembic_version")).fetchall()
            print(f"Current versions: {current}")
            
            # Insert if not present
            shared_rev = 'a7c9af7552ae'
            if not any(r[0] == shared_rev for r in current):
                print(f"Inserting {shared_rev}...")
                conn.execute(text(f"INSERT INTO public.alembic_version (version_num) VALUES ('{shared_rev}')"))
                print("✓ Inserted.")
            else:
                print("✓ Revision already present.")

if __name__ == "__main__":
    force_insert_revision()
