#!/usr/bin/env python3
import requests
import urllib3
import json
from urllib.parse import urlencode

urllib3.disable_warnings()

BASE = 'https://api-qa.miinventariofacil.com/api/v1'
TENANT = 'restaurante'

s = requests.Session()

# Try different username formats
users_to_try = [
    ('restaurante@gmail.com', 'admin123'),
    ('admin', 'admin123'),
    ('restaurante', 'admin123'),
    ('restaurante@gmail.com', 'Restaurante123!'),
    ('restaurante@gmail.com', 'Restaurante123'),
]

for username, password in users_to_try:
    print(f"\n=== TRY: {username} / {password} ===")
    data = urlencode({'username': username, 'password': password})
    login = s.post(f'{BASE}/auth/token',
        data=data,
        headers={
            'X-Tenant-ID': TENANT,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Origin': f'https://{TENANT}.qa.miinventariofacil.com'
        }, verify=False)
    print(f"LOGIN: {login.status_code}")
    if login.status_code == 200:
        print(f"SUCCESS!")
        token = login.json().get('access_token')
        print(f"Token: {token[:50] if token else 'None'}...")
        break
    else:
        print(f"FAILED: {login.text[:100]}")