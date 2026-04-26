#!/usr/bin/env python3
with open('/root/deploy/qa/code/ferreteria_refactor/backend_api/services/inventory_service.py', 'r') as f:
    content = f.read()

# Fix the broken SQL query
old = '''text(f"SELECT value FROM \\"{schema}\\"."business_config" WHERE key = 'business_name'")'''
new = '''text(f'SELECT value FROM "{schema}".business_config WHERE key = \\'business_name\\'')'''

content = content.replace(old, new)

with open('/root/deploy/qa/code/ferreteria_refactor/backend_api/services/inventory_service.py', 'w') as f:
    f.write(content)

print("Done" if old in content else "Not found")