#!/usr/bin/env python3
"""
Robust Multi-Tenant Migration Deployment Script

This script applies Alembic migrations in the correct order:
1. Shared migrations (public schema) - Applied ONCE
2. Tenant migrations (tenant schemas) - Applied to EACH active tenant

Usage:
    python apply_migrations.py                    # Apply all migrations
    python apply_migrations.py --shared-only      # Only apply shared migrations
    python apply_migrations.py --tenant-only      # Only apply tenant migrations
    python apply_migrations.py --tenant ferreteria # Apply to specific tenant
"""
import subprocess
import sys
import argparse
from sqlalchemy import create_engine, text
from backend_api.config import settings

class MigrationRunner:
    def __init__(self):
        self.failed_tenants = []
        
    def run_alembic_command(self, args: list[str], description: str = "") -> bool:
        """Execute alembic command and return success status"""
        try:
            print(f"  🔧 {description}" if description else "")
            result = subprocess.run(
                ["alembic"] + args,
                check=True,
                capture_output=True,
                text=True,
                encoding='utf-8'
            )
            if result.stdout:
                print(result.stdout)
            return True
        except subprocess.CalledProcessError as e:
            print(f"  ❌ Error: {e.stderr}", file=sys.stderr)
            return False

    def get_all_tenants(self) -> list[str]:
        """Query database for all active tenant schemas"""
        try:
            engine = create_engine(settings.DATABASE_URL)
            with engine.connect() as conn:
                result = conn.execute(text(
                    "SELECT schema_name FROM public.tenants WHERE is_active = true ORDER BY schema_name"
                ))
                return [row[0] for row in result]
        except Exception as e:
            print(f"❌ Error fetching tenants: {e}", file=sys.stderr)
            return []

    def apply_shared_migrations(self) -> bool:
        """Apply shared migrations to public schema"""
        print("\n" + "=" * 60)
        print("📦 STEP 1: Applying SHARED Migrations (Public Schema)")
        print("=" * 60)
        
        success = self.run_alembic_command(
            ["upgrade", "shared@head", "-x", "branch=shared"],
            "Upgrading public schema to latest shared migrations..."
        )
        
        if success:
            print("✅ Shared migrations completed successfully.\n")
        else:
            print("❌ Shared migrations failed. Aborting.\n")
        
        return success

    def apply_tenant_migrations(self, specific_tenant: str = None) -> bool:
        """Apply tenant migrations to all or specific tenant schemas"""
        print("\n" + "=" * 60)
        print("🏢 STEP 2: Applying TENANT Migrations")
        print("=" * 60)
        
        if specific_tenant:
            tenants = [specific_tenant]
            print(f"Targeting specific tenant: {specific_tenant}\n")
        else:
            print("Fetching active tenants from database...")
            tenants = self.get_all_tenants()
            print(f"Found {len(tenants)} active tenant(s): {', '.join(tenants)}\n")
        
        if not tenants:
            print("⚠️  No tenants found. Skipping tenant migrations.\n")
            return True
        
        for tenant_schema in tenants:
            print(f"\n  → Migrating tenant: {tenant_schema}")
            success = self.run_alembic_command(
                ["upgrade", "tenant@head", "-x", "branch=tenant", "-x", f"tenant={tenant_schema}"],
                f"Upgrading {tenant_schema} schema..."
            )
            
            if not success:
                self.failed_tenants.append(tenant_schema)
                print(f"  ⚠️  Migration failed for {tenant_schema}")
            else:
                print(f"  ✅ {tenant_schema} migrated successfully")
        
        return len(self.failed_tenants) == 0

    def print_summary(self):
        """Print final migration summary"""
        print("\n" + "=" * 60)
        if self.failed_tenants:
            print("⚠️  COMPLETED WITH ERRORS")
            print(f"Failed tenants: {', '.join(self.failed_tenants)}")
            print("=" * 60)
            return False
        else:
            print("✅ ALL MIGRATIONS APPLIED SUCCESSFULLY")
            print("=" * 60)
            return True

def main():
    parser = argparse.ArgumentParser(description="Apply Alembic migrations for multi-tenant system")
    parser.add_argument("--shared-only", action="store_true", help="Only apply shared migrations")
    parser.add_argument("--tenant-only", action="store_true", help="Only apply tenant migrations")
    parser.add_argument("--tenant", type=str, help="Apply tenant migrations to specific tenant schema")
    args = parser.parse_args()
    
    runner = MigrationRunner()
    
    print("=" * 60)
    print("🚀 MULTI-TENANT MIGRATION DEPLOYMENT")
    print("=" * 60)
    
    success = True
    
    # Apply shared migrations (unless --tenant-only)
    if not args.tenant_only:
        if not runner.apply_shared_migrations():
            sys.exit(1)
    
    # Apply tenant migrations (unless --shared-only)
    if not args.shared_only:
        if not runner.apply_tenant_migrations(specific_tenant=args.tenant):
            success = False
    
    # Print summary
    if not runner.print_summary():
        sys.exit(1)

if __name__ == "__main__":
    main()
