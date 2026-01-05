
from backend_api.schemas import ServiceOrderDetailCreate
from pydantic import ValidationError
import json

# Mocking Frontend Logic
def frontend_logic(product_id, description, quantity, price, technician_id_raw):
    # Logic in handleAddItem
    payload = {
        "product_id": product_id,
        "description": description,
        "quantity": quantity,
        "unit_price": price,
        "technician_id": int(technician_id_raw) if technician_id_raw else None
    }
    return payload

def test_payload(name, payload):
    print(f"\n--- Testing {name} ---")
    print(f"Payload: {json.dumps(payload)}")
    try:
        obj = ServiceOrderDetailCreate(**payload)
        print("✅ VALID")
    except ValidationError as e:
        print(f"❌ INVALID: {e}")
    except Exception as e:
        print(f"❌ EXCEPTION: {e}")

# Scenario 1: Stock Item (Standard)
# product_id=10, description="", price=10.5, technician_id=""
p1 = frontend_logic(10, "", 1.0, 10.5, "")
test_payload("Stock Item Standard", p1)

# Scenario 2: Manual Item (Standard)
# product_id=None, description="Fix", price=20, technician_id="5"
p2 = frontend_logic(None, "Fix", 1.0, 20.0, "5")
test_payload("Manual Item Standard", p2)

# Scenario 3: Missing fields (simulating nulls)
p3 = {
    "product_id": 10,
    "description": "",
    "quantity": 1.0,
    "unit_price": None, # Simulating NaN
    "technician_id": None
}
test_payload("Unit Price Null", p3)

# Scenario 4: Quantity Null
p4 = {
    "product_id": 10,
    "description": "",
    "quantity": None,
    "unit_price": 10.0,
    "technician_id": None
}
test_payload("Quantity Null", p4)

