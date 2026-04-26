#!/usr/bin/env python3
with open('/root/deploy/qa/code/ferreteria_refactor/backend_api/services/inventory_service.py', 'r') as f:
    content = f.read()

# Fix the broken f-string with escaped quotes
old = '''text(f"SELECT value FROM "{get_tenant_schema()}".business_config WHERE key = 'business_name'")'''
new = '''text(f"SELECT value FROM \\"{get_tenant_schema()}\\"."business_config" WHERE key = 'business_name'")'''

if old in content:
    content = content.replace(old, new)
    print("Fixed old format")
else:
    # Find and fix the line around line 287
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if 'SELECT value FROM' in line and 'get_tenant_schema()' in line and 'business_config' in line:
            # Replace double quotes inside f-string
            if 'f"SELECT value FROM "' in line:
                lines[i] = line.replace('f"SELECT value FROM "', 'text(f\'SELECT value FROM "\\'')
                lines[i] = lines[i].replace('.business_config"', '.business_config"\')')
                print(f"Fixed line {i+1}")
    content = '\n'.join(lines)

with open('/root/deploy/qa/code/ferreteria_refactor/backend_api/services/inventory_service.py', 'w') as f:
    f.write(content)

print("Done")