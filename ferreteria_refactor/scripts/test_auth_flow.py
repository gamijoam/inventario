import requests
import sys

# Base URL for local development
BASE_URL = "http://localhost:8000/api/v1"

def test_auth_flow():
    print("🚀 Starting Authentication Flow Test...")
    
    # 1. Emergency Password Fix (CRITICAL: Also sets tenant_id=None)
    print("\n[1] Running Emergency Password Fix...")
    try:
        # Try specific email first
        resp = requests.get(f"{BASE_URL}/auth/fix_password_emergency?email=rodriguezisaac876@gmail.com")
        if resp.status_code == 200:
            print("   ✅ Emergency Fix Success:", resp.json())
        else:
            print("   ⚠️ Emergency Fix Warning (User might not exist with that email):", resp.text)
            
            # Try default admin
            resp = requests.get(f"{BASE_URL}/auth/fix_password_emergency?email=admin@system.local")
            if resp.status_code == 200:
                print("   ✅ Emergency Fix Success (Default Admin):", resp.json())
    except Exception as e:
        print(f"   ❌ Failed to contact backend: {e}")
        return

    # 2. Login with Credentials
    print("\n[2] Testing Login with Credentials (admin123)...")
    login_data = {
        "username": "rodriguezisaac876@gmail.com", # Or admin@system.local, trying both
        "password": "admin123"
    }
    
    try:
        resp = requests.post(f"{BASE_URL}/auth/token", data=login_data)
        if resp.status_code == 200:
            token = resp.json().get("access_token")
            print(f"   ✅ Login Success! Token: {token[:20]}...")
            
            # 3. Verify Token Access (e.g., /users/me)
            headers = {"Authorization": f"Bearer {token}"}
            me_resp = requests.get(f"{BASE_URL}/users/me", headers=headers)
            if me_resp.status_code == 200:
                user = me_resp.json()
                print(f"   ✅ Token Valid. User: {user.get('email')} (Tenant: {user.get('tenant_id')})")
            else:
                print(f"   ❌ Token Invalid for /users/me: {me_resp.status_code}")
        else:
            print(f"   ❌ Login Failed: {resp.status_code} - {resp.text}")
            
            # Try admin user fallback
            login_data["username"] = "admin@system.local"
            resp = requests.post(f"{BASE_URL}/auth/token", data=login_data)
            if resp.status_code == 200:
                print("   ✅ Login Success with admin@system.local")
            else:
                 print(f"   ❌ Login Failed (admin fallback): {resp.status_code}")

    except Exception as e:
        print(f"   ❌ Login Exception: {e}")

if __name__ == "__main__":
    test_auth_flow()
