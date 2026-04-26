import asyncio
import sys
sys.path.insert(0, '/app/ferreteria_refactor')

from fastapi.testclient import TestClient
from backend_api.main import app
from backend_api.database.db import SessionLocal
from backend_api.tenant_context import set_tenant_schema, get_tenant_schema
from sqlalchemy import text

# Simular el contexto de la request
set_tenant_schema('colaloca2')

client = TestClient(app)

# Llamar al endpoint de transfer
response = client.post(
    '/api/v1/inventory/transfer/export',
    json={'items': [{'product_id': 3, 'quantity': 1}], 'source_company': 'TEST_FASTAPI'},
    headers={'X-Tenant-ID': 'colaloca2'}
)

print(f'Status: {response.status_code}')
print(f'Response: {response.json()}')