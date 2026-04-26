import asyncio
import sys
sys.path.insert(0, '/app/ferreteria_refactor')

from fastapi.testclient import TestClient
from backend_api.main import app

client = TestClient(app)

# Patch the notification code to add debugging
import backend_api.services.inventory_service as inv_svc
original_generate = inv_svc.InventoryService.generate_transfer_package_v2

def patched_generate(db, items_data, source_company, warehouse_id=None, photo_urls=None):
    from backend_api.tenant_context import get_tenant_schema
    from backend_api.routers.whatsapp import KEY_ADMIN_PHONE, KEY_NOTIFY_TRANSFER
    from sqlalchemy import text

    # Run original
    result = original_generate(db, items_data, source_company, warehouse_id, photo_urls)

    # Debug: Check notification context
    print(f"[DEBUG] Notification check:")
    current_schema = get_tenant_schema()
    print(f"  current_schema = {current_schema}")

    config_rows = db.execute(text(f'SELECT key, value FROM "{current_schema}".business_config WHERE key IN (:p, :n)'), {"p": KEY_ADMIN_PHONE, "n": KEY_NOTIFY_TRANSFER}).fetchall()
    config = {r[0]: r[1] for r in config_rows}
    print(f"  config_rows = {config_rows}")
    print(f"  config = {config}")

    admin_phone = config.get(KEY_ADMIN_PHONE)
    notify_enabled = str(config.get(KEY_NOTIFY_TRANSFER, "true")).lower() == "true"
    print(f"  admin_phone = {admin_phone}")
    print(f"  notify_enabled = {notify_enabled}")

    return result

inv_svc.InventoryService.generate_transfer_package_v2 = staticmethod(patched_generate)

# Now call the endpoint
response = client.post(
    '/api/v1/inventory/transfer/export',
    json={'items': [{'product_id': 3, 'quantity': 1}], 'source_company': 'DEBUG_TEST'},
    headers={'X-Tenant-ID': 'colaloca2'}
)

print(f'\nStatus: {response.status_code}')
print(f'Response snippet: {str(response.json())[:200]}')