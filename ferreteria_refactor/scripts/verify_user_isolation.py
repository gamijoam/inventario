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
from backend_api.tenant_context import set_tenant_schema, reset_tenant_schema

# Use a test database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_isolation.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, expire_on_commit=False)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

# MONKEYPATCH: Remove schemas from all tables for SQLite compatibility
for table in Base.metadata.tables.values():
    table.schema = None

client = TestClient(app)

# Re-define setup_db with clean metadata
def setup_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # 1. Create Tenants
    t1 = Tenant(name="Tenant A", schema_name="tenant_a")
    t2 = Tenant(name="Tenant B", schema_name="tenant_b")
    db.add(t1)
    db.add(t2)
    db.commit()
    db.refresh(t1)
    db.refresh(t2)
    
    # 2. Create Admin for Tenant A
    from backend_api.security import get_password_hash
    admin_a = models.User(
        username="admin_a",
        email="admin@a.com",
        password_hash=get_password_hash("password"),
        role=models.UserRole.ADMIN,
        tenant_id=t1.id,
        is_active=True
    )
    
    # 3. Create Cashier for Tenant B
    cashier_b = models.User(
        username="cashier_b",
        email="cashier@b.com",
        password_hash=get_password_hash("password"),
        role=models.UserRole.CASHIER,
        tenant_id=t2.id,
        is_active=True
    )
    
    # 4. Create Global Superadmin
    superadmin = models.User(
        username="superadmin",
        email="super@system.com",
        password_hash=get_password_hash("password"),
        role=models.UserRole.ADMIN,
        tenant_id=None,
        is_superuser=True,
        is_active=True
    )
    
    db.add(admin_a)
    db.add(cashier_b)
    db.add(superadmin)
    db.commit()
    
    # Dump state for debug
    print("\n--- DB State After Setup ---")
    all_users = db.query(models.User).all()
    for u in all_users:
        print(f"User: {u.username}, ID: {u.id}, TenantID: {u.tenant_id}")
    
    db.close()
    return t1.id, t2.id

def test_isolation():
    t1_id, t2_id = setup_db()
    
    # Clear any potential cookies from imports/previous state
    client.cookies.clear()
    
    print("\n--- Testing Login Isolation ---")
    
    # Admin A login via Tenant A context
    print("Trying login for admin_a...")
    response = client.post(
        "/api/v1/auth/token",
        data={"username": "admin_a", "password": "password"},
        headers={"x-tenant-id": "tenant_a"}
    )
    assert response.status_code == 200
    token_a = response.json()["access_token"]
    print("✅ Admin A can login via Tenant A URL")
    
    # Admin A trying to login via Public context
    response = client.post(
        "/api/v1/auth/token",
        data={"username": "admin_a", "password": "password"}
    )
    assert response.status_code == 401
    print("✅ Admin A cannot login via Public context")

    print("\n--- Testing Data Isolation (GET /users) ---")
    
    # Admin A listing users
    response = client.get(
        "/api/v1/users/",
        headers={"Authorization": f"Bearer {token_a}", "x-tenant-id": "tenant_a"}
    )
    # ... debug prints ...
    with open("verify_debug.log", "w") as f:
        f.write(f"Status: {response.status_code}\n")
        f.write(f"Response: {response.text}\n")
    
    users = response.json()
    assert len(users) == 1
    assert users[0]["username"] == "admin_a"
    print("✅ Admin A only sees users from Tenant A")

    print("\n--- Testing Automatic Tenant Assignment (POST /users) ---")
    
    # Admin A creating a new user
    response = client.post(
        "/api/v1/users/",
        json={
            "username": "new_cashier_a",
            "password": "password",
            "email": "cashier@a.com",
            "full_name": "Cashier A",
            "role": "CASHIER"
        },
        headers={"Authorization": f"Bearer {token_a}", "x-tenant-id": "tenant_a"}
    )
    assert response.status_code == 200
    print("✅ Admin A successfully created a new user")
    
    # Verify in DB (using a fresh session)
    db = TestingSessionLocal()
    new_user = db.query(models.User).filter(models.User.username == "new_cashier_a").first()
    assert new_user is not None
    assert new_user.tenant_id == t1_id
    print(f"✅ New user automatically assigned tenant_id: {new_user.tenant_id} (Expected: {t1_id})")
    db.close()

    print("\n--- Testing Superadmin & Public Context ---")
    
    # Superadmin login via Public context
    response = client.post(
        "/api/v1/auth/token",
        data={"username": "superadmin", "password": "password"}
    )
    assert response.status_code == 200
    token_super = response.json()["access_token"]
    print("✅ Superadmin can login via Public context")

    print("\n--- Testing Unauthorized Access (GET /users/{id}) ---")
    
    # Get ID of cashier_b (Tenant B)
    db = TestingSessionLocal()
    id_b = db.query(models.User).filter(models.User.username == "cashier_b").first().id
    db.close()
    
    # Admin A trying to fetch Cashier B
    response = client.get(
        f"/api/v1/users/{id_b}",
        headers={"Authorization": f"Bearer {token_a}", "x-tenant-id": "tenant_a"}
    )
    assert response.status_code == 404
    print("✅ Admin A cannot access details of User from Tenant B (404 Not Found in company)")

    print("\n--- Verification Complete: ALL TESTS PASSED ---")

if __name__ == "__main__":
    test_isolation()
    # try:
    #     test_isolation()
    # finally:
    #     if os.path.exists("./test_isolation.db"):
    #         os.remove("./test_isolation.db")
