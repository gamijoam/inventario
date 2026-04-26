#!/usr/bin/env python3
import requests
import urllib3
import json
from urllib.parse import urlencode

urllib3.disable_warnings()

BASE = 'https://api-qa.miinventariofacil.com/api/v1'
TENANT = 'restaurante'

s = requests.Session()

print("=== LOGIN ===")
data = urlencode({'username': 'restaurante@gmail.com', 'password': '12345678'})
login = s.post(f'{BASE}/auth/token',
    data=data,
    headers={
        'X-Tenant-ID': TENANT,
        'Content-Type': 'application/x-www-form-urlencoded',
    }, verify=False)
print("LOGIN:", login.status_code)
if login.status_code != 200:
    print("FAILED:", login.text[:200])
    exit(1)
s.headers.update({'X-Tenant-ID': TENANT})

# Get products first
print("\n=== GET PRODUCTS ===")
r = s.get(f'{BASE}/products?limit=5', verify=False)
products = r.json()
print("Products:", len(products))
if not products:
    print("No products found!")
    exit(1)
prod = products[0]
print("Using product:", prod.get('name'), "id=", prod.get('id'))

# Create takeout order
print("\n=== CREATE TAKEOUT ORDER ===")
r = s.post(f'{BASE}/restaurant/orders/open-takeout?customer_name=Cliente+Test+API', verify=False)
print("POST takeout:", r.status_code)
if r.status_code != 200:
    print("ERROR:", r.text[:200])
    takeout_id = None
else:
    takeout = r.json()
    takeout_id = takeout.get('id')
    print("Takeout order id=", takeout_id)

# Add item to takeout
if takeout_id:
    print("\n=== ADD ITEM TO TAKEOUT ===")
    items = [{'product_id': prod.get('id'), 'quantity': 3, 'notes': 'Test API'}]
    r = s.post(f'{BASE}/restaurant/orders/{takeout_id}/items',
        json=items, verify=False)
    print("POST items:", r.status_code)
    if r.status_code == 200:
        print("Items added, total:", r.json().get('total_amount'))
    else:
        print("ERROR:", r.text[:200])

    # Checkout takeout
    print("\n=== CHECKOUT TAKEOUT ===")
    checkout_data = {
        'payment_method': 'CASH',
        'currency': 'VES',
        'exchange_rate': 1.0,
        'total_amount_bs': 12.0,
        'payments': []
    }
    r = s.post(f'{BASE}/restaurant/orders/{takeout_id}/checkout',
        json=checkout_data, verify=False)
    print("POST checkout:", r.status_code)
    if r.status_code == 200:
        print("Checkout OK!")
        sale = r.json()
        print("Sale id:", sale.get('id') if isinstance(sale, dict) else "N/A")
    else:
        print("ERROR:", r.text[:300])

# Get KITCHEN PENDING
print("\n=== GET KITCHEN PENDING ===")
r = s.get(f'{BASE}/restaurant/orders/kitchen/pending', verify=False)
print("GET kitchen:", r.status_code)
if r.status_code == 200:
    orders = r.json()
    print("Pending orders:", len(orders))
    for o in orders:
        print("  - Order", o.get('id'), "items:", len(o.get('items', [])))

# Update item status
if orders:
    first_order = orders[0]
    if first_order.get('items'):
        item = first_order['items'][0]
        item_id = item.get('id')
        print("\n=== UPDATE ITEM STATUS TO SENT ===")
        r = s.put(f'{BASE}/restaurant/orders/items/{item_id}/status?status=SENT', verify=False)
        print("PUT status SENT:", r.status_code)

        print("\n=== UPDATE ITEM STATUS TO PREPARING ===")
        r = s.put(f'{BASE}/restaurant/orders/items/{item_id}/status?status=PREPARING', verify=False)
        print("PUT status PREPARING:", r.status_code)

        print("\n=== UPDATE ITEM STATUS TO READY ===")
        r = s.put(f'{BASE}/restaurant/orders/items/{item_id}/status?status=READY', verify=False)
        print("PUT status READY:", r.status_code)

# FINAL DB VERIFICATION
print("\n=== FINAL DATABASE VERIFICATION ===")
import psycopg2
conn = psycopg2.connect(host="db_qa", port=5432, database="invensoft_qa", user="postgres", password="postgres")
cur = conn.cursor()
cur.execute('SELECT COUNT(*) FROM restaurante.restaurant_tables')
print("Tables:", cur.fetchone()[0])
cur.execute('SELECT COUNT(*) FROM restaurante.restaurant_orders')
print("Orders:", cur.fetchone()[0])
cur.execute('SELECT COUNT(*) FROM restaurante.restaurant_order_items')
print("Order items:", cur.fetchone()[0])
cur.execute('SELECT COUNT(*) FROM restaurante.sales')
print("Sales:", cur.fetchone()[0])
cur.execute('SELECT COUNT(*) FROM restaurante.restaurant_recipes')
print("Recipes:", cur.fetchone()[0])
cur.execute('SELECT COUNT(*) FROM restaurante.kardex')
print("Kardex (stock movements):", cur.fetchone()[0])
conn.close()

print("\n=== TESTS COMPLETE ===")