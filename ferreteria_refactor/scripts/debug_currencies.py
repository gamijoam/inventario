import sys
import os

# Add parent directory to path to allow imports
sys.path.append(os.getcwd())

from backend_api.database.db import SessionLocal
from backend_api.models import models
from backend_api.routers.config import init_currencies

def debug():
    db = SessionLocal()
    try:
        print("--- DEBUGGING CURRENCIES ---")
        count = db.query(models.Currency).count()
        print(f"Total rows in 'business_currencies': {count}")
        
        currencies = db.query(models.Currency).all()
        for i, c in enumerate(currencies):
            print(f"Row {i+1}: ID={c.id}, Name={c.name}, Symbol={c.symbol}, Rate={c.rate}, Active={c.is_active}, Anchor={c.is_anchor}")
            
        if count == 0:
            print("Table is empty. Attempting to seed now...")
            init_currencies(db)
            print("Seed function executed.")
            
            # Verify again
            new_count = db.query(models.Currency).count()
            print(f"New count: {new_count}")
        else:
            print("Table is NOT empty, so seed was skipped.")
            
    except Exception as e:
        print(f"ERROR: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    debug()
