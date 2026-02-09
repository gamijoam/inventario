"""
Safety Backup: Rename existing DB and create a fresh one.
"""
import sys
import os
import urllib.parse
from sqlalchemy import create_engine, text

# Add project root to sys.path
sys.path.insert(0, os.getcwd())

from backend_api.config import settings

def backup_and_recreate():
    # Parse URL to connect to 'postgres' database instead of the target one
    url = urllib.parse.urlparse(settings.DATABASE_URL)
    db_name = url.path[1:] # Remove leading /
    
    # Construct postgres connection URL
    # Assuming connection string format: postgresql://user:pass@host:port/dbname
    postgres_url = settings.DATABASE_URL.replace(f"/{db_name}", "/postgres")
    
    engine = create_engine(postgres_url, isolation_level="AUTOCOMMIT")
    
    with engine.connect() as conn:
        print(f"Renaming {db_name} to {db_name}_backup...")
        try:
            # Terminate connections to allow rename
            conn.execute(text(f"""
                SELECT pg_terminate_backend(pg_stat_activity.pid)
                FROM pg_stat_activity
                WHERE pg_stat_activity.datname = '{db_name}'
                  AND pid <> pg_backend_pid();
            """))
            conn.execute(text(f"ALTER DATABASE {db_name} RENAME TO {db_name}_backup"))
            print("✓ Database renamed.")
        except Exception as e:
            print(f"! Could not rename (maybe backup already exists or DB doesn't exist?): {e}")

        print(f"Creating fresh {db_name}...")
        try:
            conn.execute(text(f"CREATE DATABASE {db_name}"))
            print(f"✓ Database {db_name} created successfully.")
        except Exception as e:
             print(f"! Could not create database (maybe it already exists?): {e}")

if __name__ == "__main__":
    backup_and_recreate()
