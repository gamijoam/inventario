"""
Test script to verify authentication endpoint is working
"""
import requests

BASE_URL = "http://localhost:8000"

print("\n" + "="*60)
print("TESTING AUTHENTICATION ENDPOINT")
print("="*60 + "\n")

# Test 1: Check if endpoint exists
print("1. Testing endpoint: POST /api/v1/auth/token")
try:
    response = requests.post(
        f"{BASE_URL}/api/v1/auth/token",
        data={
            "username": "admin",
            "password": "admin123"
        },
        headers={
            "Content-Type": "application/x-www-form-urlencoded"
        }
    )
    
    print(f"   Status Code: {response.status_code}")
    
    if response.status_code == 200:
        print("   ✅ SUCCESS! Endpoint is working")
        data = response.json()
        print(f"   Token received: {data.get('access_token', 'N/A')[:30]}...")
    else:
        print(f"   ❌ FAILED: {response.status_code}")
        print(f"   Response: {response.text}")
        
except Exception as e:
    print(f"   ❌ ERROR: {e}")

# Test 2: Check OpenAPI schema
print("\n2. Checking OpenAPI schema for tokenUrl...")
try:
    response = requests.get(f"{BASE_URL}/openapi.json")
    if response.status_code == 200:
        openapi = response.json()
        
        # Check security schemes
        if "components" in openapi and "securitySchemes" in openapi["components"]:
            schemes = openapi["components"]["securitySchemes"]
            print(f"   Security schemes found: {list(schemes.keys())}")
            
            for name, scheme in schemes.items():
                if scheme.get("type") == "oauth2":
                    flows = scheme.get("flows", {})
                    if "password" in flows:
                        token_url = flows["password"].get("tokenUrl")
                        print(f"   OAuth2 tokenUrl in schema: {token_url}")
                        
                        if token_url == "/api/v1/auth/token":
                            print("   ✅ tokenUrl is CORRECT in OpenAPI schema")
                        else:
                            print(f"   ⚠️  tokenUrl mismatch! Expected: /api/v1/auth/token")
        else:
            print("   ⚠️  No security schemes found in OpenAPI schema")
    else:
        print(f"   ❌ Failed to get OpenAPI schema: {response.status_code}")
        
except Exception as e:
    print(f"   ❌ ERROR: {e}")

print("\n" + "="*60)
print("TEST COMPLETED")
print("="*60 + "\n")
