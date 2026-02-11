
import sys
import os

# Add parent dir to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend_api.routers.admin import create_tenant
from backend_api.schemas.tenant import TenantCreate
from backend_api.database.db import SessionLocal
from backend_api.models.models import User, UserRole

# Mock User
superuser = User(id=1, username="admin", role=UserRole.ADMIN, is_superuser=True)

def test_provision():
    print("🚀 Testing Tenant Provisioning (Schema Reflection)...")
    
    db = SessionLocal()
    try:
        # 1. Define Tenant Data
        tenant_data = TenantCreate(
            name="Ferreteria Test Reflection",
            schema_name="schema_test_reflection",
            domain="test-reflection.localhost",
            admin_email="admin@test.com",
            admin_password="password123",
            is_demo=True
        )
        
        # 2. Call the function directly
        # Note: We are bypassing the HTTP routing but ensuring the LOGIC works
        new_tenant = create_tenant(
            tenant_in=tenant_data,
            db=db,
            current_user=superuser
        )
        
        print(f"\n✅ Tenant Created Successfully!")
        print(f"   ID: {new_tenant.id}")
        print(f"   Name: {new_tenant.name}")
        print(f"   Schema: {new_tenant.schema_name}")
        
    except Exception as e:
        print(f"\n❌ Test Failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    test_provision()
