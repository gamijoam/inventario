#!/usr/bin/env python3
import requests
import urllib3
import json

urllib3.disable_warnings()

BASE = 'https://api-qa.miinventariofacil.com/api/v1'
s = requests.Session()

print("=== CHECK DEBUG SEED ===")
r = s.get(f'{BASE}/config/debug/seed', verify=False)
print(f"Status: {r.status_code}")
print(r.text[:500])

print("\n=== TRY RESET PASSWORD FLOW ===")
r = s.post(f'{BASE}/auth/forgot-password',
    json={"email": "restaurante@gmail.com"},
    verify=False)
print(f"Status: {r.status_code}")
print(r.text[:500])