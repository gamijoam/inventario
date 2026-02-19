from sqlalchemy import create_engine, text, inspect
import os
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("❌ DATABASE_URL not found")
    exit(1)

engine = create_engine(DATABASE_URL)

def migrate_tenants():
    inspector = inspect(engine)
    all_schemas = inspector.get_schema_names()
    
    # Filter for tenant schemas (exclude system and public)
    tenant_schemas = [s for s in all_schemas if s not in ['public', 'information_schema']]
    tenant_schemas = [s for s in tenant_schemas if not s.startswith('pg_')]
    
    print(f"🌍 Found Schemas: {tenant_schemas}")

    with engine.connect() as conn:
        for schema in tenant_schemas:
            print(f"\n🚜 Migrating Schema: {schema}...")
            # Sanitize schema name for index names (Postgres identifiers shouldn't have hyphens without check)
            safe_schema = schema.replace("-", "_")
            
            # 1. Add tenant_id to Service Orders
            try:
                # Check if column exists
                cols = inspector.get_columns('service_orders', schema=schema)
                col_names = [c['name'] for c in cols]
                
                if 'tenant_id' not in col_names:
                    print(f"   ➕ Adding tenant_id column to {schema}.service_orders")
                    conn.execute(text(f"ALTER TABLE \"{schema}\".service_orders ADD COLUMN tenant_id VARCHAR"))
                    # Quote index name and use safe schema
                    conn.execute(text(f"CREATE INDEX \"ix_{safe_schema}_srv_tenant\" ON \"{schema}\".service_orders (tenant_id)"))
                    
                    # Backfill? Optional.
                    conn.execute(text(f"UPDATE \"{schema}\".service_orders SET tenant_id = '{schema}'"))
                else:
                    print(f"   ✅ tenant_id already exists in {schema}.service_orders")

                # 1.5 Make serial_imei nullable
                print(f"   🔧 Altering serial_imei to nullable in {schema}.service_orders")
                conn.execute(text(f"ALTER TABLE \"{schema}\".service_orders ALTER COLUMN serial_imei DROP NOT NULL"))
                
                conn.commit() # Commit success

            except Exception as e:
                conn.rollback() # Reset transaction on error
                print(f"   ⚠️ Error modifying service_orders in {schema}: {e}")

            # 2. Create Service Payments
            try:
                # Check if table exists
                tables = inspector.get_table_names(schema=schema)
                if 'service_payments' not in tables:
                    print(f"   ➕ Creating table {schema}.service_payments")
                    conn.execute(text(f"""
                        CREATE TABLE \"{schema}\".service_payments (
                            id SERIAL PRIMARY KEY,
                            tenant_id VARCHAR,
                            service_order_id INTEGER NOT NULL REFERENCES \"{schema}\".service_orders(id),
                            amount NUMERIC(18, 4) NOT NULL,
                            currency VARCHAR DEFAULT 'USD',
                            payment_method VARCHAR DEFAULT 'Efectivo',
                            reference VARCHAR,
                            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
                        )
                    """))
                    conn.execute(text(f"CREATE INDEX \"ix_{safe_schema}_pay_id\" ON \"{schema}\".service_payments (id)"))
                    conn.execute(text(f"CREATE INDEX \"ix_{safe_schema}_pay_tenant\" ON \"{schema}\".service_payments (tenant_id)"))
                    conn.commit()
                else:
                    print(f"   ✅ Table {schema}.service_payments already exists")

            except Exception as e:
                conn.rollback() # Reset transaction
                print(f"   ⚠️ Error creating service_payments in {schema}: {e}")

            # 3. Create Price Lists & Product Prices
            try:
                tables = inspector.get_table_names(schema=schema)
                
                # 3.1 Price Lists
                if 'price_lists' not in tables:
                    print(f"   ➕ Creating table {schema}.price_lists")
                    conn.execute(text(f"""
                        CREATE TABLE \"{schema}\".price_lists (
                            id SERIAL PRIMARY KEY,
                            name VARCHAR NOT NULL,
                            requires_auth BOOLEAN DEFAULT FALSE,
                            is_active BOOLEAN DEFAULT TRUE,
                            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
                            CONSTRAINT \"uq_{safe_schema}_pl_name\" UNIQUE (name)
                        )
                    """))
                    conn.execute(text(f"CREATE INDEX \"ix_{safe_schema}_pl_id\" ON \"{schema}\".price_lists (id)"))
                    conn.commit()
                else:
                    print(f"   ✅ Table {schema}.price_lists already exists")

                # 3.2 Product Prices
                if 'product_prices' not in tables:
                    print(f"   ➕ Creating table {schema}.product_prices")
                    conn.execute(text(f"""
                        CREATE TABLE \"{schema}\".product_prices (
                            id SERIAL PRIMARY KEY,
                            product_id INTEGER NOT NULL REFERENCES \"{schema}\".products(id),
                            price_list_id INTEGER NOT NULL REFERENCES \"{schema}\".price_lists(id),
                            price NUMERIC(18, 4) NOT NULL DEFAULT 0.0000
                        )
                    """))
                    conn.execute(text(f"CREATE INDEX \"ix_{safe_schema}_pp_id\" ON \"{schema}\".product_prices (id)"))
                    conn.execute(text(f"CREATE INDEX \"ix_{safe_schema}_pp_prod\" ON \"{schema}\".product_prices (product_id)"))
                    conn.execute(text(f"CREATE INDEX \"ix_{safe_schema}_pp_list\" ON \"{schema}\".product_prices (price_list_id)"))
                    conn.commit()
                else:
                    print(f"   ✅ Table {schema}.product_prices already exists")

            except Exception as e:
                conn.rollback()
                print(f"   ⚠️ Error creating price_lists/product_prices in {schema}: {e}")
            
    print("\n🎉 All Tenants Migrated!")

if __name__ == "__main__":
    migrate_tenants()
