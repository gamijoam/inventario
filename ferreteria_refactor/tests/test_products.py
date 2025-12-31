import requests

try:
    print("Requesting products...")
    r = requests.get("http://127.0.0.1:8000/api/v1/products/")
    print(f"Status: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        print(f"Success. Loaded {len(data)} products.")
        if len(data) > 0:
            print("Sample:", data[0])
    else:
        print(f"Error: {r.text}")
except Exception as e:
    print(f"Exception: {e}")
