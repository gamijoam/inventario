
import requests
import json
import random

BASE_URL = "http://localhost:8000/api/v1"

def run_test():
    print(f"Testing Update against {BASE_URL}")

    # 1. Login
    try:
        auth_resp = requests.post(f"{BASE_URL}/auth/token", data={"username": "admin", "password": "admin123"})
        if auth_resp.status_code != 200:
            print(f"Login failed: {auth_resp.text}")
            return
        token = auth_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("Login successful.")
    except Exception as e:
        print(f"Login request failed: {e}")
        return

    # 2. Identify Target Product (ID 33 or create one)
    PRODUCT_ID = 33
    
    # Check if exists
    try:
        check = requests.get(f"{BASE_URL}/products/{PRODUCT_ID}", headers=headers)
        if check.status_code == 404:
            print(f"Product {PRODUCT_ID} not found. Creating a temporary one...")
            # Create logic here if needed, but let's assume user has 33.
            # Fallback to creating one
            p_payload = {
                "name": "Temp Test Product", "sku": f"TEMP-{random.randint(1000,9999)}", "price": 100, "stock": 10
            }
            create_resp = requests.post(f"{BASE_URL}/products/", json=p_payload, headers=headers)
            if create_resp.status_code == 200:
                PRODUCT_ID = create_resp.json()['id']
                print(f"Created temporary product ID: {PRODUCT_ID}")
            else:
                print(f"Failed to create temp product: {create_resp.text}")
                return
    except Exception as e:
        print(f"Check failed: {e}")
        return

    # 3. Get Price Lists
    lists = requests.get(f"{BASE_URL}/price-lists/", headers=headers).json()
    if not lists:
        print("No price lists to test with.")
        return
    print(f"Found {len(lists)} price lists.")
    target_list_id = lists[-1]['id']

    # 4. Prepare Update Payload with Prices
    update_payload = {
        "prices": [
            {
                "price_list_id": target_list_id,
                "price": 50.00
            }
        ]
    }
    
    print(f"\n[3] Sending PUT /products/{PRODUCT_ID} with payload:")
    print(json.dumps(update_payload, indent=2))

    try:
        resp = requests.put(f"{BASE_URL}/products/{PRODUCT_ID}", json=update_payload, headers=headers)
        print(f"\nResponse Status: {resp.status_code}")
        print(f"Response Body: {resp.text}")
    except Exception as e:
        print(f"\nCRITICAL: Request failed (Connection dropped?): {e}")

if __name__ == "__main__":
    run_test()
