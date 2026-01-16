import requests
import json

BASE_URL = "http://127.0.0.1:8000"

def check_api():
    # 1. Login
    login_payload = {
        "username": "admin",
        "password": "admin123" # Correct default credentials
    }
    
    try:
        print(f"Logging in as {login_payload['username']}...")
        # Correct URL: /api/v1/users/login
        r = requests.post(f"{BASE_URL}/api/v1/users/login", json=login_payload)
        
        if r.status_code != 200:
            print(f"Login failed: {r.status_code} {r.text}")
            return

        token = r.json().get('access_token')
        print("Login success. Token acquired.")

        # 2. Get Users
        headers = {"Authorization": f"Bearer {token}"}
        print("Fetching users...")
        # Correct URL: /api/v1/users
        r = requests.get(f"{BASE_URL}/api/v1/users", headers=headers)
        
        if r.status_code != 200:
            print(f"Get Users failed: {r.status_code} {r.text}")
            return
            
        users = r.json()
        print(f"Found {len(users)} users.")
        
        # 3. Find admin and check preferences
        admin = next((u for u in users if u['username'] == 'admin'), None)
        if admin:
            print("\nAdmin User Data:")
            print(json.dumps(admin, indent=2))
            
            if 'preferences' in admin:
                print("\n[SUCCESS] 'preferences' field FOUND.")
                print(f"Value: {admin['preferences']}")
            else:
                print("\n[FAILURE] 'preferences' field MISSING in response.")
        else:
            print("Admin user not found in list??")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_api()
