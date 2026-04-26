#!/usr/bin/env python3
import requests
import urllib3
from urllib.parse import urlencode

urllib3.disable_warnings()

BASE = 'https://api-qa.miinventariofacil.com/api/v1'
TENANT = 'restaurante'

s = requests.Session()
data = urlencode({'username': 'restaurante@gmail.com', 'password': '12345678'})
login = s.post(f'{BASE}/auth/token', data=data, headers={'X-Tenant-ID': TENANT, 'Content-Type': 'application/x-www-form-urlencoded'}, verify=False)
s.headers.update({'X-Tenant-ID': TENANT})

# Check current session
print("=== CHECK CURRENT CASH SESSION ===")
r = s.get(f'{BASE}/cash/sessions/current', verify=False)
print("GET /cash/sessions/current:", r.status_code)
if r.status_code == 200:
    print("Current session:", r.json())
else:
    print("Error:", r.text[:200])

# Check cash registers
print("\n=== GET CASH REGISTERS ===")
r = s.get(f'{BASE}/cash/registers', verify=False)
print("GET /cash/registers:", r.status_code)
if r.status_code == 200:
    registers = r.json()
    print(f"Registers: {len(registers)}")
    for reg in registers:
        print(f"  - {reg.get('name')} (id={reg.get('id')})")

# Open session
print("\n=== OPEN CASH SESSION ===")
r = s.post(f'{BASE}/cash/sessions/open', json={'register_id': 1, 'initial_cash': 50.0}, verify=False)
print("POST /cash/sessions/open:", r.status_code)
if r.status_code in [200, 201]:
    session = r.json()
    print(f"Opened session id={session.get('id')}")
    cash_session_id = session.get('id')
else:
    print("Error:", r.text[:300])
    cash_session_id = None

# Add Pollo Asado to order and checkout
if cash_session_id:
    print("\n=== ADD DISH TO ORDER AND CHECKOUT ===")
    r = s.post(f'{BASE}/restaurant/orders/open-takeout?customer_name=Test+Receta', verify=False)
    if r.status_code == 200:
        order = r.json()
        order_id = order.get('id')
        print(f"Order id={order_id}")

        # Get products
        r = s.get(f'{BASE}/products?limit=20', verify=False)
        products = r.json()
        pollo = next((p for p in products if p.get('name') == 'Pollo Asado Entero'), None)
        if pollo:
            r = s.post(f'{BASE}/restaurant/orders/{order_id}/items', json=[
                {'product_id': pollo['id'], 'quantity': 1, 'notes': 'Test'}
            ], verify=False)
            print("Add item:", r.status_code)

        # Checkout
        checkout = {
            'payment_method': 'CASH',
            'currency': 'VES',
            'exchange_rate': 1.0,
            'total_amount_bs': 25.0,
            'cash_session_id': cash_session_id,
            'payments': []
        }
        r = s.post(f'{BASE}/restaurant/orders/{order_id}/checkout', json=checkout, verify=False)
        print("Checkout:", r.status_code)
        if r.status_code == 200:
            print("SUCCESS!")
        else:
            print("Error:", r.text[:300])

# Check DB
print("\n=== DATABASE ===")
import psycopg2
conn = psycopg2.connect(host="db_qa", port=5432, database="invensoft_qa", user="postgres", password="postgres")
cur = conn.cursor()
cur.execute("SELECT COUNT(*) FROM restaurante.sales")
print("Sales:", cur.fetchone()[0])
cur.execute("SELECT COUNT(*) FROM restaurante.kardex")
print("Kardex:", cur.fetchone()[0])
conn.close()

print("\n=== DONE ===")