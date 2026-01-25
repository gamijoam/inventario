import sys
import os
import argparse
import subprocess
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add project root to sys.path
# .../ferreteria_refactor/scripts -> .../ferreteria_refactor
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(project_root)

from backend_api.config import settings
from backend_api.models.tenant import Tenant
from backend_api.models.models import User, UserRole
from backend_api.security import get_password_hash

# Database Connection (Public)
engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

def seed_tenant_admin(schema_name):
    """Seed initial admin user for the tenant"""
    print(f"🌱 Seeding Admin User for: {schema_name}")
    db = SessionLocal()
    try:
        # Set Schema for Postgres
        if "sqlite" not in str(settings.DATABASE_URL):
            db.execute(text(f"SET search_path TO {schema_name}, public"))
            
        # Check if admin exists
        existing_admin = db.query(User).filter(User.username == "admin").first()
        if existing_admin:
             print(f"⚠️  Admin user already exists in {schema_name}.")
             return

        # Create Admin
        admin_user = User(
            username="admin",
            password_hash=get_password_hash("admin123"), # Column is password_hash
            role=UserRole.ADMIN,
            is_active=True,
            full_name="Admin System"
            # Removed fields not in model: email, first_name, last_name, identification
        )
        db.add(admin_user)
        db.commit()
        print(f"✅ Admin user created: admin / admin123")
        
    except Exception as e:
        print(f"❌ Error seeding admin: {e}")
        db.rollback()
    finally:
        db.close()

def run_alembic(schema_name):
    """Run alembic upgrade head for a specific schema"""
    print(f"🔄 [ALEMBIC] Migrating schema: {schema_name}...")
    cmd = [
        "alembic",
        "-x", f"tenant={schema_name}",
        "upgrade", "head"
    ]
    # Execute from project root where alembic.ini usually is
    result = subprocess.run(cmd, cwd=project_root)
    if result.returncode != 0:
        print(f"❌ Migration FAILED for {schema_name}")
        return False
    print(f"✅ Migration OK for {schema_name}")
    return True

def create_tenant(name, schema_name, domain=None):
    print(f"🏗️  Creating Tenant: {name} ({schema_name})")
    db = SessionLocal()
    try:
        # 1. Check if exists
        existing = db.query(Tenant).filter(Tenant.schema_name == schema_name).first()
        if existing:
            print(f"⚠️  Tenant with schema '{schema_name}' already exists.")
        else:
            # 2. Register in public.tenants
            new_tenant = Tenant(name=name, schema_name=schema_name, domain=domain)
            db.add(new_tenant)
            db.commit()
            print(f"✅ Tenant registered in DB.")
        
        # 3. Create Schema in Postgres
        # (Compatible with Postgres only)
        if "sqlite" in str(settings.DATABASE_URL):
             print(f"⚠️  [SQLite] Skipping CREATE SCHEMA (Not supported). Simulating tenant '{schema_name}'.")
        else:
            with engine.connect() as conn:
                conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema_name}"))
                conn.commit()
                print(f"✅ Schema '{schema_name}' created.")
            
        # 4. Run Migrations
        if "sqlite" in str(settings.DATABASE_URL):
             print(f"⚠️  [SQLite] Skipping Alembic Schema Migration (Not supported on SQLite single-file).")
             # Validate simple user creation on sqlite (single tenant fallback)
             seed_tenant_admin(schema_name)
        else:
            if run_alembic(schema_name):
                # 5. Seed Admin
                seed_tenant_admin(schema_name)
        
    except Exception as e:
        print(f"❌ Error creating tenant: {e}")
        db.rollback()
    finally:
        db.close()

def migrate_tenant(schema_name):
    print(f"🚀 Migrating Single Tenant: {schema_name}")
    run_alembic(schema_name)

def migrate_all():
    print(f"🚀 Migrating ALL Tenants...")
    db = SessionLocal()
    try:
        tenants = db.query(Tenant).filter(Tenant.is_active == True).all()
        print(f"📋 Found {len(tenants)} active tenants.")
        
        for t in tenants:
            run_alembic(t.schema_name)
            
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
