import pytest
from decimal import Decimal
from backend_api.models import models
from backend_api.schemas import SaleCreate, SaleDetailCreate, SalePaymentCreate

# ==========================================
# FIXTURES
# ==========================================

@pytest.fixture
def price_security_data(db_session):
    """
    Setup data for Price Security Tests as requested:
    1. Product "iPhone" (Base $100)
    2. PriceList "Mayorista" (Auth=True)
    3. ProductPrice for iPhone in Mayorista ($80)
    4. Supervisor User for Auth
    """
    # 1. Product "iPhone"
    iphone = models.Product(
        name="iPhone 15 Pro",
        sku="IPHONE-15",
        price=Decimal("100.00"),
        stock=Decimal("1000.00"),
        is_active=True,
        has_imei=False
    )
    db_session.add(iphone)
    db_session.flush()

    # 2. PriceList "Mayorista" (Protected)
    allow_list = models.PriceList(
        name="Mayorista",
        requires_auth=True, # SECURITY FEATURE
        is_active=True
    )
    db_session.add(allow_list)
    db_session.flush()

    # 3. Assign Price ($80)
    iphone_wholesale_price = models.ProductPrice(
        product_id=iphone.id,
        price_list_id=allow_list.id,
        price=Decimal("80.00")
    )
    db_session.add(iphone_wholesale_price)
    
    # 4. Supervisor User (for authorization)
    # Note: 'admin' already exists from conftest, we can create specific supervisor
    supervisor = models.User(
        username="supervisor",
        password_hash="hashed_secret",
        role=models.UserRole.ADMIN,
        full_name="Supervisor Test",
        is_active=True
    )
    db_session.add(supervisor)

    # 5. Main Warehouse (Required for Sales)
    main_warehouse = models.Warehouse(
        name="Main Warehouse",
        address="Test Address",
        is_active=True,
        is_main=True
    )
    db_session.add(main_warehouse)
    db_session.flush()
    
    # 6. Product Stock in Main Warehouse
    stock = models.ProductStock(
        product_id=iphone.id,
        warehouse_id=main_warehouse.id,
        quantity=Decimal("1000.00"),
        location="A1"
    )
    db_session.add(stock)

    db_session.commit()
    
    return {
        "product": iphone,
        "price_list": allow_list,
        "supervisor": supervisor
    }

# ==========================================
# TESTS
# ==========================================

def test_1_normal_sale_success(client, auth_headers, price_security_data):
    """
    Test 1: Venta Normal (Éxito)
    - Vender iPhone sin especificar lista (Precio Base).
    - Resultado: Venta aprobada, total $100.
    """
    product = price_security_data["product"]
    
    payload = {
        "total_amount": 100.00,
        "total_amount_bs": 3500.00,
        "payments": [],
        "items": [
            {
                "product_id": product.id,
                "quantity": 1,
                "unit_price": 100.00,
                "subtotal": 100.00
            }
        ]
    }
    
    response = client.post("/api/v1/products/sales/", json=payload, headers=auth_headers)
    assert response.status_code == 200, f"Error: {response.text}"
    
    data = response.json()
    assert data["status"] == "success"
    # Note: We can verify DB state if needed (total_amount stored)

def test_2_fraud_attempt_forbidden(client, auth_headers, price_security_data):
    """
    Test 2: Intento de Fraude (Sin Autorización)
    - Intentar vender iPhone con precio Mayorista ($80) SIN auth_user_id.
    - Resultado: Error 403 Forbidden.
    """
    product = price_security_data["product"]
    price_list = price_security_data["price_list"]
    
    payload = {
        "total_amount": 80.00,
        "total_amount_bs": 2800.00,
        "items": [
            {
                "product_id": product.id,
                "quantity": 1,
                "unit_price": 80.00,
                "subtotal": 80.00,
                "price_list_id": price_list.id
                # MISSING: auth_user_id
            }
        ]
    }
    
    response = client.post("/api/v1/products/sales/", json=payload, headers=auth_headers)
    assert response.status_code == 403
    assert "requires authorization" in response.text
    print("\n[SUCCESS] Fraud Validation Caught: 403 Forbidden")

def test_3_authorized_sale_success(client, auth_headers, price_security_data):
    """
    Test 3: Venta Autorizada (Éxito)
    - Vender iPhone con precio Mayorista Y auth_user_id válido.
    - Resultado: Venta aprobada ($80).
    """
    product = price_security_data["product"]
    price_list = price_security_data["price_list"]
    supervisor = price_security_data["supervisor"]
    
    payload = {
        "total_amount": 80.00,
        "total_amount_bs": 2800.00,
        "items": [
            {
                "product_id": product.id,
                "quantity": 1,
                "unit_price": 80.00,
                "subtotal": 80.00,
                "price_list_id": price_list.id,
                "auth_user_id": supervisor.id # VALID AUTH
            }
        ]
    }
    
    response = client.post("/api/v1/products/sales/", json=payload, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["status"] == "success"

def test_4_price_tampering_mitigated(client, auth_headers, price_security_data, db_session):
    """
    Test 4: Intento de "Price Tampering" (Manipulación)
    - Enviar price_list_id "Mayorista" (Real $80).
    - Frontend malicioso envía unit_price: 1.00.
    - Resultado: Venta aprobada, PERO sistema cobra $80 (Zero Trust).
    """
    product = price_security_data["product"]
    price_list = price_security_data["price_list"]
    supervisor = price_security_data["supervisor"]
    
    payload = {
        "total_amount": 1.00, # Fake Total sent by malicious frontend
        "total_amount_bs": 35.00,
        "items": [
            {
                "product_id": product.id,
                "quantity": 1,
                "unit_price": 1.00, # MANIPULATED PRICE (Real is 80)
                "subtotal": 1.00,
                "price_list_id": price_list.id,
                "auth_user_id": supervisor.id
            }
        ]
    }
    
    response = client.post("/api/v1/products/sales/", json=payload, headers=auth_headers)
    assert response.status_code == 200
    
    data = response.json()
    sale_id = data["sale_id"]
    
    # VERIFY DB TRUTH
    sale = db_session.query(models.Sale).filter(models.Sale.id == sale_id).first()
    sale_detail = sale.details[0]
    
    # The stored unit_price MUST be the official one ($80), not the tampered one ($1)
    assert float(sale_detail.unit_price) == 80.00, "FATAL: System accepted tampered price in Detail!"
    
    print(f"\n[SECURITY] Tampering Blocked. Detail Price recorded: {sale_detail.unit_price} (Expected 80.0)")
