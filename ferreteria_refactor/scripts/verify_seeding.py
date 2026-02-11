
import sys
import os
from sqlalchemy import text, create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend_api.config import settings
from backend_api.utils.tenant_seeding import seed_tenant_data
from backend_api.database.db import engine, SessionLocal

def verify_fix():
    print("🧪 Verifying Seeding Isolation Fix...")
    schema = "test_isolation_fix"
    db = SessionLocal()
    
    try:
        # 1. Setup Test Schema
        print(f"   Creating schema '{schema}'...")
        db.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
        db.execute(text(f'CREATE SCHEMA "{schema}"'))
        db.commit()
        
        # 2. PROVISION TABLES (Simplified for test - just the ones seeder needs)
        # We need Currency, PaymentMethod, Warehouse tables in that schema
        print("   Provisioning tables...")
        with engine.connect() as conn:
            with conn.begin():
                conn.execute(text(f'SET search_path TO "{schema}"'))
                # Import models to ensure they are available for create_all
                from backend_api.models import models
                # We can try to use create_all with the connection
                models.Base.metadata.create_all(conn)
        
        # 3. RUN SEEDER
        print("   Running seed_tenant_data...")
        # seed_tenant_data closes the session or resets search path? 
        # It resets to public at the end.
        seed_tenant_data(db, schema)
        
        # 4. VERIFY DATA LOCATION
        print("   Verifying data location...")
        
        # Check Schema
        currencies_schema = db.execute(text(f'SELECT count(*) FROM "{schema}".business_currencies')).scalar()
        methods_schema = db.execute(text(f'SELECT count(*) FROM "{schema}".payment_methods')).scalar()
        
        # Check Public (Record counts before test? assume stable or check if recent created)
        # Better: check for specific names created
        
        print(f"   Schema '{schema}' Currencies: {currencies_schema} (Expected > 0)")
        print(f"   Schema '{schema}' PaymentMethods: {methods_schema} (Expected > 0)")
        
        if currencies_schema > 0 and methods_schema > 0:
            print("   ✅ PASS: Data found in tenant schema.")
        else:
            print("   ❌ FAIL: Data NOT found in tenant schema.")
            
    except Exception as e:
        print(f"   ❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    verify_fix()
