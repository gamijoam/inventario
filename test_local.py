#!/usr/bin/env python3
import requests
import urllib3
from urllib.parse import urlencode

urllib3.disable_warnings()

BASE = 'http://localhost:8000/api/v1'
TENANT = 'restaurante'

s = requests.Session()
data = urlencode({'username': 'admin', 'password': '12345678'})
login = s.post(f'{BASE}/auth/token', data=data, headers={'X-Tenant-ID': TENANT, 'Content-Type': 'application/x-www-form-urlencoded'}, verify=False)
print("LOGIN:", login.status_code)
if login.status_code == 200:
    print("Token OK")
s.headers.update({'X-Tenant-ID': TENANT})

# Open takeout
r = s.post(f'{BASE}/restaurant/orders/open-takeout?customer_name=Test', verify=False)
print("POST takeout:", r.status_code)
if r.status_code != 200:
    print("Error:", r.text[:200])
else:
    order = r.json()
    order_id = order.get('id')
    print(f"Order id={order_id}")