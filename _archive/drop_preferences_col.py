import sys
import os
from sqlalchemy import text

# Setup path
sys.path.append(os.path.join(os.path.dirname(__file__), 'ferreteria_refactor'))

from backend_api.database.db import engine

def drop_preferences_column():
    print("Dropping 'preferences' column manually to force Alembic detection...")
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS preferences"))
            conn.commit()
            print("Successfully dropped 'preferences' column.")
        except Exception as e:
            print(f"Error dropping column: {e}")

if __name__ == "__main__":
    drop_preferences_column()
