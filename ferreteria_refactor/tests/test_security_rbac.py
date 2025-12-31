import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from backend_api.models import models
from backend_api.security import create_access_token
from backend_api.main import app
from backend_api.database.db import get_db

# Reuse standard fixtures from conftest, no need to redefine them heavily if reusing patterns

@pytest.fixture
def product_to_delete(db_session: Session):
    product = models.Product(name="To Delete", price=10.0, stock=10, is_active=True)
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)
    return product

@pytest.fixture
def admin_token(db_session: Session):
    # Ensure admin exists
    user = models.User(username="admin_sec", password_hash="hash", role=models.UserRole.ADMIN, is_active=True)
    db_session.add(user)
    db_session.commit()
    return create_access_token(data={"sub": user.username, "role": "ADMIN"})

@pytest.fixture
def cashier_token(db_session: Session):
    # Ensure cashier exists
    user = models.User(username="cashier_sec", password_hash="hash", role=models.UserRole.CASHIER, is_active=True)
    db_session.add(user)
    db_session.commit()
    return create_access_token(data={"sub": user.username, "role": "CASHIER"})

def test_delete_product_anonymous(client: TestClient, product_to_delete):
    """Anonymous user should get 401 Unauthorized"""
    response = client.delete(f"/api/v1/products/{product_to_delete.id}")
    assert response.status_code == 401

def test_delete_product_cashier(client: TestClient, cashier_token, product_to_delete):
    """Cashier should get 403 Forbidden"""
    headers = {"Authorization": f"Bearer {cashier_token}"}
    response = client.delete(f"/api/v1/products/{product_to_delete.id}", headers=headers)
    assert response.status_code == 403
    # Verify not deleted
    # We can check via API or DB
    check = client.get(f"/api/v1/products/{product_to_delete.id}")
    assert check.status_code == 200
    assert check.json()["is_active"] is True

def test_delete_product_admin(client: TestClient, admin_token, product_to_delete):
    """Admin should get 200 OK (soft delete)"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = client.delete(f"/api/v1/products/{product_to_delete.id}", headers=headers)
    assert response.status_code == 200
    
    # Verify soft delete
    # Re-fetch from API might return 404 or inactive depending on 'read_product' implementation
    # Our read_product implementation returns it regardless of active state usually, or filters?
    # Let's check DB directly via fixture for robustness
    # Wait, client and db_session fixture share same session?
    # Yes, based on conftest overrides.
    
    check = client.get(f"/api/v1/products/{product_to_delete.id}")
    # Current implementation of read_product returns it.
    # But read_products (list) filters active.
    # Single read usually returns it.
    assert check.status_code == 200
    assert check.json()["is_active"] is False
