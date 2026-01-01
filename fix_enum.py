import sys
import os

# Add parent directory to path to allow importing modules
sys.path.append(os.getcwd())

from sqlalchemy import create_engine, text
from ferreteria_refactor.backend_api.config import settings

def fix_enum():
    print(f"Connecting to database...")
    # SQL Alchemy URL should be compatible
    engine = create_engine(settings.DATABASE_URL)
    
    with engine.connect() as connection:
        try:
            # ALTER TYPE cannot run inside a transaction block in some versions, 
            # so we use autocommit isolation level
            connection.execution_options(isolation_level="AUTOCOMMIT")
            
            print("Attempting to add 'PREPARING' to orderitemstatusdb enum...")
            # Using IF NOT EXISTS to be safe (requires Postgres 12+)
            # If standard Enum was used by SQLAlchemy, the name is likely 'orderitemstatusdb'
            connection.execute(text("ALTER TYPE orderitemstatusdb ADD VALUE IF NOT EXISTS 'PREPARING'"))
            print("✅ Success! Enum updated.")
        except Exception as e:
            print(f"❌ Error: {e}")
            # Fallback for older Postgres or different type name?
            # print("Checking if type exists...")

if __name__ == "__main__":
    fix_enum()
