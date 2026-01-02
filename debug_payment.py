
import requests
import json

BASE_URL = "http://localhost:8000/api/v1"

def test_payment():
    # 1. Get Payment Methods
    try:
        resp = requests.get(f"{BASE_URL}/payment-methods")
        print("Payment Methods:", resp.json())
    except Exception as e:
        print("Error fetching payment methods:", e)

    # 2. Try to pay purchase 1
    payload = {
        "amount": 10.00,
        "payment_method": "Transferencia",
        "reference": "TEST-SCRIPT",
        "notes": "Test",
        "currency": "USD",
        "exchange_rate": 1.0
    }
    
    print("\nSending Payload:", json.dumps(payload, indent=2))
    
    resp = requests.post(f"{BASE_URL}/purchases/1/payment", json=payload)
    print(f"\nResponse {resp.status_code}:", resp.text)

if __name__ == "__main__":
    test_payment()
