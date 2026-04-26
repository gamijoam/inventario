#!/usr/bin/env python3
with open('/root/deploy/qa/code/ferreteria_refactor/backend_api/services/inventory_service.py', 'r') as f:
    lines = f.readlines()

# Fix line 288 (index 287) - the broken SQL query
for i, line in enumerate(lines):
    if 'text(f"SELECT value FROM "{get_tenant_schema()}".business_config' in line:
        # Replace with properly escaped version using single quotes for the f-string
        lines[i] = "            text(f'SELECT value FROM \"{get_tenant_schema()}\".business_config WHERE key = \\'business_name\\'')\n"
        print(f"Fixed line {i+1}")

with open('/root/deploy/qa/code/ferreteria_refactor/backend_api/services/inventory_service.py', 'w') as f:
    f.writelines(lines)

print("Done")