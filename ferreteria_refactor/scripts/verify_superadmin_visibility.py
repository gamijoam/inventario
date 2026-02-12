import sys
import os
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend_api.main import app
from backend_api.database.db import Base, get_db
from backend_api.models import models
from backend_api.models.tenant import Tenant

# Use a test database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_superadmin_visibility.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, expire_on_commit=False)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

# MONKEYPATCH schemas out for SQLite
for table in Base.metadata.tables.values():
    table.schema = None

def setup_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    t1 = Tenant(name="Tenant A", schema_name="tenant_a")
    db.add(t1)
    db.commit()
    db.refresh(t1)
    
    from backend_api.security import get_password_hash
    # Superadmin (No tenant ID)
    superadmin = models.User(
        username="superadmin",
        email="super@admin.com",
        password_hash=get_password_hash("password"),
        role=models.UserRole.ADMIN,
        tenant_id=None,
        is_superuser=True,
        is_active=True
    )
    db.add(superadmin)
    
    # User for Tenant A
    user_a = models.User(
        username="user_a",
        email="user@a.com",
        password_hash=get_password_hash("password"),
        role=models.UserRole.CASHIER,
        tenant_id=t1.id,
        is_active=True
    )
    db.add(user_a)
    
    db.commit()
    db.close()
    return t1

def test_superadmin_visibility():
    t1 = setup_db()
    
    # 1. login as superadmin
    response = client.post(
        "/api/v1/auth/token",
        data={"username": "superadmin", "password": "password"}
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    
    print("\n--- Testing Superadmin visibility in Tenant A context ---")
    # 2. Fetch users with Tenant A context
    response = client.get(
        "/api/v1/users/",
        headers={"Authorization": f"Bearer {token}", "x-tenant-id": "tenant_a"}
    )
    assert response.status_code == 200
    users = response.json()
    
    print(f"Found {len(users)} users in context 'tenant_a'")
    usernames = [u["username"] for u in users]
    print(f"Usernames: {usernames}")
    
    # Check that user_a is present
    assert "user_a" in usernames
    print("✅ Superadmin correctly sees user_a in Tenant A context")
    
    # Check that superadmin is NOT present in the list (since they belong to no tenant, and we filter by tenant_id=t1.id)
    assert "superadmin" not in usernames
    print("✅ Superadmin is correctly filtered out of the tenant list")

    print("\nVerification Complete: ALL TESTS PASSED")

if __name__ == "__main__":
    test_superadmin_visibility()
