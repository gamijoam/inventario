import sys
import os
import requests
from backend_api.models import models
from backend_api.database.db import SessionLocal, engine

# Force using the LOCAL test DB we just verified is reachable
BASE_URL = "http://localhost:8000/api/v1"

def test_empty_reports():
    print("--- TESTING REPORTS ON CURRENT DB ---")
    
    # 1. Login to get token
    print("Logging in...")
    try:
        resp = requests.post(f"{BASE_URL}/auth/token", data={"username": "admin", "password": "123"})
        if resp.status_code != 200:
             # Try fallback
             resp = requests.post(f"{BASE_URL}/auth/token", data={"username": "admin", "password": "admin123"})
        
        if resp.status_code != 200:
            print(f"Login failed: {resp.text}")
            return
            
        token = resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("Login successful.")
    except Exception as e:
        print(f"Connection failed: {e}")
        return

    # 2. Test the specific failing endpoints
    endpoints = [
        "/reports/sales/summary?start_date=2026-01-03&end_date=2026-01-03",
        "/reports/profit/sales?start_date=2026-01-03&end_date=2026-01-03",
        "/products/sales/?limit=10&sort=date&order=desc",
        "/reports/low-stock?threshold=5"
    ]
    
    for ep in endpoints:
        print(f"\nTesting: {ep}")
        try:
            r = requests.get(f"{BASE_URL}{ep}", headers=headers)
            print(f"Status: {r.status_code}")
            if r.status_code == 500:
                print(f"❌ 500 ERROR DETECTED")
                with open("last_error.txt", "w", encoding="utf-8") as f:
                    f.write(r.text)
                print("Error details saved to last_error.txt")
            else:
                print("✅ OK")
        except Exception as e:
            print(f"Request Error: {e}")

if __name__ == "__main__":
    test_empty_reports()
