
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend_api.database.db import SessionLocal
from backend_api.models.tenant import Tenant

def check_tenant():
    db = SessionLocal()
    try:
        tenant = db.query(Tenant).filter(Tenant.schema_name == 'prueba3').first()
        if tenant:
            print(f"✅ Tenant 'prueba3' EXISTS. ID: {tenant.id}, Schema: {tenant.schema_name}")
        else:
            print("❌ Tenant 'prueba3' does NOT exist.")
            
        # List all tenants
        all_tenants = db.query(Tenant).all()
        print(f"Total Tenants: {len(all_tenants)}")
        for t in all_tenants:
            print(f" - {t.name} ({t.schema_name})")
            
    finally:
        db.close()

if __name__ == "__main__":
    check_tenant()
