import requests
import time

API_URL = "http://localhost:8000/api/v1"

def verify_margin_fix():
    print("🚀 [TEST] Verificando FIX de Margen Recurrente (Negative Margin Bug)...")
    
    try:
        # 0. Auth
        print("🔑 Login admin...")
        login_data = {"username": "admin", "password": "admin123"}
        r_login = requests.post(f"{API_URL}/auth/token", data=login_data)
        if r_login.status_code != 200:
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
             new_sup = {"name": f"P_Fix_{int(time.time())}", "contact_person": "T"}
             r_s = requests.post(f"{API_URL}/suppliers", json=new_sup, headers=headers)
             supplier_id = r_s.json()['id']

        # 2. PRODUCTO BASE
        # Costo: 10. Precio: 13. (Margen 30%).
        prod_payload = {
            "name": f"Test_MarginFix_{int(time.time())}",
            "price": 13.00,
            "cost_price": 10.00,
            "stock": 0, 
            "profit_margin": 30.00, 
            "tax_rate": 0,
            "supplier_id": supplier_id
        }
        r_prod = requests.post(f"{API_URL}/products", json=prod_payload, headers=headers)
        pid = r_prod.json()['id']
        print(f"✅ [INIT] Prod ID {pid}: Costo 10 | Precio 13 | Margen 30%")

        # 3. COMPRA 1: Costo sube a 12. Update Price=True (Calculado por UI).
        # Simulamos que UI manda el precio correcto: 12 * 1.3 = 15.6
        p1_payload = {
            "supplier_id": supplier_id, "warehouse_id": 1, 
            "total_amount": 100, "total_amount_bs": 100, "payment_type": "CASH", 
            "invoice_number": f"INV1-{pid}", "currency": "USD", "exchange_rate": 1.0,
            "items": [{
                "product_id": pid, "quantity": 10, "unit_cost": 12.00,
                "update_cost": True, "update_price": True, "new_sale_price": 15.60
            }]
        }
        r_p1 = requests.post(f"{API_URL}/purchases", json=p1_payload, headers=headers)
        if r_p1.status_code != 200: print(f"❌ P1 Fail: {r_p1.text}"); return

        # Check State 1
        r_check1 = requests.get(f"{API_URL}/products/{pid}", headers=headers).json()
        print(f"📊 [POST P1] Costo {r_check1['cost_price']} (Esp: 12.0) | Precio {r_check1['price']} (Esp: 15.6)")

        # 4. COMPRA 2: Costo sube a 20. Update Price=True pero SIN VALOR (Simulando olvido o UI fail).
        # EL BUG ESTABA AQUI:
        # El sistema tomaba Costo Nuevo (20) y Precio Viejo (15.6) -> Margen Negativo.
        # CON EL FIX:
        # El sistema debe tomar Costo Viejo (12) y Precio Viejo (15.6) -> Margen 30%.
        # Y aplicar 30% a Costo Nuevo (20) -> Precio 26.
        p2_payload = {
            "supplier_id": supplier_id, "warehouse_id": 1, 
            "total_amount": 100, "total_amount_bs": 100, "payment_type": "CASH", 
            "invoice_number": f"INV2-{pid}", "currency": "USD", "exchange_rate": 1.0,
            "items": [{
                "product_id": pid, "quantity": 10, "unit_cost": 20.00,
                "update_cost": True, "update_price": True, "new_sale_price": None # Fallback trigger
            }]
        }
        print("🛒 Ejecutando Compra 2 (Trigger Fallback)...")
        r_p2 = requests.post(f"{API_URL}/purchases", json=p2_payload, headers=headers)
        if r_p2.status_code != 200: print(f"❌ P2 Fail: {r_p2.text}"); return

        # 5. VERIFICACION FINAL
        r_final = requests.get(f"{API_URL}/products/{pid}", headers=headers).json()
        final_price = float(r_final['price'])
        final_margin = float(r_final['profit_margin'])
        
        print(f"📊 [FINAL] Precio {final_price} | Margen {final_margin}%")
        
        if abs(final_price - 26.00) < 0.1:
            print("✅ PASS: El precio subió a 26.00 (Mantuvo margen 30%). Bug Solucionado.")
        else:
            print(f"❌ FAIL: Precio esperado 26.00, obtenido {final_price}. El Bug persiste.")

    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    verify_margin_fix()
