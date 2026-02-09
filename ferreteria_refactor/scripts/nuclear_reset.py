"""
Nuclear Reset: Drop and recreate entire schemas.
"""
import sys
import os
from sqlalchemy import create_engine, text

# Add project root to sys.path
sys.path.insert(0, os.getcwd())

from backend_api.config import settings

def nuclear_reset():
    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as conn:
        with conn.begin():
            print("Dropping schemas...")
            conn.execute(text("DROP SCHEMA IF EXISTS ferreteria CASCADE"))
            conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
            print("Creating schemas...")
            conn.execute(text("CREATE SCHEMA public"))
            # We don't create ferreteria here because the user wants to do it manually?
            # actually, better to leave it clean (dropped).
            # The user step is "CREATE SCHEMA ferreteria". So dropping it is correct.
            # conn.execute(text("CREATE SCHEMA ferreteria")) 
            print("✓ Database is now BLANK.")

if __name__ == "__main__":
    nuclear_reset()
