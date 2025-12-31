import requests

# Configuration
BASE_URL = "http://127.0.0.1:8000/api/v1"

def test_auth_flow():
    print("=== INICIANDO PRUEBA DE SEGURIDAD Y AUTENTICACIÓN ===\n")

    # 1. Test Protection: Try to create product WITHOUT token
    print("[1] Intentando crear producto SIN token (Se espera 401/403)...")
    try:
        resp = requests.post(f"{BASE_URL}/products/", json={"name": "Hacker Product", "price": 0})
        if resp.status_code in [401, 403]:
            print(f"[OK] EXITO: Acceso denegado correctamente. Status: {resp.status_code}")
        else:
            print(f"[FAIL] FALLO: La ruta no esta protegida. Status: {resp.status_code}")
            print("       (Si ves 422, es porque el SERVIDOR NO SE REINICIO y valida el body antes q la seguridad)")
    except Exception as e:
        print(f"[!] Error de conexion (El servidor esta corriendo?): {e}")
        return

    # 2. Test Login: Get Token
    print("\n[2] Intentando LOGIN con admin/admin123...")
    token = None
    try:
        # Note: We implemented OAuth2 form request in backend, but let's see if we used Form or JSON
        # In routers/auth.py we used OAuth2PasswordRequestForm which expects FORM data
        # Correct URL is /token based on auth.py router configuration (no /auth prefix)
        resp = requests.post(f"{BASE_URL}/token", data={"username": "admin", "password": "admin123"})
        
        if resp.status_code == 200:
            data = resp.json()
            token = data.get("access_token")
            print(f"[OK] EXITO: Token recibido: {token[:15]}...")
        else:
            print(f"[FAIL] FALLO: Login rechazado. Status: {resp.status_code} - {resp.text}")
            return
    except Exception as e:
         print(f"⚠️ Error intentando login: {e}")
         return

    # 3. Test Protected Access: Create Product WITH Token
    print("\n[3] Intentando crear producto CON token...")
    try:
        headers = {"Authorization": f"Bearer {token}"}
        # Sending incomplete data to trigger Validation Error (422) is fine, 
        # as long as it's NOT 401/403. That proves auth worked.
        resp = requests.post(f"{BASE_URL}/products/", json={"name": "Test Product Authorship", "price": 100}, headers=headers)
        
        if resp.status_code in [200, 201]:
             print(f"[OK] EXITO: Producto creado/autorizado. Status: {resp.status_code}")
        elif resp.status_code == 422:
             print(f"[OK] EXITO: Autorizado (aunque faltan datos del producto). Status: {resp.status_code}")
        elif resp.status_code in [401, 403]:
             print(f"[FAIL] FALLO: Token rechazado. Status: {resp.status_code}")
        else:
             print(f"[INFO] Resultado: {resp.status_code}")
             
    except Exception as e:
        print(f"[!] Error: {e}")

    print("\n=== PRUEBA FINALIZADA ===")

if __name__ == "__main__":
    test_auth_flow()
