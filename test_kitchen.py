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

r = s.get(f'{BASE}/restaurant/orders/kitchen/pending', verify=False)
print("Kitchen pending:", r.status_code)
if r.status_code == 200:
    orders = r.json()
    print("  Found", len(orders), "pending orders")

r = s.post(f'{BASE}/restaurant/orders/open-takeout?customer_name=Kitchen+Test', verify=False)
order = r.json()
order_id = order.get('id')
print("\nCreated order", order_id)

r = s.get(f'{BASE}/products?limit=20', verify=False)
products = r.json()
pollo = next((p for p in products if p.get('name') == 'Pollo Asado Entero'), None)

r = s.post(f'{BASE}/restaurant/orders/{order_id}/items', json=[
    {'product_id': pollo['id'], 'quantity': 2, 'notes': '2 polls'}
], verify=False)
print("Added item:", r.status_code)

# Get item_id from order details
r = s.get(f'{BASE}/restaurant/orders/{order_id}', verify=False)
if r.status_code == 200:
    order_detail = r.json()
    items = order_detail.get('items', [])
    if items:
        item_id = items[0].get('id')
        print("Item id:", item_id)

        # Send to kitchen
        r = s.post(f'{BASE}/restaurant/orders/{order_id}/send-to-kitchen', verify=False)
        print("Send to kitchen:", r.status_code)

        # Update item status using PUT
        r = s.put(f'{BASE}/restaurant/orders/items/{item_id}/status?status=PREPARING', verify=False)
        print("Mark PREPARING:", r.status_code)

        r = s.put(f'{BASE}/restaurant/orders/items/{item_id}/status?status=READY', verify=False)
        print("Mark READY:", r.status_code)

# Check kitchen display after completing
r = s.get(f'{BASE}/restaurant/orders/kitchen/pending', verify=False)
if r.status_code == 200:
    orders = r.json()
    print("\nKitchen now has", len(orders), "pending orders after marking READY")
    for o in orders:
        if o.get('id') == order_id:
            print("  Our order:", o.get('status'), [(i.get('status')) for i in o.get('items', [])])

print("\n=== DONE ===")