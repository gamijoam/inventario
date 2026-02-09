"""
Force Update Alembic Version to 741cf6706903
"""
import sys
import os
from sqlalchemy import create_engine, text

sys.path.insert(0, os.getcwd())
from backend_api.config import settings

def force_update_revision():
    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as conn:
        with conn.begin():
            print("Updating public.alembic_version...")
            # Clear old revisions
            conn.execute(text("DELETE FROM public.alembic_version"))
            # Insert correct revision
            conn.execute(text("INSERT INTO public.alembic_version (version_num) VALUES ('741cf6706903')"))
            print("✓ Updated to '741cf6706903'.")

if __name__ == "__main__":
    force_update_revision()
