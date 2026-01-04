import requests
import time

API_URL = "http://localhost:8000/api/v1"

def verify_backend_logic():
    print("🚀 [TEST] Verificando Lógica de Fallback de Margen en Backend...")
    
    try:
        # 0. Autenticación (Login)
        print("🔑 Iniciando sesión como admin...")
        login_data = {"username": "admin", "password": "admin123"}
        
        # Endpoint es /auth/token (OAuth2 spec)
        r_login = requests.post(f"{API_URL}/auth/token", data=login_data)
        
        if r_login.status_code != 200:
             # Fallback try "admin" / "admin"
             print("⚠️ Login 'admin123' falló, probando 'admin'...")
             r_login = requests.post(f"{API_URL}/auth/token", data={"username": "admin", "password": "admin"})
        
        if r_login.status_code != 200:
            print(f"❌ Error Login: {r_login.text}")
            return
            
        token = r_login.json()['access_token']
        headers = {"Authorization": f"Bearer {token}"}
        print("✅ Login exitoso.")

        # 1. Obtener o Crear Proveedor (Safeguard)
        sup_resp = requests.get(f"{API_URL}/suppliers", headers=headers)
        suppliers = sup_resp.json()
        
        supplier_id = None
        if isinstance(suppliers, list) and len(suppliers) > 0:
            supplier_id = suppliers[0]['id']
        else:
            print(f"⚠️ No hay proveedores o respuesta invalida: {suppliers}. Creando uno...")
            new_sup = {"name": f"ProvFallback_{int(time.time())}", "contact_person": "Test"}
            r_sup = requests.post(f"{API_URL}/suppliers", json=new_sup, headers=headers)
            if r_sup.status_code == 200:
                supplier_id = r_sup.json()['id']
            else:
                print(f"❌ Imposible crear proveedor: {r_sup.text}")
                return

        if not supplier_id:
             print("❌ No se pudo obtener ID de proveedor")
             return
        
        # 2. Crear Producto Base
        # Costo 10, Precio 13 (Margen 30%)
        prod_payload = {
            "name": f"Test_Fallback_{int(time.time())}",
            "price": 13.00,
            "cost_price": 10.00,
            "stock": 0, 
            "profit_margin": 30.00, 
            "tax_rate": 0,
            "category_id": None, 
            "supplier_id": supplier_id
        }
        
        r_prod = requests.post(f"{API_URL}/products", json=prod_payload, headers=headers)
        if r_prod.status_code != 200:
            print(f"❌ Error creando producto: {r_prod.text}")
            return
            
        product = r_prod.json()
        pid = product['id']
        print(f"✅ Producto Base Creado: ID {pid} | Costo: {product['cost_price']} | Precio: {product['price']}")
        
        # 3. Simular Compra con Update Price = True pero SIN precio
        purchase_payload = {
            "supplier_id": supplier_id,
            "warehouse_id": 1,
            "total_amount": 200,
            "total_amount_bs": 200,
            "payment_type": "CREDIT",
            "invoice_number": "TEST-001",
            "currency": "USD",
            "exchange_rate": 1.0,
            "items": [
                {
                    "product_id": pid,
                    "quantity": 10,
                    "unit_cost": 20.00,
                    "update_cost": True,
                    "update_price": True,
                    "new_sale_price": None
                }
            ]
        }
        
        print(f"🛒 Realizando Compra (Costo sube a 20, new_sale_price=None)...")
        r_purch = requests.post(f"{API_URL}/purchases", json=purchase_payload, headers=headers)
        
        if r_purch.status_code != 200:
             print(f"❌ Error en compra: {r_purch.text}")
             return
             
        # 4. Verificar Resultado
        r_check = requests.get(f"{API_URL}/products/{pid}", headers=headers)
        final_prod = r_check.json()
        
        final_price = float(final_prod['price'])
        expected_price = 26.00
        
        print(f"📊 Resultado Final: Precio {final_price}")
        
        if abs(final_price - expected_price) < 0.1:
            print("✅ PASS: El sistema recalculó correctamente el precio usando el margen histórico.")
        else:
            print(f"❌ FAIL: Precio esperado {expected_price}, obtenido {final_price}")
            
    except Exception as e:
        print(f"❌ Excepción: {e}")

if __name__ == "__main__":
    verify_backend_logic()
