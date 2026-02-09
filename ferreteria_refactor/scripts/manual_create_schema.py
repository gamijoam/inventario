"""
Manual Step 2: Create Ferreteria Schema
"""
import sys
import os
from sqlalchemy import create_engine, text

# Add project root to sys.path
sys.path.insert(0, os.getcwd())

from backend_api.config import settings

def create_schema():
    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as conn:
        with conn.begin():
            print("Creating schema 'ferreteria'...")
            conn.execute(text("CREATE SCHEMA IF NOT EXISTS ferreteria"))
            print("✓ Schema created.")

if __name__ == "__main__":
    create_schema()
