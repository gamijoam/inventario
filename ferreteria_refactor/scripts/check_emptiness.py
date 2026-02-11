
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend_api.database.db import engine
from sqlalchemy import inspect

def check_tables():
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    print(f"Tables in DB: {tables}")
    if 'users' in tables:
        print("❌ 'users' table STILL EXISTS!")
    else:
        print("✅ DB is clean.")

if __name__ == "__main__":
    check_tables()
