import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine, text, inspect

# Ensure we're running in the backend_api dir
# or just add the parent to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

load_dotenv()

def migrate_barbershop(db_engine):
    inspector = inspect(db_engine)
    all_schemas = inspector.get_schema_names()
    
    tenant_schemas = [s for s in all_schemas if s not in ['public', 'information_schema']]
    tenant_schemas = [s for s in tenant_schemas if not s.startswith('pg_')]
    
    # 1. Update public.tenants
    print("\n🚜 Migrating Schema: public...")
    with db_engine.connect() as conn:
        try:
            cols = inspector.get_columns('tenants', schema='public')
            col_names = [c['name'] for c in cols]
            
            if 'has_barbershop_module' not in col_names:
                print("   ➕ Adding has_barbershop_module to public.tenants")
                conn.execute(text("ALTER TABLE public.tenants ADD COLUMN has_barbershop_module BOOLEAN DEFAULT FALSE"))
                conn.commit()
            else:
                print("   ✅ has_barbershop_module already exists in public.tenants")
        except Exception as e:
            conn.rollback()
            print(f"   ⚠️ Error migrating public schema: {e}")

    # 2. Update all tenants
    for schema in tenant_schemas:
        print(f"\n🚜 Migrating Schema: {schema}...")
        safe_schema = schema.replace("-", "_")
        with db_engine.connect() as conn:
            # 2.1 Update products
            try:
                cols = inspector.get_columns('products', schema=schema)
                col_names = [c['name'] for c in cols]
                
                if 'is_barbershop_service' not in col_names:
                    print(f"   ➕ Adding is_barbershop_service to {schema}.products")
                    conn.execute(text(f"ALTER TABLE \"{schema}\".products ADD COLUMN is_barbershop_service BOOLEAN DEFAULT FALSE"))
                    
                if 'commission_amount' not in col_names:
                    print(f"   ➕ Adding commission_amount to {schema}.products")
                    conn.execute(text(f"ALTER TABLE \"{schema}\".products ADD COLUMN commission_amount NUMERIC(18, 4) DEFAULT NULL"))
                    
                if 'commission_percentage' not in col_names:
                    print(f"   ➕ Adding commission_percentage to {schema}.products")
                    conn.execute(text(f"ALTER TABLE \"{schema}\".products ADD COLUMN commission_percentage NUMERIC(5, 2) DEFAULT NULL"))
                    
                conn.commit()
            except Exception as e:
                conn.rollback()
                print(f"   ⚠️ Error migrating products in {schema}: {e}")
                
            # 2.2 Create employees table
            try:
                tables = inspector.get_table_names(schema=schema)
                if 'employees' not in tables:
                    print(f"   ➕ Creating table {schema}.employees")
                    conn.execute(text(f"""
                        CREATE TABLE \"{schema}\".employees (
                            id SERIAL PRIMARY KEY,
                            tenant_id INTEGER NOT NULL REFERENCES public.tenants(id),
                            name VARCHAR NOT NULL,
                            document_id VARCHAR,
                            phone VARCHAR,
                            status VARCHAR DEFAULT 'ACTIVE',
                            base_commission_percentage NUMERIC(5, 2) DEFAULT 50.00,
                            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
                        )
                    """))
                    conn.execute(text(f"CREATE INDEX \"ix_{safe_schema}_emp_tenant\" ON \"{schema}\".employees (tenant_id)"))
                    conn.execute(text(f"CREATE INDEX \"ix_{safe_schema}_emp_name\" ON \"{schema}\".employees (name)"))
                    conn.commit()
                else:
                    print(f"   ✅ Table {schema}.employees already exists")
            except Exception as e:
                conn.rollback()
                print(f"   ⚠️ Error creating employees in {schema}: {e}")

            # 2.3 Create commissions table
            try:
                if 'commissions' not in tables:
                    print(f"   ➕ Creating table {schema}.commissions")
                    # We might not have sale_items constraint if it gets tricky. 
                    # Assuming \"{schema}\".sale_items exists based on domain rules.
                    conn.execute(text(f"""
                        CREATE TABLE \"{schema}\".commissions (
                            id SERIAL PRIMARY KEY,
                            tenant_id INTEGER NOT NULL REFERENCES public.tenants(id),
                            employee_id INTEGER NOT NULL REFERENCES \"{schema}\".employees(id),
                            sale_item_id INTEGER NOT NULL REFERENCES \"{schema}\".sale_details(id),
                            base_amount NUMERIC(18, 4) NOT NULL,
                            calculated_commission NUMERIC(18, 4) NOT NULL,
                            status VARCHAR DEFAULT 'PENDING',
                            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
                        )
                    """))
                    conn.execute(text(f"CREATE INDEX \"ix_{safe_schema}_comm_emp\" ON \"{schema}\".commissions (employee_id)"))
                    conn.execute(text(f"CREATE INDEX \"ix_{safe_schema}_comm_sale\" ON \"{schema}\".commissions (sale_item_id)"))
                    conn.commit()
                else:
                    print(f"   ✅ Table {schema}.commissions already exists")
            except Exception as e:
                conn.rollback()
                print(f"   ⚠️ Error creating commissions in {schema}: {e}")

    print("\n🎉 Barbershop Module DB Migration Completed!")

if __name__ == "__main__":
    DATABASE_URL = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        print("❌ DATABASE_URL not found. Please set it in .env or environment.")
    else:
        engine = create_engine(DATABASE_URL)
        migrate_barbershop(engine)
