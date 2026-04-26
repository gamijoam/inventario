#!/usr/bin/env python3
import requests
from urllib.parse import urlencode
r = requests.post('https://api-qa.miinventariofacil.com/api/v1/auth/token',
    data=urlencode({'username': 'admin', 'password': '12345678'}),
    headers={'X-Tenant-ID': 'restaurante', 'Content-Type': 'application/x-www-form-urlencoded'},
    verify=False)
print("API Login:", r.status_code)