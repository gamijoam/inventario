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
token = login.json().get('access_token')
print("Token OK")

s.headers.update({'X-Tenant-ID': TENANT})

# ===== FASE 1: VERIFICAR TENANT MODULES =====
print("\n=== FASE 1: VERIFICAR TENANT MODULES ===")
r = s.get(f'{BASE}/config/public', verify=False)
modules = r.json().get('modules', {})
print("Restaurant module:", modules.get('restaurant'))

# ===== FASE 2: PRODUCTS =====
print("\n=== FASE 2: PRODUCTS ===")
r = s.get(f'{BASE}/products?limit=5', verify=False)
print("GET /products:", r.status_code)
if r.status_code == 200:
    products = r.json()
    print("Total products:", len(products))
    for p in products[:5]:
        print("  -", p.get('name'), "id=", p.get('id'))
else:
    print("ERROR:", r.text[:200])

# ===== FASE 3: GET TABLES =====
print("\n=== FASE 3: GET TABLES ===")
r = s.get(f'{BASE}/restaurant/tables/', verify=False)
print("GET /restaurant/tables:", r.status_code)
if r.status_code == 200:
    tables = r.json()
    print("Total tables:", len(tables))
    for t in tables:
        print("  -", t.get('name'), "zone=", t.get('zone'), "status=", t.get('status'))
else:
    print("ERROR:", r.text[:300])

# ===== FASE 4: CREATE TABLE =====
print("\n=== FASE 4: CREATE TABLE ===")
r = s.post(f'{BASE}/restaurant/tables/',
    json={'name': 'Mesa Test CLI', 'zone': 'Terraza', 'capacity': 4},
    verify=False)
print("POST /restaurant/tables:", r.status_code)
if r.status_code == 201:
    table = r.json()
    table_id = table.get('id')
    print("Created table id=", table_id)
else:
    print("ERROR:", r.text[:300])
    table_id = None

# ===== FASE 5: GET FULL MENU =====
print("\n=== FASE 5: GET FULL MENU ===")
r = s.get(f'{BASE}/restaurant/menu/full', verify=False)
print("GET /restaurant/menu/full:", r.status_code)
if r.status_code == 200:
    menu = r.json()
    print("Sections:", len(menu.get('sections', [])))
    for sec in menu.get('sections', []):
        print("  -", sec.get('name'), len(sec.get('items', [])), "items")
else:
    print("ERROR:", r.text[:300])

# ===== FASE 6: OPEN TABLE ORDER =====
print("\n=== FASE 6: OPEN TABLE ORDER ===")
if table_id:
    r = s.post(f'{BASE}/restaurant/orders/open/{table_id}', verify=False)
    print("POST /restaurant/orders/open/" + str(table_id) + ":", r.status_code)
    if r.status_code == 200:
        order = r.json()
        order_id = order.get('id')
        print("Opened order id=", order_id)
    else:
        print("ERROR:", r.text[:300])
        order_id = None
else:
    order_id = None

# ===== FASE 7: ADD ITEMS TO ORDER =====
print("\n=== FASE 7: ADD ITEMS TO ORDER ===")
if order_id:
    prods = s.get(f'{BASE}/products?limit=3', verify=False).json()
    if prods:
        prod = prods[0]
        items = [{'product_id': prod.get('id'), 'quantity': 2, 'notes': 'Test CLI'}]
        r = s.post(f'{BASE}/restaurant/orders/{order_id}/items',
            json=items, verify=False)
        print("POST items:", r.status_code)
        if r.status_code == 200:
            print("Items added OK")
            print("Order updated:", r.json().get('total_amount'))
        else:
            print("ERROR:", r.text[:300])

# ===== FASE 8: OPEN TAKEOUT =====
print("\n=== FASE 8: OPEN TAKEOUT ===")
r = s.post(f'{BASE}/restaurant/orders/open-takeout?customer_name=Cliente+Test', verify=False)
print("POST /restaurant/orders/open-takeout:", r.status_code)
if r.status_code == 200:
    takeout = r.json()
    takeout_id = takeout.get('id')
    print("Opened takeout id=", takeout_id)

    # Add item to takeout
    if prods and len(prods) > 1:
        prod2 = prods[1]
        items2 = [{'product_id': prod2.get('id'), 'quantity': 1, 'notes': 'Para llevar'}]
        r2 = s.post(f'{BASE}/restaurant/orders/{takeout_id}/items',
            json=items2, verify=False)
        print("Add to takeout:", r2.status_code)
else:
    print("ERROR:", r.text[:300])
    takeout_id = None

# ===== FASE 9: GET KITCHEN PENDING =====
print("\n=== FASE 9: GET KITCHEN PENDING ===")
r = s.get(f'{BASE}/restaurant/orders/kitchen/pending', verify=False)
print("GET /restaurant/orders/kitchen/pending:", r.status_code)
if r.status_code == 200:
    orders = r.json()
    print("Pending orders:", len(orders))
else:
    print("ERROR:", r.text[:300])

# ===== FASE 10: CHECKOUT TAKEOUT =====
print("\n=== FASE 10: CHECKOUT TAKEOUT ===")
if takeout_id:
    checkout_data = {
        'payment_method': 'CASH',
        'currency': 'VES',
        'exchange_rate': 1.0,
        'total_amount_bs': 100.0,
        'payments': []
    }
    r = s.post(f'{BASE}/restaurant/orders/{takeout_id}/checkout',
        json=checkout_data, verify=False)
    print("POST checkout:", r.status_code)
    if r.status_code == 200:
        print("Checkout OK, sale created")
    else:
        print("ERROR:", r.text[:300])

# ===== FASE 11: GET ORDERS =====
print("\n=== FASE 11: GET ORDER DETAIL ===")
if order_id:
    r = s.get(f'{BASE}/restaurant/orders/{order_id}', verify=False)
    print("GET order:", r.status_code)
    if r.status_code == 200:
        order_detail = r.json()
        print("Order items:", len(order_detail.get('items', [])))
        print("Order total:", order_detail.get('total_amount'))

# ===== VERIFY IN DATABASE =====
print("\n=== DATABASE VERIFICATION ===")
import psycopg2
conn = psycopg2.connect(host="db_qa", port=5432, database="invensoft_qa", user="postgres", password="postgres")
cur = conn.cursor()
cur.execute('SELECT COUNT(*) FROM restaurante.restaurant_tables')
print("Tables in DB:", cur.fetchone()[0])
cur.execute('SELECT COUNT(*) FROM restaurante.restaurant_orders')
print("Orders in DB:", cur.fetchone()[0])
cur.execute('SELECT COUNT(*) FROM restaurante.restaurant_order_items')
print("Order items in DB:", cur.fetchone()[0])
cur.execute('SELECT COUNT(*) FROM restaurante.restaurant_menu_sections')
print("Menu sections in DB:", cur.fetchone()[0])
cur.execute('SELECT COUNT(*) FROM restaurante.restaurant_recipes')
print("Recipes in DB:", cur.fetchone()[0])
conn.close()

print("\n=== DONE ===")