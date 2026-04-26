#!/usr/bin/env python3
with open('/root/deploy/qa/code/ferreteria_refactor/backend_api/services/inventory_service.py', 'r') as f:
    content = f.read()

# Fix the broken line
content = content.replace(
    'logger.warning(f[DEBUG] Fallback lookup: source_schema={source_schema})',
    'logger.warning(f"[DEBUG] Fallback lookup: source_schema={source_schema}")'
)

with open('/root/deploy/qa/code/ferreteria_refactor/backend_api/services/inventory_service.py', 'w') as f:
    f.write(content)

print("Done")