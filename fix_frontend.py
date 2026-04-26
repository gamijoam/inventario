#!/usr/bin/env python3
with open('/root/deploy/qa/code/ferreteria_refactor/frontend_web/src/pages/Inventory/Transfers/ExternalTransferIn.jsx', 'r') as f:
    content = f.read()

# Add source_schema to import request
content = content.replace(
    'source_company: sourceCompany,',
    'source_company: sourceCompany,\n        source_schema: sourceSchema || null,'
)

with open('/root/deploy/qa/code/ferreteria_refactor/frontend_web/src/pages/Inventory/Transfers/ExternalTransferIn.jsx', 'w') as f:
    f.write(content)

print("Done")