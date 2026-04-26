#!/usr/bin/env python3
import requests
import urllib3
from urllib.parse import urlencode

urllib3.disable_warnings()

BASE = 'https://api-qa.miinventariofacil.com/api/v1'
TENANT = 'restaurante'

s = requests.Session()
data = urlencode({'username': 'restaurante@gmail.com', 'password': '12345678'})
login = s.post(f'{BASE}/auth/token', data=data, headers={'X-Tenant-ID': TENANT, 'Content-Type': 'application/x-www-form-urlencoded'}, verify=False)
s.headers.update({'X-Tenant-ID': TENANT})

# Try different endpoints
endpoints = ['/cash/sessions', '/cash/registers', '/cash/sessions/open']
for ep in endpoints:
    r = s.get(f'{BASE}{ep}', verify=False)
    print("GET", ep, ":", r.status_code)
    if r.status_code == 200:
        print(" Data:", r.text[:200])