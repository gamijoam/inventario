"""
Script: create_new_tenant.py
Description:
    - Creates a new Tenant record in public.tenants.
    - Creates the PostgreSQL Physical Schema.
    - Runs Alembic Migrations against that new schema.
"""
import sys
import os
import argparse
import subprocess
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add project root to path
sys.path.insert(0, os.getcwd())

from backend_api.config import settings
from backend_api.models.tenant import Tenant

def run_alembic_for_tenant(schema_name):
    """
    Executes 'alembic upgrade tenant@head' specifically for the new schema.
    """
    print(f"\n[ALEMBIC] Applying migrations to schema: {schema_name}")
    env = os.environ.copy()
    env["ALEMBIC_SCHEMA"] = schema_name
    
    cmd = ["alembic", "upgrade", "tenant@head"]
    
    try:
        subprocess.run(cmd, env=env, check=True)
        print("✓ Migrations applied successfully.")
    except subprocess.CalledProcessError as e:
        print(f"❌ Migration failed: {e}")
        raise

def create_tenant(name, schema, domain):
    engine = create_engine(settings.DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        # 1. Check if exists
        exists = session.query(Tenant).filter(Tenant.schema_name == schema).first()
        if exists:
            print(f"! Tenant with schema '{schema}' already exists.")
            return

        # 2. Create Schema (Physical)
        print(f"Creating Schema '{schema}'...")
        with engine.connect() as conn:
            with conn.begin(): # Transaction
                conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema}"))
        print("✓ Schema created.")

        # 3. Create Tenant Record
        print(f"Registering Tenant '{name}'...")
        new_tenant = Tenant(
            name=name,
            schema_name=schema,
            domain=domain,
            is_active=True,
            is_demo=True
        )
        session.add(new_tenant)
        session.commit()
        print("✓ Tenant registered.")
        
        # 4. Run Migrations
        run_alembic_for_tenant(schema)
        
        print("\n🎉 Tenant Onboarding Complete!")
        print(f"Name: {name}")
        print(f"Schema: {schema}")
        print(f"Domain: {domain}")

    except Exception as e:
        print(f"❌ Error during onboarding: {e}")
        session.rollback()
        # Optional: Drop schema if failed? For safety, maybe manual cleanup is better.
    finally:
        session.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Onboard New Tenant")
    parser.add_argument("name", help="Business Name (e.g. 'Mi Tienda')")
    parser.add_argument("schema", help="Schema Name (e.g. 'tienda_1')")
    parser.add_argument("domain", help="Domain (e.g. 'tienda.localhost')")
    
    args = parser.parse_args()
    create_tenant(args.name, args.schema, args.domain)
