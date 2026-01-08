
import requests
import json
import random

BASE_URL = "http://localhost:8000/api/v1"

# 1. AUTH LOGIN
def login(username, password):
    url = f"{BASE_URL}/auth/token"
    payload = {"username": username, "password": password}
    response = requests.post(url, data=payload)
    if response.status_code == 200:
        return response.json()["access_token"]
    raise Exception(f"Login failed: {response.text}")

try:
    token = login("admin", "admin123")
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    print(f"[OK] Logged in as Admin")
except Exception as e:
    print(f"[ERROR] Failed to login: {e}")
    exit(1)

# 2. CREATE A TEST SERIALIZED PRODUCT
try:
    # First, list categories/suppliers to get valid IDs
    # Fetch/Create valid Category
    try:
        res = requests.get(f"{BASE_URL}/categories/", headers=headers)
        cats = res.json()
        if cats:
            cat_id = cats[0]["id"]
            print(f"[INFO] Using existing Category ID: {cat_id}")
        else:
            # Create one
            res = requests.post(f"{BASE_URL}/categories/", headers=headers, json={"name": "Test Cat"})
            cat_id = res.json()["id"]
            print(f"[INFO] Created Test Category ID: {cat_id}")
            
        # Fetch/Create valid Supplier
        res = requests.get(f"{BASE_URL}/suppliers/", headers=headers)
        supps = res.json()
        if supps:
            supp_id = supps[0]["id"]
            print(f"[INFO] Using existing Supplier ID: {supp_id}")
        else:
            res = requests.post(f"{BASE_URL}/suppliers/", headers=headers, json={"name": "Test Supp", "email": "test@supp.com", "phone": "123"})
            supp_id = res.json()["id"]
            print(f"[INFO] Created Test Supplier ID: {supp_id}")

    except Exception as e:
        print(f"[WARN] Failed to fetch seeds, defaulting to 1: {e}")
        cat_id = 1
        supp_id = 1
    
    # Create Product
    product_payload = {
        "name": f"Test Phone {random.randint(1000, 9999)}",
        "sku": f"PHONE-{random.randint(1000, 9999)}",
        "price": 500.00,
        "has_imei": True, # CRITICAL (Updated)
        "category_id": cat_id,
        "supplier_id": supp_id
    }
    
    res = requests.post(f"{BASE_URL}/products/", headers=headers, json=product_payload)
    if res.status_code == 200:
        product_data = res.json()
        product_id = product_data["id"]
        print(f"[OK] Created Serialized Product: {product_data['name']} (ID: {product_id})")
    else:
        print(f"[ERROR] Failed to create product: {res.text}")
        exit(1)
        
except Exception as e:
    print(f"[ERROR] Product creation error: {e}")
    exit(1)

# 3. BULK ENTRY (METRALLETA)
warehouse_id = 1 # Main Warehouse
imeis = [f"IMEI-{random.randint(100000, 999999)}" for _ in range(10)]
print(f"\n[INFO] Attempting Bulk Entry of 10 IMEIs: {imeis[0]}...{imeis[-1]}")

bulk_payload = {
    "product_id": product_id,
    "warehouse_id": warehouse_id,
    "imeis": imeis,
    "cost": 250.00
}

try:
    res = requests.post(f"{BASE_URL}/inventory/bulk-entry", headers=headers, json=bulk_payload)
    if res.status_code == 200:
        data = res.json()
        print(f"[OK] Bulk Entry Success! Added: {data['added_count']}, New Stock: {data['new_stock_level']}")
    else:
        print(f"[ERROR] Bulk Entry Failed: {res.text}")
        exit(1)
except Exception as e:
    print(f"[ERROR] Bulk Entry Request Exception: {e}")
    exit(1)

# 4. SELL SERIALIZED ITEM
print(f"\n[INFO] Attempting to sell 2 of 10 phones...")
to_sell = imeis[:2] # Sell first two

sale_payload = {
    "items": [
        {
            "product_id": product_id,
            "quantity": 2,
            "unit_price": 550.00,
            "subtotal": 1100.00,
            "serial_numbers": to_sell # CRITICAL
        }
    ],
    "total_amount": 1100.00,
    "total_amount_bs": 38500.00, # Mock
    "payment_method": "Efectivo",
    "is_credit": False
}

try:
    # Correct Endpoint is nested under products because create_sale is defined in products.py
    res = requests.post(f"{BASE_URL}/products/sales/", headers=headers, json=sale_payload)
    if res.status_code == 200:
        sale_data = res.json()
        print(f"[OK] Sale Success! Sale ID: {sale_data['sale_id']}")
    else:
        print(f"[ERROR] Sale Failed: {res.text}")

    # Verify Stock Deduction
    # Fetch Product again
    res = requests.get(f"{BASE_URL}/products/{product_id}", headers=headers)
    new_stock = res.json()["stock"]
    print(f"[INFO] Final Stock (Should be 8): {new_stock}")
    
except Exception as e:
    print(f"[ERROR] Sale Request Exception: {e}")

