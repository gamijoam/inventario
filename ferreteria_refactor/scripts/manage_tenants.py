import sys
import os
import argparse

# Add project root to sys.path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(project_root)

from backend_api.services.tenant_service import TenantService

def create_tenant(name, schema_name, domain=None):
    print(f"🏗️  CLI: Requesting creation for: {name} ({schema_name})")
    try:
        # Default admin/pass for CLI
        res = TenantService.create_tenant(
            name=name, 
            schema_name=schema_name, 
            admin_email="admin@example.com", 
            admin_password="admin123",
            plan_type="FERRETERIA" # Default CLI
        )
        print(f"✅ Success: {res}")
    except Exception as e:
        print(f"❌ Failed: {e}")

def migrate_tenant(schema_name):
    print(f"🚀 CLI: Migrating Single Tenant: {schema_name}")
    try:
        TenantService.run_alembic(schema_name)
    except Exception as e:
        print(f"❌ Failed: {e}")

def migrate_all():
    print(f"🚀 CLI: Migrating ALL Tenants... (TODO: Re-implement list fetching if needed)")
    # For now simplicity, we can just leave this or re-implement using DB query
    # Since we moved logic, we'd need to fetch tenants here again.
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from backend_api.config import settings
    from backend_api.models.tenant import Tenant

    engine = create_engine(settings.DATABASE_URL)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    try:
        tenants = db.query(Tenant).filter(Tenant.is_active == True).all()
        print(f"📋 Found {len(tenants)} active tenants.")
        for t in tenants:
            try:
                TenantService.run_alembic(t.schema_name)
            except:
                print(f"❌ Failed for {t.schema_name}")
    finally:
        db.close()

def main():
    parser = argparse.ArgumentParser(description="SaaS Tenant Manager")
    subparsers = parser.add_subparsers(dest="command", required=True)
    
    # Command: create
    create_parser = subparsers.add_parser("create", help="Create a new tenant")
    create_parser.add_argument("name", help="Business Name")
    create_parser.add_argument("schema", help="Schema Name (e.g. tenant_foo)")
    create_parser.add_argument("--domain", help="Custom Domain", default=None)
    
    # Command: migrate
    migrate_parser = subparsers.add_parser("migrate", help="Migrate a specific tenant")
    migrate_parser.add_argument("schema", help="Schema Name")
    
    # Command: migrate-all
    subparsers.add_parser("migrate-all", help="Migrate ALL tenants")

    args = parser.parse_args()
    
    if args.command == "create":
        create_tenant(args.name, args.schema, args.domain)
    elif args.command == "migrate":
        migrate_tenant(args.schema)
    elif args.command == "migrate-all":
        migrate_all()

if __name__ == "__main__":
    main()
