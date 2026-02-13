import requests
import sys

def test_discovery(email):
    url = "http://localhost:8000/api/v1/auth/discovery"
    print(f"🔍 Testing discovery for: {email}")
    
    try:
        response = requests.post(url, json={"email": email})
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Success: {data}")
        elif response.status_code == 404:
            print(f"❌ Not Found: {response.json().get('detail')}")
        else:
            print(f"❓ Unexpected status {response.status_code}: {response.text}")
    except Exception as e:
        print(f"🔥 Error: {e}")

if __name__ == "__main__":
    # Test with a known email or from args
    test_email = sys.argv[1] if len(sys.argv) > 1 else "admin@system.local" # Default created by init_admin_user
    test_discovery(test_email)
