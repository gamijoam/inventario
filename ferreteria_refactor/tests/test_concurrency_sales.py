import pytest
import requests
import concurrent.futures
import time

# Configuration
BASE_URL = "http://localhost:8000/api/v1"
USERNAME = "admin"
PASSWORD = "admin123"

def get_auth_token():
    resp = requests.post(f"{BASE_URL}/auth/token", data={"username": USERNAME, "password": PASSWORD})
    assert resp.status_code == 200
    return resp.json()["access_token"]

def setup_product(token):
    """Create or reset a specific test product to Stock=1"""
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Try to find existing test product
    products = requests.get(f"{BASE_URL}/products/", headers=headers).json()
    test_product = next((p for p in products if p["name"] == "Concurrency Test Item"), None)
    
    if test_product:
        product_id = test_product["id"]
        # Reset stock to 1
        requests.put(f"{BASE_URL}/products/{product_id}", json={"stock": 1, "price": 100.0, "is_active": True}, headers=headers)
        return product_id
    else:
        # Create it
        payload = {
            "name": "Concurrency Test Item",
            "price": 100.0,
            "stock": 1,
            "is_active": True,
            "unit_type": "Unidad"
        }
        resp = requests.post(f"{BASE_URL}/products/", json=payload, headers=headers)
        assert resp.status_code == 200
        return resp.json()["id"]

def test_race_condition_live_server():
    """
    Spams the live server with 5 concurrent buy requests for a product with Stock=1.
    """
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}
    product_id = setup_product(token)
    
    print(f"\n[SETUP] Product {product_id} stock set to 1. Starting attack...")

    # The payload
    sale_payload = {
        "items": [
            {"product_id": product_id, "quantity": 1, "unit_price_usd": 100, "conversion_factor": 1, "discount": 0}
        ],
        "total_amount": 100,
        "payment_method": "Efectivo",
        "currency": "USD",
        "exchange_rate": 1.0, 
        "payments": [{"amount": 100, "currency": "USD", "payment_method": "Efectivo", "exchange_rate": 1.0}]
    }

    def make_request():
        return requests.post(f"{BASE_URL}/products/sales/", json=sale_payload, headers=headers)

    responses = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(make_request) for _ in range(5)]
        for future in concurrent.futures.as_completed(futures):
            responses.append(future.result())

    # Analysis
    success_count = sum(1 for r in responses if r.status_code == 200)
    fail_count = sum(1 for r in responses if r.status_code == 400)
    
    print(f"\n[RESULTS] Successes: {success_count}, Failures: {fail_count}")
    
    # Check Final Stock
    final_prod = requests.get(f"{BASE_URL}/products/{product_id}", headers=headers).json()
    final_stock = final_prod["stock"]
    print(f"[VERIFY] Final Stock: {final_stock}")

    # Assertions
    # If Race Condition exists, we might see >1 success, or negative stock
    assert final_stock >= 0, f"CRITICAL: Stock became negative! ({final_stock})"
    assert success_count == 1, f"Expected exactly 1 success, but got {success_count}. Race condition detected!"
    assert fail_count == 4, f"Expected 4 failures, got {fail_count}"
