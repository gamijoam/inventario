"""
Manual Step 3: Register Tenant
"""
import sys
import os
from sqlalchemy import create_engine, text

# Add project root to sys.path
sys.path.insert(0, os.getcwd())

from backend_api.config import settings

def register_tenant():
    print(f"Connecting to: {settings.DATABASE_URL}")
    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as conn:
        with conn.begin():
            print("Registering tenant...")
            # Check if exists first
            exists = conn.execute(text("SELECT 1 FROM public.tenants WHERE schema_name = 'ferreteria'")).scalar()
            if not exists:
                conn.execute(text("""
                    INSERT INTO public.tenants (name, schema_name, is_active, created_at) 
                    VALUES ('Ferreteria Local', 'ferreteria', true, NOW())
                """))
                print("✓ Tenant registered.")
            else:
                print("! Tenant already exists.")

if __name__ == "__main__":
    register_tenant()
