
import requests
import json

BASE_URL = "http://localhost:8000/api/v1"

def run_test():
    print(f"Testing Service Order Creation against {BASE_URL}")

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

    # 2. Get a Customer
    try:
        customers = requests.get(f"{BASE_URL}/customers/", headers=headers).json()
        if not customers:
            print("No customers found. Creating one...")
            c_resp = requests.post(f"{BASE_URL}/customers/", json={"name": "Test Customer", "id_number": "123"}, headers=headers)
            customer = c_resp.json()
        else:
            customer = customers[0]
        print(f"Using Customer: {customer['id']}")
    except:
        print("Customer fetch failed.")
        return

    # 3. Create Service Order with EMPTY Serial
    payload = {
        "customer_id": customer['id'],
        "device_type": "SMARTPHONE",
        "brand": "Samsung",
        "model": "Galaxy Test",
        "serial_imei": "",  # EMPTY STRING
        "problem_description": "Test Empty Serial",
        "physical_condition": "Good",
        "passcode_pattern": "1234"
    }

    print("\nSending Payload:")
    print(json.dumps(payload, indent=2))

    try:
        resp = requests.post(f"{BASE_URL}/services/orders", json=payload, headers=headers)
        print(f"\nResponse Status: {resp.status_code}")
        print(f"Response Body: {resp.text}")
        
        if resp.status_code == 200:
            print("\nSUCCESS: Service Order Created with Empty Serial.")
        else:
            print("\nFAILURE: Backend rejected empty serial.")

    except Exception as e:
        print(f"Request Error: {e}")

if __name__ == "__main__":
    run_test()
