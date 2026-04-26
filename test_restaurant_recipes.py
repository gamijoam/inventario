#!/usr/bin/env python3
import requests
import urllib3
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

# Get existing products
print("\n=== GET ALL PRODUCTS ===")
r = s.get(f'{BASE}/products?limit=20', verify=False)
print("GET products:", r.status_code)
products = r.json()
print(f"Total products: {len(products)}")
for p in products:
    print(f"  - {p.get('name')} (id={p.get('id')})")

# Get existing menu
print("\n=== GET FULL MENU ===")
r = s.get(f'{BASE}/restaurant/menu/full', verify=False)
print("GET menu:", r.status_code)
menu = r.json()
print(f"Sections: {len(menu.get('sections', []))}")
for sec in menu.get('sections', []):
    print(f"  - {sec.get('name')}: {len(sec.get('items', []))} items")

# ===== CREATE RECIPES =====
print("\n=== CREATE RECIPES ===")

# Find Pollo Asado Entero (id=8) and its ingredients
pollo_asado = next((p for p in products if p.get('name') == 'Pollo Asado Entero'), None)
pollo_entero = next((p for p in products if p.get('name') == 'Pollo Entero'), None)
especias = next((p for p in products if p.get('name') == 'Especias para Pollo'), None)
aceite = next((p for p in products if p.get('name') == 'Aceite'), None)

print(f"Pollo Asado: id={pollo_asado.get('id') if pollo_asado else 'NOT FOUND'}")
print(f"Pollo Entero: id={pollo_entero.get('id') if pollo_entero else 'NOT FOUND'}")

if pollo_asado and pollo_entero and especias and aceite:
    recipes_to_create = [
        {'product_id': pollo_asado['id'], 'ingredient_id': pollo_entero['id'], 'quantity': 1.0},
        {'product_id': pollo_asado['id'], 'ingredient_id': especias['id'], 'quantity': 0.5},
        {'product_id': pollo_asado['id'], 'ingredient_id': aceite['id'], 'quantity': 0.2},
    ]

    for rec in recipes_to_create:
        r = s.post(f'{BASE}/restaurant/menu/recipes', json=rec, verify=False)
        print(f"Add recipe: pollo={rec['product_id']} + ing={rec['ingredient_id']} qty={rec['quantity']} => {r.status_code}")
        if r.status_code != 200:
            print(f"  ERROR: {r.text[:200]}")
else:
    print("Missing ingredients for recipe!")

# Get recipes for Pollo Asado
print("\n=== GET RECIPES FOR POLLO ASADO ===")
if pollo_asado:
    r = s.get(f'{BASE}/restaurant/menu/recipes/{pollo_asado["id"]}', verify=False)
    print("GET recipes:", r.status_code)
    if r.status_code == 200:
        recipes = r.json()
        print(f"Recipes found: {len(recipes)}")
        for rec in recipes:
            print(f"  - Recipe id={rec.get('id')}, ingredient_id={rec.get('ingredient_id')}, qty={rec.get('quantity')}")

# ===== CREATE NEW SECTION =====
print("\n=== CREATE NEW SECTION ===")
r = s.post(f'{BASE}/restaurant/menu/sections', json={'name': 'ComidasRapidas', 'sort_order': 10}, verify=False)
print("CREATE section:", r.status_code)
if r.status_code not in [200, 201]:
    print("  ERROR:", r.text[:200])

# ===== ADD ITEM TO SECTION =====
print("\n=== ADD DISH TO SECTION ===")
if pollo_asado:
    # Find ComidasRapidas section
    r = s.get(f'{BASE}/restaurant/menu/full', verify=False)
    sections = r.json().get('sections', [])
    comidas_rapidas = next((sec for sec in sections if sec.get('name') == 'ComidasRapidas'), None)
    if comidas_rapidas:
        r = s.post(f'{BASE}/restaurant/menu/items', json={
            'section_id': comidas_rapidas['id'],
            'product_id': pollo_asado['id'],
            'alias': 'Pollo Asado',
            'price_override': 25.00
        }, verify=False)
        print("ADD to ComidasRapidas:", r.status_code)
        if r.status_code not in [200, 201]:
            print("  ERROR:", r.text[:200])
    else:
        # Use first section
        if sections:
            first_sec = sections[0]
            r = s.post(f'{BASE}/restaurant/menu/items', json={
                'section_id': first_sec['id'],
                'product_id': pollo_asado['id'],
                'alias': 'Pollo Asado',
                'price_override': 25.00
            }, verify=False)
            print("ADD to first section:", r.status_code)

# ===== OPEN ORDER AND ADD DISH =====
print("\n=== OPEN ORDER AND ADD DISH ===")

# Get available table
r = s.get(f'{BASE}/restaurant/tables/', verify=False)
tables = r.json()
print(f"Total tables: {len(tables)}")
available = [t for t in tables if t.get('status') == 'AVAILABLE']
print(f"Available tables: {len(available)}")

if available:
    table = available[0]
    print(f"Using table: {table.get('name')}")

    r = s.post(f'{BASE}/restaurant/orders/open/{table["id"]}', verify=False)
    print("OPEN order:", r.status_code)
    if r.status_code == 200:
        order = r.json()
        order_id = order.get('id')
        print(f"Order id={order_id}")

        # Add Pollo Asado
        if pollo_asado:
            r = s.post(f'{BASE}/restaurant/orders/{order_id}/items', json=[
                {'product_id': pollo_asado['id'], 'quantity': 2, 'notes': 'Test con receta'}
            ], verify=False)
            print("ADD Pollo Asado x2:", r.status_code)
            if r.status_code == 200:
                print("  Total:", r.json().get('total_amount'))
                print("  Items:", len(r.json().get('items', [])))
            else:
                print("  ERROR:", r.text[:200])

# ===== CHECK KITCHEN PENDING =====
print("\n=== GET KITCHEN PENDING ===")
r = s.get(f'{BASE}/restaurant/orders/kitchen/pending', verify=False)
print("GET kitchen:", r.status_code)
if r.status_code == 200:
    orders = r.json()
    print(f"Pending: {len(orders)}")
    for o in orders[-3:]:
        print(f"  - Order {o.get('id')}: {len(o.get('items', []))} items, total={o.get('total_amount')}")

# ===== FINAL DB CHECK =====
print("\n=== DATABASE ===")
import psycopg2
conn = psycopg2.connect(host="db_qa", port=5432, database="invensoft_qa", user="postgres", password="postgres")
cur = conn.cursor()
cur.execute('SELECT COUNT(*) FROM restaurante.restaurant_recipes')
print("Recipes:", cur.fetchone()[0])
cur.execute('SELECT COUNT(*) FROM restaurante.restaurant_order_items')
print("Order items:", cur.fetchone()[0])
cur.execute('SELECT COUNT(*) FROM restaurante.kardex')
print("Kardex:", cur.fetchone()[0])
conn.close()

print("\n=== DONE ===")