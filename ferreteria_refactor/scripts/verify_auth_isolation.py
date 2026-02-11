
import sys
import os
import requests

# This script assumes the server is running on localhost:8000
BASE_URL = "http://localhost:8000"

def test_login(username, password, host_header, context_name):
    print(f"🔒 Testing Login: {username} on {context_name} ({host_header})...")
    
    headers = {"Host": host_header}
    data = {
        "username": username,
        "password": password
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/v1/auth/token", data=data, headers=headers)
        
        if response.status_code == 200:
            print(f"   ✅ ALLOWED (200 OK)")
            return True
        elif response.status_code == 401:
            print(f"   🛡️ BLOCKED (401 Unauthorized)")
            return False
        else:
            print(f"   ⚠️ Unexpected Status: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ❌ Connection Error: {e}")
        return False

if __name__ == "__main__":
    print("--- 🔐 AUTH ISOLATION TEST ---")
    
    # 1. Public Admin on Public Domain (Should ALLOW)
    # Assumes 'adminn' / 'admin123' exists (found in DB check)
    res1 = test_login("adminn", "admin123", "localhost:8000", "Public Context")
    
    # 2. Public Admin on Tenant Domain (Should BLOCK)
    # Using 'prueba3.localhost' as example tenant
    res2 = test_login("adminn", "admin123", "prueba3.localhost:8000", "Tenant Context")
    
    print("\n--- RESULTS ---")
    if res1 and not res2:
        print("✅ SUCCESS: Isolation is working correctly.")
        print("   - Public Admin allowed on Public.")
        print("   - Public Admin BLOCKED on Tenant.")
    else:
        print("❌ FAILURE: Isolation rules not met.")
