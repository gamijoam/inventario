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

# ===== STEP 1: CREATE INGREDIENTS (products for recipes) =====
print("\n=== CREATE INGREDIENTS ===")

ingredients = [
    {'name': 'Pollo Entero', 'price': 15.00, 'sku': 'POLLO001', 'category_id': None},
    {'name': 'Especias para Pollo', 'price': 2.50, 'sku': 'ESPEC001', 'category_id': None},
    {'name': 'Aceite', 'price': 1.50, 'sku': 'ACEI001', 'category_id': None},
    {'name': 'Masa Pizza', 'price': 3.00, 'sku': 'MASA001', 'category_id': None},
    {'name': 'Queso Mozzarella', 'price': 4.00, 'sku': 'MOZZ001', 'category_id': None},
    {'name': 'Salsa de Tomate', 'price': 1.00, 'sku': 'SALSA001', 'category_id': None},
]

created_products = []
for ing in ingredients:
    r = s.post(f'{BASE}/products/',
        json={
            'name': ing['name'],
            'price': ing['price'],
            'sku': ing['sku'],
            'is_active': True,
            'track_inventory': True
        }, verify=False)
    print(f"CREATE {ing['name']}:", r.status_code)
    if r.status_code in [200, 201]:
        created_products.append(r.json())
    else:
        print("  ERROR:", r.text[:200])

print(f"\nTotal ingredients created: {len(created_products)}")

# ===== STEP 2: CREATE MENU ITEMS (finished dishes) =====
print("\n=== CREATE MENU ITEMS (DISHES) ===")

dishes = [
    {'name': 'Pollo Asado Entero', 'price': 25.00, 'sku': 'POLLOAS001'},
    {'name': 'Mitad Pollo Asado', 'price': 13.00, 'sku': 'MEDPOL001'},
    {'name': 'Pizza Mediana', 'price': 12.00, 'sku': 'PIZZAM001'},
    {'name': 'Pizza Grande', 'price': 18.00, 'sku': 'PIZZAG001'},
]

created_dishes = []
for dish in dishes:
    r = s.post(f'{BASE}/products/',
        json={
            'name': dish['name'],
            'price': dish['price'],
            'sku': dish['sku'],
            'is_active': True,
            'track_inventory': True
        }, verify=False)
    print(f"CREATE {dish['name']}:", r.status_code)
    if r.status_code in [200, 201]:
        created_dishes.append(r.json())
    else:
        print("  ERROR:", r.text[:200])

print(f"\nTotal dishes created: {len(created_dishes)}")

# ===== STEP 3: CREATE MENU SECTIONS =====
print("\n=== CREATE MENU SECTIONS ===")

sections = [
    {'name': 'Pollos', 'sort_order': 1},
    {'name': 'Pizzas', 'sort_order': 2},
    {'name': 'Bebidas', 'sort_order': 3},
]

created_sections = []
for sec in sections:
    r = s.post(f'{BASE}/restaurant/menu/sections',
        json=sec, verify=False)
    print(f"CREATE SECTION {sec['name']}:", r.status_code)
    if r.status_code in [200, 201]:
        created_sections.append(r.json())
    else:
        print("  ERROR:", r.text[:200])

# ===== STEP 4: GET FULL MENU =====
print("\n=== GET FULL MENU ===")
r = s.get(f'{BASE}/restaurant/menu/full', verify=False)
print("GET menu:", r.status_code)
if r.status_code == 200:
    menu = r.json()
    print("Sections:", len(menu.get('sections', [])))
    for sec in menu.get('sections', []):
        print(f"  - {sec.get('name')} ({len(sec.get('items', []))} items)")

# ===== STEP 5: ADD DISHES TO MENU SECTIONS =====
print("\n=== ADD DISHES TO MENU SECTIONS ===")
if created_sections and created_dishes:
    # Add Pollo Asado to Pollos section
    r = s.post(f'{BASE}/restaurant/menu/items', json={
        'section_id': created_sections[0]['id'],
        'product_id': created_dishes[0]['id'],
        'alias': created_dishes[0]['name'],
        'price_override': created_dishes[0]['price']
    }, verify=False)
    print("Add Pollo Asado to Pollos:", r.status_code)

    # Add pizzas
    r = s.post(f'{BASE}/restaurant/menu/items', json={
        'section_id': created_sections[1]['id'],
        'product_id': created_dishes[2]['id'],
        'alias': created_dishes[2]['name']
    }, verify=False)
    print("Add Pizza Mediana to Pizzas:", r.status_code)

# ===== STEP 6: CREATE RECIPES (ESCANDALLO) =====
print("\n=== CREATE RECIPES ===")
if created_dishes and len(created_products) >= 3:
    # Recipe for Pollo Asado Entero
    # 1 Pollo + especias + aceite
    pollo = created_dishes[0]
    pollo_recipe = [
        {'product_id': created_products[0]['id'], 'quantity': 1.0},  # Pollo Entero
        {'product_id': created_products[1]['id'], 'quantity': 0.5},  # Especias
        {'product_id': created_products[2]['id'], 'quantity': 0.2},  # Aceite
    ]
    for ing_item in pollo_recipe:
        r = s.post(f'{BASE}/restaurant/menu/recipes', json={
            'product_id': pollo['id'],
            'ingredient_id': ing_item['product_id'],
            'quantity': ing_item['quantity']
        }, verify=False)
        print(f"Recipe {pollo['name']} + ing {ing_item['product_id']}:", r.status_code)
        if r.status_code != 200:
            print("  ERROR:", r.text[:200])

    # Recipe for Pizza Mediana
    pizza = created_dishes[2]
    pizza_recipe = [
        {'product_id': created_products[3]['id'], 'quantity': 1.0},  # Masa
        {'product_id': created_products[4]['id'], 'quantity': 0.5},  # Queso
        {'product_id': created_products[5]['id'], 'quantity': 0.3},  # Salsa
    ]
    for ing_item in pizza_recipe:
        r = s.post(f'{BASE}/restaurant/menu/recipes', json={
            'product_id': pizza['id'],
            'ingredient_id': ing_item['product_id'],
            'quantity': ing_item['quantity']
        }, verify=False)
        print(f"Recipe {pizza['name']} + ing {ing_item['product_id']}:", r.status_code)
        if r.status_code != 200:
            print("  ERROR:", r.text[:200])

    # Get recipes for a dish
    print("\n=== GET RECIPES FOR POLLO ASADO ===")
    r = s.get(f'{BASE}/restaurant/menu/recipes/{pollo["id"]}', verify=False)
    print("GET recipes:", r.status_code)
    if r.status_code == 200:
        recipes = r.json()
        print(f"Recipes for Pollo Asado: {len(recipes)} ingredients")
        print("Recipe data:", recipes)

# ===== STEP 7: GET ALL PRODUCTS =====
print("\n=== GET ALL PRODUCTS ===")
r = s.get(f'{BASE}/products?limit=20', verify=False)
print("GET products:", r.status_code)
if r.status_code == 200:
    products = r.json()
    print(f"Total products: {len(products)}")
    for p in products:
        print(f"  - {p.get('name')} (id={p.get('id')}, price={p.get('price')})")

# ===== STEP 8: OPEN ORDER AND ADD DISH =====
print("\n=== OPEN ORDER AND ADD DISH ===")
if created_dishes:
    # Get available table
    r = s.get(f'{BASE}/restaurant/tables/', verify=False)
    tables = r.json()
    available = [t for t in tables if t.get('status') == 'AVAILABLE']
    if available:
        table = available[0]
        print(f"Using table: {table.get('name')}")

        # Open order
        r = s.post(f'{BASE}/restaurant/orders/open/{table["id"]}', verify=False)
        print("OPEN order:", r.status_code)
        if r.status_code == 200:
            order = r.json()
            order_id = order.get('id')
            print(f"Order id={order_id}")

            # Add pollo asado
            pollo = created_dishes[0]
            r = s.post(f'{BASE}/restaurant/orders/{order_id}/items', json=[
                {'product_id': pollo['id'], 'quantity': 1, 'notes': 'Bien asado'}
            ], verify=False)
            print("ADD Pollo Asado:", r.status_code)
            if r.status_code == 200:
                print("Total:", r.json().get('total_amount'))

            # Add pizza
            pizza = created_dishes[2]
            r = s.post(f'{BASE}/restaurant/orders/{order_id}/items', json=[
                {'product_id': pizza['id'], 'quantity': 2, 'notes': 'Extra queso'}
            ], verify=False)
            print("ADD Pizza Mediana x2:", r.status_code)
            if r.status_code == 200:
                print("Total:", r.json().get('total_amount'))

# ===== STEP 9: CHECK KITCHEN PENDING =====
print("\n=== GET KITCHEN PENDING ===")
r = s.get(f'{BASE}/restaurant/orders/kitchen/pending', verify=False)
print("GET kitchen:", r.status_code)
if r.status_code == 200:
    orders = r.json()
    print(f"Pending orders: {len(orders)}")
    for o in orders:
        print(f"  - Order {o.get('id')}: {len(o.get('items', []))} items")

# ===== DATABASE VERIFICATION =====
print("\n=== DATABASE VERIFICATION ===")
import psycopg2
conn = psycopg2.connect(host="db_qa", port=5432, database="invensoft_qa", user="postgres", password="postgres")
cur = conn.cursor()
cur.execute('SELECT COUNT(*) FROM restaurante.products')
print("Products:", cur.fetchone()[0])
cur.execute('SELECT COUNT(*) FROM restaurante.restaurant_orders')
print("Orders:", cur.fetchone()[0])
cur.execute('SELECT COUNT(*) FROM restaurante.restaurant_order_items')
print("Order items:", cur.fetchone()[0])
cur.execute('SELECT COUNT(*) FROM restaurante.restaurant_recipes')
print("Recipes:", cur.fetchone()[0])
cur.execute('SELECT COUNT(*) FROM restaurante.restaurant_menu_sections')
print("Menu sections:", cur.fetchone()[0])
cur.execute('SELECT COUNT(*) FROM restaurante.restaurant_menu_items')
print("Menu items:", cur.fetchone()[0])
cur.execute('SELECT COUNT(*) FROM restaurante.kardex')
print("Kardex (stock movements):", cur.fetchone()[0])
conn.close()

print("\n=== DONE ===")