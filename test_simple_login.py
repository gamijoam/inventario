#!/usr/bin/env python3
import requests
import urllib3
from urllib.parse import urlencode

urllib3.disable_warnings()

BASE = 'https://api-qa.miinventariofacil.com/api/v1'

# Try with no session, just direct call
data = urlencode({'username': 'admin', 'password': 'admin123'})
r = requests.post(f'{BASE}/auth/token',
    data=data,
    headers={
        'X-Tenant-ID': 'restaurante',
        'Content-Type': 'application/x-www-form-urlencoded',
    }, verify=False)
print(f"Status: {r.status_code}")
print(f"Headers: {dict(r.headers)}")
print(f"Cookies: {dict(r.cookies)}")
print(f"Body: {r.text[:500]}")