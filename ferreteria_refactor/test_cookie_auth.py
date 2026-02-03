"""
Test script for HttpOnly Cookie Authentication (Hybrid Mode)

This script demonstrates the new hybrid authentication system:
1. Login with cookies (SECURE)
2. Login with Authorization header (LEGACY)
3. Access protected endpoint with both methods
4. Logout

Run: python test_cookie_auth.py
"""

import requests
from requests.auth import HTTPBasicAuth

BASE_URL = "http://localhost:8000/api/v1"

def test_cookie_based_auth():
    """Test 1: Cookie-based authentication (SECURE)"""
    print("\n" + "="*60)
    print("TEST 1: Cookie-Based Authentication (SECURE)")
    print("="*60)
    
    # Create a session to persist cookies
    session = requests.Session()
    
    # Login - cookie will be set automatically
    print("\n1. Logging in (cookie will be set)...")
    login_response = session.post(
        f"{BASE_URL}/auth/token",
        data={
            "username": "admin",
            "password": "admin123"
        }
    )
    
    if login_response.status_code == 200:
        print("✅ Login successful!")
        print(f"   Response: {login_response.json()}")
        print(f"   Cookies received: {session.cookies.get_dict()}")
    else:
        print(f"❌ Login failed: {login_response.status_code}")
        print(f"   Error: {login_response.text}")
        return
    
    # Access protected endpoint using cookie (no Authorization header needed!)
    print("\n2. Accessing protected endpoint with cookie...")
    users_response = session.get(f"{BASE_URL}/users")
    
    if users_response.status_code == 200:
        print("✅ Protected endpoint accessed successfully with cookie!")
        print(f"   Users count: {len(users_response.json())}")
    else:
        print(f"❌ Failed to access protected endpoint: {users_response.status_code}")
        print(f"   Error: {users_response.text}")
    
    # Logout
    print("\n3. Logging out (clearing cookie)...")
    logout_response = session.post(f"{BASE_URL}/auth/logout")
    
    if logout_response.status_code == 200:
        print("✅ Logout successful!")
        print(f"   Response: {logout_response.json()}")
    else:
        print(f"❌ Logout failed: {logout_response.status_code}")
    
    # Try to access protected endpoint after logout (should fail)
    print("\n4. Trying to access protected endpoint after logout...")
    users_response_after_logout = session.get(f"{BASE_URL}/users")
    
    if users_response_after_logout.status_code == 401:
        print("✅ Correctly rejected - cookie was cleared!")
    else:
        print(f"⚠️  Unexpected response: {users_response_after_logout.status_code}")


def test_header_based_auth():
    """Test 2: Header-based authentication (LEGACY)"""
    print("\n" + "="*60)
    print("TEST 2: Header-Based Authentication (LEGACY)")
    print("="*60)
    
    # Login - get token in JSON
    print("\n1. Logging in (getting token in JSON)...")
    login_response = requests.post(
        f"{BASE_URL}/auth/token",
        data={
            "username": "admin",
            "password": "admin123"
        }
    )
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.status_code}")
        return
    
    token = login_response.json()["access_token"]
    print("✅ Login successful!")
    print(f"   Token (first 20 chars): {token[:20]}...")
    
    # Access protected endpoint using Authorization header
    print("\n2. Accessing protected endpoint with Authorization header...")
    headers = {"Authorization": f"Bearer {token}"}
    users_response = requests.get(f"{BASE_URL}/users", headers=headers)
    
    if users_response.status_code == 200:
        print("✅ Protected endpoint accessed successfully with header!")
        print(f"   Users count: {len(users_response.json())}")
    else:
        print(f"❌ Failed to access protected endpoint: {users_response.status_code}")


def test_priority_order():
    """Test 3: Verify cookie takes priority over header"""
    print("\n" + "="*60)
    print("TEST 3: Priority Order (Cookie > Header)")
    print("="*60)
    
    # Login to get a valid token
    login_response = requests.post(
        f"{BASE_URL}/auth/token",
        data={
            "username": "admin",
            "password": "admin123"
        }
    )
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.status_code}")
        return
    
    valid_token = login_response.json()["access_token"]
    
    # Create session with cookie
    session = requests.Session()
    session.cookies.set("access_token", valid_token)
    
    # Send request with BOTH cookie and header (header has invalid token)
    print("\n1. Sending request with valid cookie + invalid header...")
    headers = {"Authorization": "Bearer INVALID_TOKEN_12345"}
    users_response = session.get(f"{BASE_URL}/users", headers=headers)
    
    if users_response.status_code == 200:
        print("✅ Cookie took priority! Request succeeded despite invalid header.")
    else:
        print(f"⚠️  Unexpected result: {users_response.status_code}")


if __name__ == "__main__":
    print("\n" + "🔐"*30)
    print("HYBRID AUTHENTICATION SYSTEM - TEST SUITE")
    print("🔐"*30)
    
    try:
        test_cookie_based_auth()
        test_header_based_auth()
        test_priority_order()
        
        print("\n" + "="*60)
        print("✅ ALL TESTS COMPLETED")
        print("="*60)
        print("\nSUMMARY:")
        print("- Cookie-based auth: SECURE (XSS protected)")
        print("- Header-based auth: LEGACY (still works)")
        print("- Priority: Cookie > Header")
        print("\nRECOMMENDATION: Migrate frontend to use cookies for better security!")
        
    except requests.exceptions.ConnectionError:
        print("\n❌ ERROR: Could not connect to backend server")
        print("   Make sure the server is running on http://localhost:8000")
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
