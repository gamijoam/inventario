#!/usr/bin/env python3
import urllib.request
req = urllib.request.Request('http://localhost:8000/api/v1/users/me',
    headers={'Origin': 'https://admin-qa.miinventariofacil.com'})
try:
    r = urllib.request.urlopen(req, timeout=5)
    print('Status:', r.status)
    print('Headers:', dict(r.headers))
except urllib.error.HTTPError as e:
    print('Error:', e.code)
    print('Headers:', dict(e.headers))