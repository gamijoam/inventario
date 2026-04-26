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

# Get products
r = s.get(f'{BASE}/products?limit=20', verify=False)
products = r.json()

pollo_asado = next((p for p in products if p.get('name') == 'Pollo Asado Entero'), None)
pollo_entero = next((p for p in products if p.get('name') == 'Pollo Entero'), None)

print(f"\nPollo Asado: id={pollo_asado['id']}")
print(f"Pollo Entero (ingredient): id={pollo_entero['id']}")

# ===== GET OPEN CASH SESSION =====
print("\n=== CHECK OPEN CASH SESSION ===")
open_sessions = []
cash_session_id = None
r = s.get(f'{BASE}/cash/sessions', verify=False)
print("GET cash sessions:", r.status_code)
if r.status_code == 200:
    sessions = r.json()
    print(f"Total sessions: {len(sessions)}")
    open_sessions = [s for s in sessions if s.get('status') == 'OPEN']
    print(f"Open sessions: {len(open_sessions)}")
    if open_sessions:
        cash_session = open_sessions[0]
        cash_session_id = cash_session['id']
        print(f"  Using session id={cash_session_id}")

# ===== OPEN NEW TAKE OUT ORDER =====
print("\n=== OPEN TAKE OUT ORDER ===")
r = s.post(f'{BASE}/restaurant/orders/open-takeout?customer_name=Cliente+Receta', verify=False)
print("POST takeout:", r.status_code)
if r.status_code == 200:
    order = r.json()
    order_id = order.get('id')
    print(f"Order id={order_id}")

    # Add Pollo Asado with quantity 1
    if pollo_asado:
        print("\n=== ADD POLLO ASADO TO ORDER ===")
        r = s.post(f'{BASE}/restaurant/orders/{order_id}/items', json=[
            {'product_id': pollo_asado['id'], 'quantity': 1, 'notes': 'Pollo completo'}
        ], verify=False)
        print("ADD item:", r.status_code)
        if r.status_code == 200:
            resp = r.json()
            print(f"  Total: {resp.get('total_amount')}")
            print(f"  Items: {len(resp.get('items', []))}")
            for item in resp.get('items', []):
                print(f"    - {item.get('product_name')} x{item.get('quantity')}")

    # ===== CHECKOUT =====
    print("\n=== CHECKOUT ===")
    if cash_session_id:
        checkout_data = {
            'payment_method': 'CASH',
            'currency': 'VES',
            'exchange_rate': 1.0,
            'total_amount_bs': 25.0,
            'cash_session_id': cash_session_id,
            'payments': []
        }
        r = s.post(f'{BASE}/restaurant/orders/{order_id}/checkout', json=checkout_data, verify=False)
        print("POST checkout:", r.status_code)
        if r.status_code == 200:
            print("CHECKOUT SUCCESS!")
            sale = r.json()
            print(f"  Sale id: {sale.get('id') if isinstance(sale, dict) else 'N/A'}")
        else:
            print(f"  ERROR: {r.text[:300]}")
    else:
        print("No open cash session - need to open one first")

        # Try to open cash session
        print("\n=== OPEN CASH SESSION ===")
        r = s.post(f'{BASE}/cash/sessions/open', json={'opening_balance': 100.0}, verify=False)
        print("POST open cash session:", r.status_code)
        if r.status_code in [200, 201]:
            session = r.json()
            print(f"  Opened session id={session.get('id')}")
            cash_session_id = session.get('id')

            # Retry checkout
            print("\n=== CHECKOUT (retry) ===")
            checkout_data = {
                'payment_method': 'CASH',
                'currency': 'VES',
                'exchange_rate': 1.0,
                'total_amount_bs': 25.0,
                'cash_session_id': cash_session_id,
                'payments': []
            }
            r = s.post(f'{BASE}/restaurant/orders/{order_id}/checkout', json=checkout_data, verify=False)
            print("POST checkout:", r.status_code)
            if r.status_code == 200:
                print("CHECKOUT SUCCESS!")
            else:
                print(f"  ERROR: {r.text[:300]}")
        else:
            print(f"  ERROR: {r.text[:300]}")

# ===== CHECK KARDEX (stock movements) =====
print("\n=== CHECK KARDEX (stock movements) ===")
import psycopg2
conn = psycopg2.connect(host="db_qa", port=5432, database="invensoft_qa", user="postgres", password="postgres")
cur = conn.cursor()

# Check kardex for Pollo Entero (ingredient)
cur.execute("""
    SELECT k.id, k.movement_type, k.quantity, k.reference
    FROM restaurante.kardex k
    WHERE k.product_id = 2
    ORDER BY k.id DESC
    LIMIT 5
""")
rows = cur.fetchall()
print(f"Kardex entries for Pollo Entero (id=2): {len(rows)}")
for r in rows:
    print(f"  - id={r[0]}, type={r[1]}, qty={r[2]}, ref={r[3]}")

# Check sales
cur.execute("SELECT COUNT(*) FROM restaurante.sales")
print(f"Sales: {cur.fetchone()[0]}")

# Check order items
cur.execute("SELECT COUNT(*) FROM restaurante.restaurant_order_items")
print(f"Order items: {cur.fetchone()[0]}")

conn.close()

print("\n=== DONE ===")