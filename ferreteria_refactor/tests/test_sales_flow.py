from backend_api.models import models

def test_create_sale_success(client, db_session, auth_headers):
    """Test creating a standard cash sale."""
    # 1. Setup Data
    product = models.Product(
        name="Test Hammer", 
        price=10.0, 
        stock=100.0, 
        is_active=True
    )
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)
    
    # 2. Payload
    sale_payload = {
        "items": [
            {
                "product_id": product.id, 
                "quantity": 2, 
                "conversion_factor": 1.0, 
                "unit_price_usd": 10.0,
                "discount": 0,
                "discount_type": "PERCENT"
            }
        ],
        "total_amount": 20.0,
        "currency": "USD",
        "exchange_rate": 1.0,
        "payment_method": "CASH",
        "payments": [
            {
                "amount": 20.0,
                "currency": "USD",
                "payment_method": "CASH",
                "exchange_rate": 1.0
            }
        ],
        "is_credit": False
    }
    
    # 3. Request
    response = client.post("/api/v1/products/sales/", json=sale_payload, headers=auth_headers)
    
    # 4. Assertions
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["status"] == "success"
    assert "sale_id" in data
    
    # Validate DB state
    sale = db_session.query(models.Sale).filter(models.Sale.id == data["sale_id"]).first()
    assert sale is not None
    assert sale.total_amount == 20.0
    
    # Validate Stock Deduction
    db_session.refresh(product)
    assert product.stock == 98.0 # 100 - 2

def test_sale_insufficient_stock(client, db_session, auth_headers):
    """Test that selling more than available stock fails."""
    # 1. Setup Data
    product = models.Product(name="Low Stock Item", price=50.0, stock=1.0, is_active=True)
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)
    
    # 2. Payload (Try to buy 5)
    sale_payload = {
        "items": [
            {
                "product_id": product.id, 
                "quantity": 5, 
                "conversion_factor": 1.0, 
                "unit_price_usd": 50.0,
                "discount": 0,
                "discount_type": "PERCENT"
            }
        ],
        "total_amount": 250.0,
        "currency": "USD", 
        "exchange_rate": 1.0,
        "payment_method": "CASH"
    }
    
    # 3. Request
    response = client.post("/api/v1/products/sales/", json=sale_payload, headers=auth_headers)
    
    # 4. Assertions
    assert response.status_code == 400
    assert "Insufficient stock" in response.text
    
    # Verify stock barely changed (it shouldn't have)
    db_session.refresh(product)
    assert product.stock == 1.0

def test_credit_sale_blocked_customer(client, db_session, auth_headers):
    """Test credit sale to a blocked customer fails."""
    # 1. Setup Data
    customer = models.Customer(name="Bad Payer", is_blocked=True, credit_limit=1000.0)
    product = models.Product(name="Generic Item", price=10.0, stock=50.0, is_active=True)
    db_session.add(customer)
    db_session.add(product)
    db_session.commit()
    
    # 2. Payload
    sale_payload = {
        "items": [
            {"product_id": product.id, "quantity": 1, "conversion_factor": 1, "unit_price_usd": 10.0}
        ],
        "total_amount": 10.0,
        "currency": "USD",
        "exchange_rate": 1.0,
        "payment_method": "CREDIT",
        "is_credit": True,
        "customer_id": customer.id
    }
    
    # 3. Request
    response = client.post("/api/v1/products/sales/", json=sale_payload, headers=auth_headers)
    
    # 4. Assertions
    assert response.status_code == 400
    assert "bloqueado por mora" in response.text or "blocked" in response.text
