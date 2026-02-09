"""
Alembic Migration Orchestrator
Applies migrations to public schema and all tenant schemas automatically.
"""
import os
import subprocess
from sqlalchemy import create_engine, text, inspect
from backend_api.config import settings

def run_alembic_command(schema: str, command: str = "upgrade head"):
    """
    Run Alembic command for a specific schema.
    
    Args:
        schema: Target schema name (e.g., 'public', 'ferreteria')
        command: Alembic command to execute (default: 'upgrade head')
    """
    env = os.environ.copy()
    env["ALEMBIC_SCHEMA"] = schema
    
    cmd = f"alembic {command}"
    
    print(f"\n{'='*60}")
    print(f"Running: {cmd}")
    print(f"Schema: {schema}")
    print(f"{'='*60}\n")
    
    result = subprocess.run(
        cmd,
        shell=True,
        env=env,
        capture_output=False,  # Show output in real-time
        text=True
    )
    
    if result.returncode != 0:
        print(f"\n❌ Migration failed for schema: {schema}")
        return False
    
    print(f"\n✅ Migration successful for schema: {schema}")
    return True


def apply_all_migrations():
    """
    Orchestrate migrations across all schemas:
    1. Apply to public (shared tables)
    2. Query tenants table
    3. Apply to each tenant schema
    """
    print("\n" + "="*60)
    print("ALEMBIC MIGRATION ORCHESTRATOR")
    print("="*60)
    
    # Step 1: Migrate public schema (shared tables)
    print("\n[STEP 1] Migrating PUBLIC schema (shared tables)...")
    if not run_alembic_command("public"):
        print("\n❌ Failed to migrate public schema. Aborting.")
        return
    
    # Step 2: Get list of tenant schemas
    print("\n[STEP 2] Fetching tenant schemas from database...")
    engine = create_engine(settings.DATABASE_URL)
    
    with engine.connect() as conn:
        # Check if tenants table exists
        inspector = inspect(engine)
        if "tenants" not in inspector.get_table_names(schema="public"):
            print("⚠️  No tenants table found. Skipping tenant migrations.")
            print("   (This is normal for initial setup)")
            return
        
        # Query active tenants
        result = conn.execute(text(
            "SELECT schema_name FROM public.tenants WHERE is_active = true"
        ))
        tenant_schemas = [row[0] for row in result]
    
    if not tenant_schemas:
        print("⚠️  No active tenants found. Skipping tenant migrations.")
        return
    
    print(f"\nFound {len(tenant_schemas)} active tenant(s): {', '.join(tenant_schemas)}")
    
    # Step 3: Migrate each tenant schema
    print("\n[STEP 3] Migrating tenant schemas...")
    failed_schemas = []
    
    for schema in tenant_schemas:
        if not run_alembic_command(schema):
            failed_schemas.append(schema)
    
    # Summary
    print("\n" + "="*60)
    print("MIGRATION SUMMARY")
    print("="*60)
    print(f"✅ Public schema: Migrated")
    print(f"✅ Tenant schemas: {len(tenant_schemas) - len(failed_schemas)}/{len(tenant_schemas)} successful")
    
    if failed_schemas:
        print(f"\n❌ Failed schemas: {', '.join(failed_schemas)}")
    else:
        print("\n🎉 All migrations completed successfully!")
    print("="*60 + "\n")


if __name__ == "__main__":
    apply_all_migrations()
