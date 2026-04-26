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

# Open takeout order
print("=== OPEN TAKE OUT ORDER ===")
r = s.post(f'{BASE}/restaurant/orders/open-takeout?customer_name=Test+Con+Receta', verify=False)
print("POST takeout:", r.status_code)
if r.status_code == 200:
    order = r.json()
    order_id = order.get('id')
    print(f"Order id={order_id}")

    # Get products
    r = s.get(f'{BASE}/products?limit=20', verify=False)
    products = r.json()
    pollo = next((p for p in products if p.get('name') == 'Pollo Asado Entero'), None)
    print(f"Pollo Asado id={pollo['id'] if pollo else 'NOT FOUND'}")

    if pollo:
        # Add Pollo Asado
        print("\n=== ADD POLLO ASADO TO ORDER ===")
        r = s.post(f'{BASE}/restaurant/orders/{order_id}/items', json=[
            {'product_id': pollo['id'], 'quantity': 1, 'notes': 'Pollo con receta'}
        ], verify=False)
        print("POST items:", r.status_code)
        if r.status_code == 200:
            resp = r.json()
            print(f"  Total: {resp.get('total_amount')}")
            print(f"  Items: {len(resp.get('items', []))}")

            # Checkout
            print("\n=== CHECKOUT ===")
            checkout = {
                'payment_method': 'CASH',
                'currency': 'VES',
                'exchange_rate': 1.0,
                'total_amount_bs': 25.0,
                'cash_session_id': 1,
                'payments': []
            }
            r = s.post(f'{BASE}/restaurant/orders/{order_id}/checkout', json=checkout, verify=False)
            print("POST checkout:", r.status_code)
            if r.status_code == 200:
                print("CHECKOUT SUCCESS!")
                sale = r.json()
                print(f"  Sale id: {sale.get('id') if isinstance(sale, dict) else 'N/A'}")
            else:
                print(f"  ERROR: {r.text[:300]}")
        else:
            print(f"  ERROR: {r.text[:200]}")
else:
    print(f"ERROR: {r.text[:200]}")

# Check DB
print("\n=== DATABASE ===")
import psycopg2
conn = psycopg2.connect(host="db_qa", port=5432, database="invensoft_qa", user="postgres", password="postgres")
cur = conn.cursor()
cur.execute("SELECT COUNT(*) FROM restaurante.sales")
print("Sales:", cur.fetchone()[0])
cur.execute("SELECT COUNT(*) FROM restaurante.kardex")
print("Kardex:", cur.fetchone()[0])

# Check kardex for Pollo Entero (ingredient)
cur.execute("SELECT k.id, k.movement_type, k.product_id, k.quantity, k.reference FROM restaurante.kardex k WHERE k.product_id = 2 ORDER BY k.id DESC LIMIT 5")
rows = cur.fetchall()
print("Kardex entries for product_id=2 (Pollo Entero):", len(rows))
for r2 in rows:
    print(f"  - id={r2[0]}, type={r2[1]}, product={r2[2]}, qty={r2[3]}, ref={r2[4]}")

conn.close()
print("\n=== DONE ===")