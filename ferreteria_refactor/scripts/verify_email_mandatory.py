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
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_email_mandatory.db"
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
    admin = models.User(
        username="admin",
        email="admin@a.com",
        password_hash=get_password_hash("password"),
        role=models.UserRole.ADMIN,
        tenant_id=t1.id,
        is_active=True
    )
    db.add(admin)
    db.commit()
    db.close()

def test_email_mandatory():
    setup_db()
    
    # 1. Login
    response = client.post(
        "/api/v1/auth/token",
        data={"username": "admin", "password": "password"},
        headers={"x-tenant-id": "tenant_a"}
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    
    print("--- Testing Creation Without Email (Should FAIL 422) ---")
    # 2. Try create user without email field (Pydantic failure)
    response = client.post(
        "/api/v1/users/",
        json={
            "username": "cashier1",
            "password": "password",
            "full_name": "Cashier 1",
            "role": "CASHIER"
            # email missing
        },
        headers={"Authorization": f"Bearer {token}", "x-tenant-id": "tenant_a"}
    )
    assert response.status_code == 422
    print("✅ Correctly rejected missing email with 422 Unprocessable Entity")

    # 3. Try create user with None email (Pydantic failure because it's now 'str', not 'Optional[str]')
    response = client.post(
        "/api/v1/users/",
        json={
            "username": "cashier1",
            "password": "password",
            "full_name": "Cashier 1",
            "role": "CASHIER",
            "email": None
        },
        headers={"Authorization": f"Bearer {token}", "x-tenant-id": "tenant_a"}
    )
    assert response.status_code == 422
    print("✅ Correctly rejected null email with 422")

    print("\n--- Testing Creation With Valid Email ---")
    response = client.post(
        "/api/v1/users/",
        json={
            "username": "cashier1",
            "password": "password",
            "full_name": "Cashier 1",
            "role": "CASHIER",
            "email": "cashier1@a.com"
        },
        headers={"Authorization": f"Bearer {token}", "x-tenant-id": "tenant_a"}
    )
    assert response.status_code == 200
    print("✅ Successfully created user with email")

    print("\nVerification Complete: ALL TESTS PASSED")

if __name__ == "__main__":
    test_email_mandatory()
