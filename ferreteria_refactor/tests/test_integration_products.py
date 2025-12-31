from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from backend_api.models import models

def setup_product(db: Session):
    """Helper to create a test product"""
    product = models.Product(
        name="Taladro Percutor",
        price=120.0,
        stock=50,
        is_active=True,
        category_id=None,
        supplier_id=None
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product

def test_create_sale_endpoint_success(client: TestClient, db_session: Session, auth_headers):
    """Test POST /api/v1/products/sales/ with valid data"""
    product = setup_product(db_session)
    
    sale_data = {
        "items": [
            {
                "product_id": product.id,
                "quantity": 2,
                "unit_price_usd": 120.0,
                "conversion_factor": 1.0,
                "discount": 0,
                "discount_type": "NONE"
            }
        ],
        "total_amount": 240.0,
        "payment_method": "Efectivo",
        "currency": "USD",
        "exchange_rate": 40.0,
        "payments": [
             {
                "amount": 240,
                "currency": "USD",
                "payment_method": "Efectivo",
                "exchange_rate": 1.0
             }
        ]
    }
    
    response = client.post(
        "/api/v1/products/sales/",
        json=sale_data,
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "sale_id" in data
    
    # Verify DB state
    db_session.refresh(product)
    assert product.stock == 48

def test_create_sale_endpoint_validation_error(client: TestClient, auth_headers):
    """Test POST /api/v1/products/sales/ with incomplete JSON"""
    # Missing 'items' and 'total_amount'
    incomplete_data = {
        "payment_method": "Efectivo"
    }
    
    response = client.post(
        "/api/v1/products/sales/",
        json=incomplete_data,
        headers=auth_headers
    )
    
    assert response.status_code == 422 # Unprocessable Entity

def test_get_products_list(client: TestClient, db_session: Session, auth_headers):
    """Test GET /api/v1/products/"""
    setup_product(db_session)
    
    response = client.get("/api/v1/products/", headers=auth_headers)
    
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["name"] == "Taladro Percutor"
