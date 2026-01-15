import sys
import os

# Add the project root to sys.path so we can import backend_api
# Assumes this script is in c:\Users\Gamijoam\Documents\ferreteria\ferreteria_refactor
# But currently it is in c:\Users\Gamijoam\Documents\ferreteria
# So we need to point to ferreteria_refactor
sys.path.append(os.path.join(os.path.dirname(__file__), 'ferreteria_refactor'))

from backend_api.database.db import engine
from sqlalchemy import text

def add_preferences_column():
    print("Connecting to database...")
    with engine.connect() as conn:
        try:
            # Check if column exists to avoid error
            conn.execute(text("ALTER TABLE users ADD COLUMN preferences JSON DEFAULT '{}'"))
            conn.commit()
            print("Successfully added 'preferences' column to 'users' table.")
        except Exception as e:
            # Check if error is because column exists
            if "duplicate column" in str(e).lower() or "already exists" in str(e).lower():
                print("Column 'preferences' already exists. Skipping.")
            else:
                print(f"Error executing migration: {e}")

if __name__ == "__main__":
    add_preferences_column()
