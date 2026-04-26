#!/usr/bin/env python3
import requests
import urllib3
from urllib.parse import urlencode

urllib3.disable_warnings()

BASE = 'https://api-qa.miinventariofacil.com/api/v1'
TENANT = 'restaurante'

s = requests.Session()
data = urlencode({'username': 'admin', 'password': '12345678'})
login = s.post(f'{BASE}/auth/token', data=data, headers={'X-Tenant-ID': TENANT, 'Content-Type': 'application/x-www-form-urlencoded'}, verify=False)
print("LOGIN:", login.status_code)
s.headers.update({'X-Tenant-ID': TENANT})

# Get a table
r = s.get(f'{BASE}/restaurant/tables', verify=False)
tables = r.json()
table = tables[0]
table_id = table.get('id')
print("Table:", table.get('name'), "id=", table_id)

# Open table order - correct endpoint is /open/{table_id}
r = s.post(f'{BASE}/restaurant/orders/open/{table_id}', verify=False)
print("\nOpen table order:", r.status_code)
if r.status_code != 200:
    print("Error:", r.text[:200])
    exit(1)
order = r.json()
order_id = order.get('id')
print("Order id=", order_id)

# Get products and add item
r = s.get(f'{BASE}/products?limit=20', verify=False)
products = r.json()
pollo = next((p for p in products if p.get('name') == 'Pollo Asado Entero'), None)
print("Pollo Asado id=", pollo['id'])

r = s.post(f'{BASE}/restaurant/orders/{order_id}/items', json=[
    {'product_id': pollo['id'], 'quantity': 1, 'notes': 'Table test'}
], verify=False)
print("Add item:", r.status_code)
if r.status_code != 200:
    print("Error:", r.text[:200])
    exit(1)
resp = r.json()
print("  Total:", resp.get('total_amount'))

# Get item_id
r = s.get(f'{BASE}/restaurant/orders/{order_id}', verify=False)
order_detail = r.json()
item_id = order_detail.get('items', [{}])[0].get('id')
print("Item id=", item_id)

# Update status to SENT
r = s.put(f'{BASE}/restaurant/orders/items/{item_id}/status?status=SENT', verify=False)
print("Mark SENT:", r.status_code)

# Update status to PREPARING
r = s.put(f'{BASE}/restaurant/orders/items/{item_id}/status?status=PREPARING', verify=False)
print("Mark PREPARING:", r.status_code)

# Checkout
checkout = {
    'payment_method': 'CASH',
    'currency': 'VES',
    'exchange_rate': 1.0,
    'total_amount_bs': 25.0,
    'cash_session_id': 1,
    'payments': []
}
r = s.post(f'{BASE}/restaurant/orders/{order_id}/checkout', json=checkout, verify=False)
print("\nCheckout:", r.status_code)
if r.status_code == 200:
    print("SUCCESS! Sale id=", r.json().get('sale_id'))
else:
    print("Error:", r.text[:300])

# Verify table is free
r = s.get(f'{BASE}/restaurant/tables/{table_id}', verify=False)
if r.status_code == 200:
    table = r.json()
    print("\nTable status after checkout:", table.get('status'))

print("\n=== DONE ===")