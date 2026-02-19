from sqlalchemy import create_engine, text, inspect
import os
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("❌ DATABASE_URL not found")
    exit(1)

engine = create_engine(DATABASE_URL)

def migrate_service_orders():
    inspector = inspect(engine)
    all_schemas = inspector.get_schema_names()
    
    # Filter for tenant schemas (exclude system and public)
    tenant_schemas = [s for s in all_schemas if s not in ['public', 'information_schema']]
    tenant_schemas = [s for s in tenant_schemas if not s.startswith('pg_')]
    
    # Also include 'public' just in case, or if it's single tenant dev
    # tenant_schemas.append('public') 
    
    print(f"🌍 Found Schemas: {tenant_schemas}")

    with engine.connect() as conn:
        for schema in tenant_schemas:
            print(f"\n🚜 Migrating Schema: {schema}...")
            
            # 1. Add tenant_id to Service Orders
            try:
                # Check if column exists
                cols = inspector.get_columns('service_orders', schema=schema)
                col_names = [c['name'] for c in cols]
                
                if 'tenant_id' not in col_names:
                    print(f"   ➕ Adding tenant_id column to {schema}.service_orders")
                    conn.execute(text(f"ALTER TABLE \"{schema}\".service_orders ADD COLUMN tenant_id VARCHAR"))
                    conn.execute(text(f"CREATE INDEX ix_{schema}_srv_tenant_v2 ON \"{schema}\".service_orders (tenant_id)"))
                    
                    # Backfill with schema name as tenant_id
                    print(f"   🔄 Backfilling tenant_id with '{schema}'")
                    conn.execute(text(f"UPDATE \"{schema}\".service_orders SET tenant_id = '{schema}' WHERE tenant_id IS NULL"))
                else:
                    print(f"   ✅ tenant_id already exists in {schema}.service_orders")

            except Exception as e:
                print(f"   ⚠️ Error modifying service_orders (tenant_id): {e}")

            # 2. Make IMEI Optional
            try:
                print(f"   🔓 Making serial_imei optional (nullable) in {schema}.service_orders")
                # PostgreSQL syntax to drop NOT NULL constraint
                conn.execute(text(f"ALTER TABLE \"{schema}\".service_orders ALTER COLUMN serial_imei DROP NOT NULL"))
                print(f"   ✅ serial_imei is now nullable")
            except Exception as e:
                print(f"   ⚠️ Error modifying service_orders (serial_imei): {e}")
            
            conn.commit()
            
    print("\n🎉 All Tenants Migrated!")

if __name__ == "__main__":
    migrate_service_orders()
