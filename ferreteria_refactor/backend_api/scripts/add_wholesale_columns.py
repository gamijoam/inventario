import sys
import os
from sqlalchemy import create_engine, text, inspect

# Add project root to path to import config
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(current_dir))
sys.path.append(project_root)

# Correctly import from backend_api package structure
# Assuming script is run from project root or backend_api/scripts
# We need to act as if we are in ferreteria_refactor

try:
    from backend_api.config import settings
except ImportError:
    # Try alternate import if running from different location
    sys.path.append(os.path.join(project_root, 'ferreteria_refactor'))
    from backend_api.config import settings

def migrate():
    print(f"Checking database at: {settings.DATABASE_URL}")
    engine = create_engine(settings.DATABASE_URL)
    
    inspector = inspect(engine)
    columns = [c['name'] for c in inspector.get_columns('products')]
    
    with engine.connect() as conn:
        if 'price_mayor_1' not in columns:
            print("Adding price_mayor_1 column...")
            try:
                # SQLite syntax
                conn.execute(text("ALTER TABLE products ADD COLUMN price_mayor_1 FLOAT DEFAULT 0.0"))
                print("Added price_mayor_1")
            except Exception as e:
                print(f"Error adding price_mayor_1: {e}")
        else:
            print("price_mayor_1 already exists.")
            
        if 'price_mayor_2' not in columns:
            print("Adding price_mayor_2 column...")
            try:
                conn.execute(text("ALTER TABLE products ADD COLUMN price_mayor_2 FLOAT DEFAULT 0.0"))
                print("Added price_mayor_2")
            except Exception as e:
                print(f"Error adding price_mayor_2: {e}")
        else:
            print("price_mayor_2 already exists.")
            
        conn.commit()

if __name__ == "__main__":
    migrate()
