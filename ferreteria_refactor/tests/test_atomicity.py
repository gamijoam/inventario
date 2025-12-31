import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from backend_api.models import models
from backend_api.security import create_access_token

@pytest.fixture
def products_atomicity(db_session: Session):
    p1 = models.Product(name="Atomicity Item 1", price=10.0, stock=10, is_active=True)
    p2 = models.Product(name="Atomicity Item 2", price=10.0, stock=10, is_active=True)
    db_session.add(p1)
    db_session.add(p2)
    db_session.commit()
    db_session.refresh(p1)
    db_session.refresh(p2)
    return p1, p2

@pytest.fixture
def admin_token_atomicity(db_session: Session):
    user = models.User(username="admin_atom", password_hash="hash", role=models.UserRole.ADMIN, is_active=True)
    db_session.add(user)
    db_session.commit()
    return create_access_token(data={"sub": user.username, "role": "ADMIN"})

def test_transaction_rollback_on_failure(client: TestClient, products_atomicity, admin_token_atomicity, db_session: Session):
    """
    Test that a multi-item sale rolls back ALL stock changes if ANY item fails.
    Scenario:
    - Item 1: Valid (should deduct stock if successful)
    - Item 2: INVALID (Product ID 999999) triggers 404
    Result:
    - HTTP 404
    - Item 1 Stock should remain UNCHANGED (Rollback check)
    """
    p1, p2 = products_atomicity
    initial_stock_p1 = p1.stock
    
    # Payload: Buy 1 unit of P1, then try to buy non-existent P-99999
    payload = {
        "items": [
            {
                "product_id": p1.id, 
                "quantity": 1, 
                "unit_price_usd": 10.0, 
                "conversion_factor": 1,
                "discount": 0
            },
            {
                "product_id": 999999, # Force Error here
                "quantity": 1, 
                "unit_price_usd": 10.0, 
                "conversion_factor": 1, 
                "discount": 0
            }
        ],
        "total_amount": 20.0,
        "payment_method": "Efectivo",
        "currency": "USD",
        "exchange_rate": 1.0,
        "payments": [{"amount": 20.0, "currency": "USD", "payment_method": "Efectivo", "exchange_rate": 1.0}]
    }
    
    headers = {"Authorization": f"Bearer {admin_token_atomicity}"}
    
    # Execute
    response = client.post("/api/v1/products/sales/", json=payload, headers=headers)
    
    # Assert Failure
    assert response.status_code == 404, f"Expected 404 for missing item, got {response.status_code}"
    
    # Assert Rollback
    # Need to query DB state anew
    db_session.refresh(p1)
    assert p1.stock == initial_stock_p1, f"Stock should check for rollback. Expected {initial_stock_p1}, got {p1.stock}"
