import requests
import time

API_URL = "http://localhost:8000/api/v1"

def verify_last_cost_strategy():
    print("🚀 [TEST] Verificando Estrategia de 'Último Costo' (Replacement Cost)...")
    
    try:
        # 0. Auth
        print("🔑 Login admin...")
        login_data = {"username": "admin", "password": "admin123"}
        r_login = requests.post(f"{API_URL}/auth/token", data=login_data)
        if r_login.status_code != 200:
             # Fallback
             r_login = requests.post(f"{API_URL}/auth/token", data={"username": "admin", "password": "admin"})
        
        if r_login.status_code != 200:
            print("❌ Login failed")
            return
            
        headers = {"Authorization": f"Bearer {r_login.json()['access_token']}"}

        # 1. Supplier
        sup_resp = requests.get(f"{API_URL}/suppliers", headers=headers)
        suppliers = sup_resp.json()
        supplier_id = suppliers[0]['id'] if suppliers else None
        
        if not supplier_id:
             print("⚠️ Creando proveedor temporal...")
             new_sup = {"name": f"P_{int(time.time())}", "contact_person": "T"}
             r_s = requests.post(f"{API_URL}/suppliers", json=new_sup, headers=headers)
             supplier_id = r_s.json()['id']

        # 2. PRODUCTO BASE (Stock ALTO para forzar promedio si estuviera activo)
        # Costo: 10. Stock: 100.
        # Valor Total: 1000.
        prod_payload = {
            "name": f"Test_LastCost_{int(time.time())}",
            "price": 15.00,
            "cost_price": 10.00,
            "stock": 100, 
            "profit_margin": 50.00, 
            "tax_rate": 0,
            "supplier_id": supplier_id
        }
        
        r_prod = requests.post(f"{API_URL}/products", json=prod_payload, headers=headers)
        pid = r_prod.json()['id']
        print(f"✅ Prod ID {pid}: Costo $10 | Stock 100")
        
        # 3. COMPRA NUEVA
        # Cantidad: 10. Costo Nuevo: 20.
        # SI FUERA PROMEDIO: (100*10 + 10*20) / 110 = (1000+200)/110 = 10.90
        # SI ES ULTIMO COSTO: 20.00
        purchase_payload = {
            "supplier_id": supplier_id,
            "warehouse_id": 1,
            "total_amount": 200,
            "total_amount_bs": 200,
            "payment_type": "CASH",
            "invoice_number": f"INV-{int(time.time())}",
            "currency": "USD",
            "exchange_rate": 1.0,
            "items": [
                {
                    "product_id": pid,
                    "quantity": 10,
                    "unit_cost": 20.00,
                    "update_cost": True,
                    "update_price": False, # Keep old price to check only cost logic
                    "new_sale_price": None
                }
            ]
        }
        
        print(f"🛒 Comprando 10 items a Costo $20...")
        r_purch = requests.post(f"{API_URL}/purchases", json=purchase_payload, headers=headers)
        
        if r_purch.status_code != 200:
            print(f"❌ Error Compra: {r_purch.text}")
            return

        # 4. VERIFICACION
        r_check = requests.get(f"{API_URL}/products/{pid}", headers=headers)
        final_cost = float(r_check.json()['cost_price'])
        
        print(f"📊 Costo Final en DB: ${final_cost}")
        
        if abs(final_cost - 20.00) < 0.01:
            print("✅ PASS: El sistema actualizó al ÚLTIMO COSTO ($20).")
        elif abs(final_cost - 10.90) < 0.1:
            print("❌ FAIL: El sistema sigue usando PROMEDIO PONDERADO (~$10.90).")
        else:
            print(f"❌ FAIL: Resultado inesperado {final_cost}")

    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    verify_last_cost_strategy()
