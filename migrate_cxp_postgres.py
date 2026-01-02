
import os
import sys
from sqlalchemy import create_engine, text, inspect
from ferreteria_refactor.backend_api.config import settings

def migrate():
    print("Starting Migration for purchase_payments...")
    
    # Force PostgreSQL driver if not specified, though settings should handle it
    db_url = settings.DATABASE_URL
    print(f"Target DB: {db_url}")
    
    engine = create_engine(db_url)
    
    with engine.connect() as conn:
        inspector = inspect(engine)
        columns = [c['name'] for c in inspector.get_columns('purchase_payments')]
        
        print(f"Current columns: {columns}")
        
        # Add 'currency'
        if 'currency' not in columns:
            print("Adding 'currency' column...")
            conn.execute(text("ALTER TABLE purchase_payments ADD COLUMN currency VARCHAR DEFAULT 'USD'"))
            print("Done.")
        else:
            print("'currency' column already exists.")
            
        # Add 'exchange_rate'
        if 'exchange_rate' not in columns:
            print("Adding 'exchange_rate' column...")
            conn.execute(text("ALTER TABLE purchase_payments ADD COLUMN exchange_rate NUMERIC(14, 4) DEFAULT 1.0000"))
            print("Done.")
        else:
            print("'exchange_rate' column already exists.")
            
        conn.commit()
    
    print("Migration finished successfully.")

if __name__ == "__main__":
    migrate()
