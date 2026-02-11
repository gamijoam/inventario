
import os
import shutil
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from backend_api.database.db import engine

def nuclear_reset():
    # 1. Clear alembic/versions
    versions_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "alembic", "versions")
    print(f"💥 Destroying versions in: {versions_dir}")
    
    if os.path.exists(versions_dir):
        for filename in os.listdir(versions_dir):
            file_path = os.path.join(versions_dir, filename)
            try:
                if os.path.isfile(file_path) or os.path.islink(file_path):
                    os.unlink(file_path)
                elif os.path.isdir(file_path):
                    shutil.rmtree(file_path)
            except Exception as e:
                print(f"Failed to delete {file_path}. Reason: {e}")
                
    # 3. Drop all tables to simulate fresh DB via SCHEMA RESET
    print("💥 Resetting PUBLIC schema...")
    with engine.connect() as conn:
        with conn.begin():
            conn.execute(text("DROP SCHEMA public CASCADE"))
            conn.execute(text("CREATE SCHEMA public"))
            conn.execute(text("GRANT ALL ON SCHEMA public TO public"))
            conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'))
    print("✅ Schema public reset and uuid-ossp enabled.")

    # 4. Truncate alembic_version table (in case it persists or runs after drop)
    print("💥 Truncating alembic_version table in DB...")
    with engine.connect() as conn:
        try:
            conn.execute(text("TRUNCATE TABLE public.alembic_version"))
            conn.commit()
            print("✅ alembic_version truncated.")
        except Exception as e:
            print(f"⚠️ Could not truncate alembic_version (maybe it doesn't exist?): {e}")

if __name__ == "__main__":
    nuclear_reset()
