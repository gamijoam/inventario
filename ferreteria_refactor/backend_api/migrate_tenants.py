from sqlalchemy import create_engine, text, inspect
import os
from dotenv import load_dotenv

load_dotenv()

def migrate_tenants(db_engine=None):
    if not db_engine:
        from .config import settings
        from .database.db import engine as default_engine
        db_engine = default_engine
        
    inspector = inspect(db_engine)
    all_schemas = inspector.get_schema_names()
    
    # Filter for tenant schemas (exclude system and public)
    tenant_schemas = [s for s in all_schemas if s not in ['public', 'information_schema']]
    tenant_schemas = [s for s in tenant_schemas if not s.startswith('pg_')]
    
    print(f"🌍 Found Schemas: {tenant_schemas}")

    with db_engine.connect() as conn:
        for schema in tenant_schemas:
            print(f"\n🚜 Migrating Schema: {schema}...")
            # Sanitize schema name for index names (Postgres identifiers shouldn't have hyphens without check)
            safe_schema = schema.replace("-", "_")

            # 0. CREATE SERVICE MODULE TABLES IF MISSING
            # ─────────────────────────────────────────────────────────────────────
            # These tables are NOT created by Alembic (which only targets public schema).
            # This block ensures they exist in every tenant schema.
            # ─────────────────────────────────────────────────────────────────────
            try:
                tables = inspector.get_table_names(schema=schema)

                # 0.1 service_orders
                if 'service_orders' not in tables:
                    print(f"   ➕ Creating table {schema}.service_orders")
                    conn.execute(text(f"""
                        CREATE TABLE IF NOT EXISTS \"{schema}\".service_orders (
                            id                  SERIAL PRIMARY KEY,
                            ticket_number       VARCHAR,
                            tenant_id           VARCHAR,
                            customer_id         INTEGER REFERENCES \"{schema}\".customers(id),
                            technician_id       INTEGER REFERENCES public.users(id),
                            status              VARCHAR DEFAULT 'RECEIVED',
                            service_type        VARCHAR DEFAULT 'REPAIR',
                            priority            VARCHAR DEFAULT 'NORMAL',
                            device_type         VARCHAR,
                            brand               VARCHAR,
                            model               VARCHAR,
                            serial_imei         VARCHAR,
                            passcode_pattern    VARCHAR,
                            problem_description TEXT,
                            physical_condition  TEXT,
                            diagnosis_notes     TEXT,
                            order_metadata      JSONB,
                            created_at          TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
                            updated_at          TIMESTAMP WITHOUT TIME ZONE,
                            estimated_delivery  TIMESTAMP WITHOUT TIME ZONE
                        )
                    """))
                    conn.execute(text(f"CREATE INDEX IF NOT EXISTS \"ix_{safe_schema}_so_id\"     ON \"{schema}\".service_orders (id)"))
                    conn.execute(text(f"CREATE INDEX IF NOT EXISTS \"ix_{safe_schema}_so_ticket\"  ON \"{schema}\".service_orders (ticket_number)"))
                    conn.execute(text(f"CREATE INDEX IF NOT EXISTS \"ix_{safe_schema}_so_tenant\"  ON \"{schema}\".service_orders (tenant_id)"))
                    conn.execute(text(f"CREATE INDEX IF NOT EXISTS \"ix_{safe_schema}_so_imei\"    ON \"{schema}\".service_orders (serial_imei)"))
                    conn.execute(text(f"CREATE INDEX IF NOT EXISTS \"ix_{safe_schema}_so_status\"  ON \"{schema}\".service_orders (status)"))
                    conn.commit()
                    print(f"   ✅ Table {schema}.service_orders created")
                else:
                    print(f"   ✅ Table {schema}.service_orders already exists")

                # 0.2 service_order_details
                tables = inspector.get_table_names(schema=schema)  # re-inspect after potential creation
                if 'service_order_details' not in tables:
                    print(f"   ➕ Creating table {schema}.service_order_details")
                    conn.execute(text(f"""
                        CREATE TABLE IF NOT EXISTS \"{schema}\".service_order_details (
                            id               SERIAL PRIMARY KEY,
                            service_order_id INTEGER NOT NULL REFERENCES \"{schema}\".service_orders(id),
                            product_id       INTEGER REFERENCES \"{schema}\".products(id),
                            description      VARCHAR,
                            is_manual        BOOLEAN DEFAULT FALSE,
                            observations     VARCHAR,
                            quantity         NUMERIC(12, 3) DEFAULT 1.000,
                            unit_price       NUMERIC(18, 4) DEFAULT 0.0000,
                            cost             NUMERIC(18, 4) DEFAULT 0.0000,
                            technician_id    INTEGER REFERENCES public.users(id),
                            created_at       TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
                        )
                    """))
                    conn.execute(text(f"CREATE INDEX IF NOT EXISTS \"ix_{safe_schema}_sod_id\"    ON \"{schema}\".service_order_details (id)"))
                    conn.execute(text(f"CREATE INDEX IF NOT EXISTS \"ix_{safe_schema}_sod_order\" ON \"{schema}\".service_order_details (service_order_id)"))
                    conn.commit()
                    print(f"   ✅ Table {schema}.service_order_details created")
                else:
                    print(f"   ✅ Table {schema}.service_order_details already exists")

            except Exception as e:
                conn.rollback()
                print(f"   ⚠️ Error creating service module tables in {schema}: {e}")

            # 1. Add tenant_id to Service Orders (if table already existed without it)
            try:
                tables = inspector.get_table_names(schema=schema)
                if 'service_orders' in tables:
                    cols = inspector.get_columns('service_orders', schema=schema)
                    col_names = [c['name'] for c in cols]

                    if 'tenant_id' not in col_names:
                        print(f"   ➕ Adding tenant_id column to {schema}.service_orders")
                        conn.execute(text(f"ALTER TABLE \"{schema}\".service_orders ADD COLUMN tenant_id VARCHAR"))
                        conn.execute(text(f"CREATE INDEX IF NOT EXISTS \"ix_{safe_schema}_srv_tenant\" ON \"{schema}\".service_orders (tenant_id)"))
                        conn.execute(text(f"UPDATE \"{schema}\".service_orders SET tenant_id = '{schema}'"))
                    else:
                        print(f"   ✅ tenant_id already exists in {schema}.service_orders")

                    # Make serial_imei nullable (safe to run even if already nullable)
                    try:
                        conn.execute(text(f"ALTER TABLE \"{schema}\".service_orders ALTER COLUMN serial_imei DROP NOT NULL"))
                    except Exception:
                        pass  # Already nullable, ignore

                    if 'warranty_policy_id' not in col_names:
                        print(f"   ➕ Adding warranty_policy_id column to {schema}.service_orders")
                        conn.execute(text(f"ALTER TABLE \"{schema}\".service_orders ADD COLUMN warranty_policy_id INTEGER REFERENCES \"{schema}\".warranty_policies(id)"))
                    else:
                        print(f"   ✅ warranty_policy_id already exists in {schema}.service_orders")

                    conn.commit()

            except Exception as e:
                conn.rollback()
                print(f"   ⚠️ Error modifying service_orders in {schema}: {e}")

            # 2. Create Service Payments
            try:
                # Check if table exists
                tables = inspector.get_table_names(schema=schema)
                if 'service_payments' not in tables:
                    print(f"   ➕ Creating table {schema}.service_payments")
                    conn.execute(text(f"""
                        CREATE TABLE IF NOT EXISTS \"{schema}\".service_payments (
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
                    conn.execute(text(f"CREATE INDEX IF NOT EXISTS \"ix_{safe_schema}_pay_id\" ON \"{schema}\".service_payments (id)"))
                    conn.execute(text(f"CREATE INDEX IF NOT EXISTS \"ix_{safe_schema}_pay_tenant\" ON \"{schema}\".service_payments (tenant_id)"))
                    conn.commit()
                else:
                    print(f"   ✅ Table {schema}.service_payments already exists")

            except Exception as e:
                conn.rollback()
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
            
            # 4. WARRANTY SYSTEM MIGRATION
            try:
                tables = inspector.get_table_names(schema=schema)
                
                # 4.1 Create Warranty Policies
                if 'warranty_policies' not in tables:
                    print(f"   ➕ Creating table {schema}.warranty_policies")
                    conn.execute(text(f"""
                        CREATE TABLE \"{schema}\".warranty_policies (
                            id SERIAL PRIMARY KEY,
                            tenant_id INTEGER NOT NULL REFERENCES public.tenants(id),
                            name VARCHAR NOT NULL,
                            type VARCHAR NOT NULL,
                            duration INTEGER,
                            description TEXT,
                            is_default BOOLEAN DEFAULT FALSE,
                            is_active BOOLEAN DEFAULT TRUE,
                            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
                            updated_at TIMESTAMP WITHOUT TIME ZONE
                        )
                    """))
                    conn.execute(text(f"CREATE INDEX \"ix_{safe_schema}_wp_id\" ON \"{schema}\".warranty_policies (id)"))
                    conn.execute(text(f"CREATE INDEX \"ix_{safe_schema}_wp_tenant\" ON \"{schema}\".warranty_policies (tenant_id)"))
                    conn.commit()
                else:
                    print(f"   ✅ Table {schema}.warranty_policies already exists")
                
                # 4.2 Create Warranty Claims
                if 'warranty_claims' not in tables:
                    print(f"   ➕ Creating table {schema}.warranty_claims")
                    conn.execute(text(f"""
                        CREATE TABLE \"{schema}\".warranty_claims (
                            id SERIAL PRIMARY KEY,
                            tenant_id INTEGER NOT NULL REFERENCES public.tenants(id),
                            sale_item_id INTEGER NOT NULL,
                            customer_id INTEGER NOT NULL,
                            policy_snapshot JSONB,
                            status VARCHAR DEFAULT 'PENDING',
                            reason TEXT NOT NULL,
                            diagnosis TEXT,
                            resolution_type VARCHAR,
                            resolution_notes TEXT,
                            claimed_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
                            resolved_at TIMESTAMP WITHOUT TIME ZONE
                        )
                    """))
                    conn.execute(text(f"CREATE INDEX \"ix_{safe_schema}_wc_id\" ON \"{schema}\".warranty_claims (id)"))
                    conn.execute(text(f"CREATE INDEX \"ix_{safe_schema}_wc_tenant\" ON \"{schema}\".warranty_claims (tenant_id)"))
                    conn.commit()
                else:
                    print(f"   ✅ Table {schema}.warranty_claims already exists")

                # 4.3 Add warranty_policy_id to products
                cols = inspector.get_columns('products', schema=schema)
                col_names = [c['name'] for c in cols]
                if 'warranty_policy_id' not in col_names:
                    print(f"   ➕ Adding warranty_policy_id column to {schema}.products")
                    conn.execute(text(f"ALTER TABLE \"{schema}\".products ADD COLUMN warranty_policy_id INTEGER REFERENCES \"{schema}\".warranty_policies(id)"))
                    conn.commit()
                else:
                    print(f"   ✅ warranty_policy_id already exists in {schema}.products")

            except Exception as e:
                conn.rollback()
                print(f"   ⚠️ Error migrating Warranty System in {schema}: {e}")

            # 5. Create Discount Rules (Feature 2: Quantity-based discounts)
            try:
                tables = inspector.get_table_names(schema=schema)
                if 'discount_rules' not in tables:
                    print(f"   ➕ Creating table {schema}.discount_rules")
                    conn.execute(text(f"""
                        CREATE TABLE "{schema}".discount_rules (
                            id SERIAL PRIMARY KEY,
                            product_id INTEGER NOT NULL REFERENCES "{schema}".products(id) ON DELETE CASCADE,
                            min_quantity NUMERIC(12, 3) NOT NULL,
                            discount_percentage NUMERIC(5, 2) NOT NULL,
                            is_active BOOLEAN DEFAULT TRUE NOT NULL,
                            created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
                        )
                    """))
                    conn.execute(text(f'CREATE INDEX "ix_{safe_schema}_dr_id" ON "{schema}".discount_rules (id)'))
                    conn.execute(text(f'CREATE INDEX "ix_{safe_schema}_dr_product" ON "{schema}".discount_rules (product_id)'))
                    conn.commit()
                else:
                    print(f"   ✅ Table {schema}.discount_rules already exists")

            except Exception as e:
                conn.rollback()
                print(f"   ⚠️ Error creating discount_rules in {schema}: {e}")

            # 6. Add cart discount columns to Sales
            try:
                cols = inspector.get_columns('sales', schema=schema)
                col_names = [c['name'] for c in cols]
                
                if 'total_discount_usd' not in col_names:
                    print(f"   ➕ Adding total_discount_usd column to {schema}.sales")
                    conn.execute(text(f"ALTER TABLE \"{schema}\".sales ADD COLUMN total_discount_usd NUMERIC(18, 4) DEFAULT 0.0000"))
                    conn.commit()
                else:
                    print(f"   ✅ total_discount_usd already exists in {schema}.sales")
                    
                if 'cart_discount_type' not in col_names:
                    print(f"   ➕ Adding cart_discount_type column to {schema}.sales")
                    conn.execute(text(f"ALTER TABLE \"{schema}\".sales ADD COLUMN cart_discount_type VARCHAR"))
                    conn.commit()
                else:
                    print(f"   ✅ cart_discount_type already exists in {schema}.sales")
                    
                if 'discount_auth_user_id' not in col_names:
                    print(f"   ➕ Adding discount_auth_user_id column to {schema}.sales")
                    conn.execute(text(f"ALTER TABLE \"{schema}\".sales ADD COLUMN discount_auth_user_id INTEGER REFERENCES public.users(id)"))
                    conn.commit()
                else:
                    print(f"   ✅ discount_auth_user_id already exists in {schema}.sales")

            except Exception as e:
                conn.rollback()
                print(f"   ⚠️ Error modifying sales in {schema}: {e}")

            # 7. Add Takeout Support to Restaurant Orders
            try:
                tables = inspector.get_table_names(schema=schema)
                if 'restaurant_orders' in tables:
                    cols = inspector.get_columns('restaurant_orders', schema=schema)
                    col_names = [c['name'] for c in cols]
                    
                    # 7.1 Make table_id nullable
                    for col in cols:
                        if col['name'] == 'table_id' and not col['nullable']:
                            print(f"   🔧 Making {schema}.restaurant_orders.table_id nullable")
                            conn.execute(text(f"ALTER TABLE \"{schema}\".restaurant_orders ALTER COLUMN table_id DROP NOT NULL"))
                    
                    # 7.2 Add is_takeout
                    if 'is_takeout' not in col_names:
                        print(f"   ➕ Adding is_takeout column to {schema}.restaurant_orders")
                        conn.execute(text(f"ALTER TABLE \"{schema}\".restaurant_orders ADD COLUMN is_takeout BOOLEAN DEFAULT FALSE"))
                        conn.execute(text(f"UPDATE \"{schema}\".restaurant_orders SET is_takeout = FALSE"))
                        conn.execute(text(f"ALTER TABLE \"{schema}\".restaurant_orders ALTER COLUMN is_takeout SET NOT NULL"))

                    # 7.3 Add customer_name
                    if 'customer_name' not in col_names:
                        print(f"   ➕ Adding customer_name column to {schema}.restaurant_orders")
                        conn.execute(text(f"ALTER TABLE \"{schema}\".restaurant_orders ADD COLUMN customer_name VARCHAR"))

                    # 7.4 Add created_at / updated_at
                    if 'created_at' not in col_names:
                        print(f"   ➕ Adding created_at column to {schema}.restaurant_orders")
                        conn.execute(text(f"ALTER TABLE \"{schema}\".restaurant_orders ADD COLUMN created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()"))
                    
                    if 'updated_at' not in col_names:
                        print(f"   ➕ Adding updated_at column to {schema}.restaurant_orders")
                        conn.execute(text(f"ALTER TABLE \"{schema}\".restaurant_orders ADD COLUMN updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()"))
                    
                    conn.commit()
                else:
                    print(f"   ℹ️ Table {schema}.restaurant_orders not found, skipping takeout migration.")

            except Exception as e:
                conn.rollback()
                print(f"   ⚠️ Error modifying restaurant_orders in {schema}: {e}")

    # Also apply Sales discount columns to public schema
    print(f"\n🚜 Migrating Schema: public...")
    with db_engine.connect() as conn:
        try:
            cols = inspector.get_columns('sales', schema='public')
            col_names = [c['name'] for c in cols]
            
            if 'total_discount_usd' not in col_names:
                print(f"   ➕ Adding total_discount_usd column to public.sales")
                conn.execute(text(f"ALTER TABLE public.sales ADD COLUMN total_discount_usd NUMERIC(18, 4) DEFAULT 0.0000"))
                conn.commit()
            else:
                print(f"   ✅ total_discount_usd already exists in public.sales")
                
            if 'cart_discount_type' not in col_names:
                print(f"   ➕ Adding cart_discount_type column to public.sales")
                conn.execute(text(f"ALTER TABLE public.sales ADD COLUMN cart_discount_type VARCHAR"))
                conn.commit()
            else:
                print(f"   ✅ cart_discount_type already exists in public.sales")
                
            if 'discount_auth_user_id' not in col_names:
                print(f"   ➕ Adding discount_auth_user_id column to public.sales")
                conn.execute(text(f"ALTER TABLE public.sales ADD COLUMN discount_auth_user_id INTEGER REFERENCES public.users(id)"))
                conn.commit()
            else:
                print(f"   ✅ discount_auth_user_id already exists in public.sales")

        except Exception as e:
            conn.rollback()
            print(f"   ⚠️ Error modifying sales in public: {e}")

    print("\n🎉 All Tenants Migrated!")

if __name__ == "__main__":
    DATABASE_URL = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        print("❌ DATABASE_URL not found. Please set it in .env or environment.")
    else:
        engine = create_engine(DATABASE_URL)
        migrate_tenants(engine)
