from sqlalchemy import create_engine, text
from backend_api.config import settings
import os

# Override DB URL if needed (ensure it points to the right DB)
DATABASE_URL = settings.DATABASE_URL
print(f"Connecting to: {DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else DATABASE_URL}")

engine = create_engine(DATABASE_URL)

with engine.connect() as connection:
    print("\n--- TABLES IN PUBLIC SCHEMA ---")
    result = connection.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"))
    for row in result:
        print(row[0])

    print("\n--- ALEMBIC VERSION ---")
    try:
        result = connection.execute(text("SELECT * FROM alembic_version"))
        for row in result:
            print(f"Version: {row[0]}")
    except Exception as e:
        print(f"Error reading alembic_version: {e}")

    print("\n--- SYSTEM MESSAGES ---")
    try:
        result = connection.execute(text("SELECT count(*) FROM system_messages"))
        for row in result:
            print(f"Count: {row[0]}")
    except Exception as e:
        print(f"Error reading system_messages: {e}")
