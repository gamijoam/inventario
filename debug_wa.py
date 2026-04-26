import asyncio
import httpx
import sys
sys.path.insert(0, '/app/ferreteria_refactor')

from backend_api.database.db import SessionLocal
from backend_api.tenant_context import set_tenant_schema
from sqlalchemy import text

set_tenant_schema('colaloca2')

db = SessionLocal()
db.execute(text('SET search_path TO colaloca2, public'))
db.commit()

inst = db.execute(text("SELECT value FROM business_config WHERE key = 'whatsapp_instance_name'")).scalar()
enabled = db.execute(text("SELECT value FROM business_config WHERE key = 'whatsapp_enabled'")).scalar()
status = db.execute(text("SELECT value FROM business_config WHERE key = 'whatsapp_instance_status'")).scalar()

print(f'Instance: {inst}, Enabled: {enabled}, Status: {status}')

WA_URL = 'http://whatsapp_service:3000'
async def check():
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.get(f'{WA_URL}/instance/{inst}/status')
            print(f'Service status: {r.json()}')
    except Exception as e:
        print(f'Error checking service: {e}')

asyncio.run(check())
db.close()