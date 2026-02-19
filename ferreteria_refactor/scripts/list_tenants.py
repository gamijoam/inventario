import sys
import os
sys.path.append(os.getcwd())
from backend_api.database.db import SessionLocal
from backend_api.models import Tenant

db = SessionLocal()
tenants = db.query(Tenant).all()
print("\n--- TENANT LIST ---")
for t in tenants:
    print(f"ID: {t.id} | Name: {t.name} | Schema: {t.schema_name} | Domain: {t.domain}")
print("-" * 20)
