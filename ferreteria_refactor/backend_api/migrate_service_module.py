from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

# Load env
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("❌ DATABASE_URL not found")
    exit(1)

engine = create_engine(DATABASE_URL)

def run_migration():
    with engine.connect() as conn:
        print("🚀 Starting Service Module Migration...")
        
        # 1. Add tenant_id to service_orders
        try:
            print("1️⃣ Adding tenant_id to service_orders...")
            conn.execute(text("ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS tenant_id VARCHAR"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_service_orders_tenant_id ON service_orders (tenant_id)"))
            print("✅ tenant_id added.")
        except Exception as e:
            print(f"⚠️ Error adding tenant_id (might exist): {e}")

        # 2. Create service_payments table
        try:
            print("2️⃣ Creating service_payments table...")
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS service_payments (
                    id SERIAL PRIMARY KEY,
                    tenant_id VARCHAR,
                    service_order_id INTEGER NOT NULL REFERENCES service_orders(id),
                    amount NUMERIC(18, 4) NOT NULL,
                    currency VARCHAR DEFAULT 'USD',
                    payment_method VARCHAR DEFAULT 'Efectivo',
                    reference VARCHAR,
                    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
                )
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_service_payments_id ON service_payments (id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_service_payments_tenant_id ON service_payments (tenant_id)"))
            print("✅ service_payments table created.")
        except Exception as e:
            print(f"⚠️ Error creating service_payments: {e}")
            
        conn.commit()
        print("🎉 Migration Completed Successfully!")

if __name__ == "__main__":
    run_migration()
