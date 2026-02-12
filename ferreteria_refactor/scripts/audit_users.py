
from sqlalchemy import create_engine, text
import os
import sys

# Hardcoded for immediate audit
SQLALCHEMY_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/ferreteria"

def audit_users():
    try:
        engine = create_engine(SQLALCHEMY_DATABASE_URL)
        with engine.connect() as conn:
            print("--- TENANTS ---")
            tenants = conn.execute(text("SELECT id, name, schema_name FROM public.tenants")).fetchall()
            tenant_map = {t.id: t.name for t in tenants}
            for t in tenants:
                print(f"ID: {t.id} | Name: {t.name} | Schema: {t.schema_name}")
                
            print("\n--- USERS DISTRIBUTION ---")
            users = conn.execute(text("SELECT id, username, email, tenant_id FROM public.users")).fetchall()
            
            orphans = 0
            mismatches = 0
            total = 0
            
            for u in users:
                total += 1
                if u.tenant_id is None:
                    print(f"[ORPHAN] User {u.username} (ID: {u.id}) has tenant_id=NULL")
                    orphans += 1
                elif u.tenant_id not in tenant_map:
                     print(f"[INVALID] User {u.username} (ID: {u.id}) has tenant_id={u.tenant_id} which DOES NOT EXIST")
                     mismatches += 1
                else:
                    # Valid linkage
                    # print(f"[OK] User {u.username} belongs to {tenant_map[u.tenant_id]}")
                    pass
                    
            print(f"\nTotal Users: {total}")
            print(f"Orphans (NULL tenant_id): {orphans}")
            print(f"Invalid Tenant IDs: {mismatches}")

            if orphans > 0:
                print("\nWARNING: Orphan users will be visible to Superadmins with no context.")
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    audit_users()
