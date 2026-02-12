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
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_superadmin_creation.db"
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
    db.commit()
    db.close()
    return t1

def test_superadmin_creation():
    t1 = setup_db()
    
    # 1. login as superadmin via public context
    response = client.post(
        "/api/v1/auth/token",
        data={"username": "superadmin", "password": "password"}
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    
    print("\n--- Testing Superadmin creating user in Tenant A context ---")
    # 2. Create user with Tenant A context header
    response = client.post(
        "/api/v1/users/",
        json={
            "username": "cashier_a",
            "password": "password",
            "full_name": "Cashier A",
            "role": "CASHIER",
            "email": "cashier@a.com"
        },
        headers={"Authorization": f"Bearer {token}", "x-tenant-id": "tenant_a"}
    )
    if response.status_code != 200:
        print(f"Error: {response.text}")
    assert response.status_code == 200
    
    # 3. Verify the user has tenant_id of Tenant A
    db = TestingSessionLocal()
    new_user = db.query(models.User).filter(models.User.username == "cashier_a").first()
    assert new_user is not None
    assert new_user.tenant_id == t1.id
    print(f"✅ User created successfully association with Tenant ID: {new_user.tenant_id} (Expected: {t1.id})")
    db.close()

    print("\n--- Testing Regular Admin creating user (Existing behavior) ---")
    # Setup regular admin for Tenant A
    db = TestingSessionLocal()
    from backend_api.security import get_password_hash
    admin_a = models.User(
        username="admin_a",
        email="admin@a.com",
        password_hash=get_password_hash("password"),
        role=models.UserRole.ADMIN,
        tenant_id=t1.id,
        is_active=True
    )
    db.add(admin_a)
    db.commit()
    db.close()

    # Login as Admin A
    response = client.post(
        "/api/v1/auth/token",
        data={"username": "admin_a", "password": "password"},
        headers={"x-tenant-id": "tenant_a"}
    )
    token_a = response.json()["access_token"]

    # Create another user
    response = client.post(
        "/api/v1/users/",
        json={
            "username": "cashier_a_2",
            "password": "password",
            "full_name": "Cashier A 2",
            "role": "CASHIER",
            "email": "cashier2@a.com"
        },
        headers={"Authorization": f"Bearer {token_a}", "x-tenant-id": "tenant_a"}
    )
    assert response.status_code == 200
    
    db = TestingSessionLocal()
    new_user_2 = db.query(models.User).filter(models.User.username == "cashier_a_2").first()
    assert new_user_2.tenant_id == t1.id
    print(f"✅ Regular Admin user also correctly associated new user with Tenant ID: {new_user_2.tenant_id}")
    db.close()

    print("\nVerification Complete: ALL TESTS PASSED")

if __name__ == "__main__":
    test_superadmin_creation()
