#!/usr/bin/env python3
import requests
import urllib3
from urllib.parse import urlencode
import psycopg2

urllib3.disable_warnings()

BASE = 'http://localhost:8000/api/v1'
TENANT = 'restaurante'

s = requests.Session()
data = urlencode({'username': 'admin', 'password': '12345678'})
login = s.post(f'{BASE}/auth/token', data=data, headers={'X-Tenant-ID': TENANT, 'Content-Type': 'application/x-www-form-urlencoded'}, verify=False)
print("LOGIN:", login.status_code)
s.headers.update({'X-Tenant-ID': TENANT})

print("\n=== OPEN TAKE OUT ORDER ===")
r = s.post(f'{BASE}/restaurant/orders/open-takeout?customer_name=Test+Con+Receta', verify=False)
print("POST takeout:", r.status_code)
if r.status_code != 200:
    print("Error:", r.text[:200])
    exit(1)
order = r.json()
order_id = order.get('id')
print(f"Order id={order_id}")

print("\n=== GET PRODUCTS ===")
r = s.get(f'{BASE}/products?limit=20', verify=False)
products = r.json()
pollo = next((p for p in products if p.get('name') == 'Pollo Asado Entero'), None)
print(f"Pollo Asado: id={pollo['id'] if pollo else 'NOT FOUND'}")

if not pollo:
    print("ERROR: Pollo Asado not found")
    exit(1)

print("\n=== ADD POLLO ASADO TO ORDER ===")
r = s.post(f'{BASE}/restaurant/orders/{order_id}/items', json=[
    {'product_id': pollo['id'], 'quantity': 1, 'notes': 'Pollo con receta'}
], verify=False)
print("POST items:", r.status_code)
if r.status_code == 200:
    resp = r.json()
    print(f"  Total: {resp.get('total_amount')}")
    print(f"  Items: {len(resp.get('items', []))}")
else:
    print("Error:", r.text[:200])
    exit(1)

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
    print(f"  Sale id: {sale.get('sale_id')}")
else:
    print("ERROR:", r.text[:300])
    exit(1)

print("\n=== DATABASE ===")
conn = psycopg2.connect(host="172.20.0.10", port=5432, database="invensoft_qa", user="postgres", password="postgres")
cur = conn.cursor()
cur.execute("SELECT COUNT(*) FROM restaurante.sales")
print("Sales:", cur.fetchone()[0])

cur.execute("SELECT k.id, k.movement_type, k.product_id, k.quantity FROM restaurante.kardex k WHERE k.product_id = 2 ORDER BY k.id DESC LIMIT 5")
rows = cur.fetchall()
print("Kardex entries for product_id=2 (Pollo Entero):", len(rows))
for r2 in rows:
    print(f"  - id={r2[0]}, type={r2[1]}, product={r2[2]}, qty={r2[3]}")
conn.close()

print("\n=== DONE ===")