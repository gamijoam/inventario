import sys
import os
import requests

BASE_URL = "http://127.0.0.1:8000/api/v1"

def test_warranty_endpoints():
    print("🚀 Testing Warranty Endpoints...")
    
    # 1. Check if router is registered
    try:
        resp = requests.get(f"{BASE_URL}/debug/routes")
        if resp.status_code == 200:
            routes = resp.json().get("routes", [])
            warranty_routes = [r for r in routes if "/warranties" in r["path"]]
            if warranty_routes:
                print(f"   ✅ Warranty Router Registered ({len(warranty_routes)} routes found)")
            else:
                print("   ❌ Warranty Router NOT found in debug/routes")
        else:
            print(f"   ⚠️ Could not fetch debug routes: {resp.status_code}")
    except Exception as e:
        print(f"   ❌ Connection Error: {e}")
        return

    # 2. Try to list policies (Auth required)
    # We need a token. Let's assume the user has one or we use admin credentials.
    # For now, just hitting the endpoint to check 401 vs 404 is enough to prove it exists.
    
    print("\n[2] Checking /warranties/policies existence...")
    resp = requests.get(f"{BASE_URL}/warranties/policies")
    if resp.status_code == 401:
        print("   ✅ Endpoint exists and is protected (401 Unauthorized)")
    elif resp.status_code == 200:
        print("   ✅ Endpoint exists and is open (200 OK)")
    elif resp.status_code == 404:
        print("   ❌ Endpoint NOT found (404)")
    else:
        print(f"   ❓ Unexpected status: {resp.status_code}")

if __name__ == "__main__":
    test_warranty_endpoints()
