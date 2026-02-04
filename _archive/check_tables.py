import sys
import os

# Add parent directory
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ferreteria_refactor.backend_api.database.db import SessionLocal, engine
from ferreteria_refactor.backend_api.models.restaurant import RestaurantTable
from ferreteria_refactor.backend_api.models.models import User, Product # Fix relationships
from sqlalchemy import text

def check_tables():
    print(f"Connecting to database: {engine.url}")
    db = SessionLocal()
    try:
        # 1. Check via ORM
        tables = db.query(RestaurantTable).all()
        print(f"\n[ORM Check] Found {len(tables)} tables:")
        for t in tables:
            print(f" - {t.id}: {t.name} ({t.zone}) - {t.status}")

        # 2. Check via SQL Raw (to be sure table name is correct)
        print(f"\n[SQL Check] Querying 'restaurant_tables' directly...")
        result = db.execute(text("SELECT count(*) FROM restaurant_tables;"))
        count = result.scalar()
        print(f" - Raw Count: {count}")
        
    except Exception as e:
        print(f"Error checking tables: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_tables()
