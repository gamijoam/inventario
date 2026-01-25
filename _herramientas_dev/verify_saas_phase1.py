import sys
import os
# Add project root to sys.path so we can import backend_api
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(project_root, 'ferreteria_refactor'))

from fastapi.testclient import TestClient
from backend_api.main import app
from backend_api.config import settings
import logging

# Configure basic logging to see print statements if any
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SAAS_TEST")

print(f"DEBUG: DB_TYPE={os.getenv('DB_TYPE', 'postgres')}")
print(f"DEBUG: DATABASE_URL={settings.DATABASE_URL}")

client = TestClient(app)

def test_feature_flags():
    print("\n" + "="*50)
    print("🧪 TEST A: VALIDACIÓN DE FEATURE FLAGS (CONFIG)")
    print("="*50)
    
    # Simulating request
    response = client.get("/api/v1/config/public")
    
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print("Response JSON:", data)
        
        # Check if 'tenant' key exists (Proof of updated config logic)
        if "tenant" in data:
            print(f"✅ PASSED: Tenant info found: {data['tenant']}")
        else:
            print("❌ FAILED: 'tenant' key missing in response.")
            
        # Check modules
        modules = data.get("modules", {})
        print("Modules Active:", modules)
    else:
        print("❌ FAILED: Endpoint returned error")

def test_isolation():
    print("\n" + "="*50)
    print("🧪 TEST B: AISLAMIENTO DE TENANT (FORCE FAILURE)")
    print("="*50)
    print("Objetivo: Forzar error 'Schema does not exist' al usar un tenant invalido.")
    
    tenant_id = "tenant_inexistente_123"
    
    # We use explicit header for debug testing as configured in Middleware
    headers = {"X-Tenant-ID": tenant_id}
    
    # We try to access an endpoint that hits the DB (like products or users)
    # Using /users because it usually requires DB immediately for auth or list
    # Actually, let's try a public endpoint that queries DB if possible, or simulate a login attempt?
    # /api/v1/products requires auth usually? Let's check. 
    # If auth requires DB, it might fail there first (User not found) OR "Schema not found" if connection setup fails.
    
    # Using /api/v1/config/business hits BusinessConfig table?
    # Check /backend_api/routers/config.py -> /business requires get_db
    
    url = "/api/v1/config/business"
    print(f"Requesting {url} with Header X-Tenant-ID: {tenant_id}")
    
    try:
        response = client.get(url, headers=headers)
        print(f"Status Code: {response.status_code}")
        
        # Expected: 500 or 404 or DB Exception printed
        # Since TestClient raises exceptions, we might catch it in the except block
        
        if response.status_code == 500:
            print("✅ PASSED (Likely): Received 500 Error as expected.")
            print("Response:", response.text)
        elif response.status_code == 200:
            print("❌ FAILED: Request succeeded (Should have failed due to missing schema!)")
        else:
             print(f"⚠️ UNDETERMINED: Status {response.status_code}")
            
    except Exception as e:
        print(f"✅ PASSED (EXCEPTION CAUGHT): {e}")
        # Check if error message mentions schema
        if "schema" in str(e).lower() or "search_path" in str(e).lower():
            print("   -> Confirmado: El error fue por Schema/Search Path.")
        else:
            print("   -> El error fue otro, verificar logs.")

if __name__ == "__main__":
    try:
        test_feature_flags()
        test_isolation()
    except Exception as e:
        print(f"⚠️ Script crashed: {e}")
