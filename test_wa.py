import asyncio
import sys
sys.path.insert(0, '/app/ferreteria_refactor')

from backend_api.database.db import SessionLocal
from backend_api.tenant_context import set_tenant_schema
from backend_api.routers.whatsapp import send_whatsapp_message

set_tenant_schema('colaloca2')

db = SessionLocal()
from sqlalchemy import text
db.execute(text('SET search_path TO colaloca2, public'))
db.commit()

result = db.execute(text("SELECT key, value FROM business_config WHERE key IN ('whatsapp_admin_phone', 'whatsapp_notify_transfer')")).fetchall()
print(f'Config: {result}')

phone = result[0][1] if result else None
if phone:
    msg = 'Test - WhatsApp funciona correctamente'
    r = asyncio.run(send_whatsapp_message(db, phone, msg))
    print(f'WhatsApp result: {r}')
else:
    print('No phone found')

db.close()