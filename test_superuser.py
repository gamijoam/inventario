#!/usr/bin/env python3
import requests
import urllib3
import json
from urllib.parse import urlencode

urllib3.disable_warnings()

BASE = 'https://api-qa.miinventariofacil.com/api/v1'

# Login as superuser first
print("=== LOGIN SUPERUSER ===")
data = urlencode({'username': 'rodriguezisaac876@gmail.com', 'password': 'Isaac*2025'})
r = requests.post(f'{BASE}/auth/token',
    data=data,
    headers={
        'X-Tenant-ID': 'public',
        'Content-Type': 'application/x-www-form-urlencoded',
    }, verify=False)
print(f"Status: {r.status_code}")
if r.status_code == 200:
    token = r.json().get('access_token')
    print(f"Token: {token[:50]}...")

    # Now try to access the tenant data with this token
    print("\n=== ACCESS RESTAURANTE TENANT ===")
    r2 = requests.get(f'{BASE}/config/public',
        headers={
            'X-Tenant-ID': 'restaurante',
            'Authorization': f'Bearer {token}'
        }, verify=False)
    print(f"Status: {r2.status_code}")
else:
    print(f"FAILED: {r.text[:200]}")