
import sys
import os
from sqlalchemy import text, create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend_api.config import settings

def check_users():
    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as conn:
        print("--- 👥 USERS IN PUBLIC SCHEMA ---")
        result = conn.execute(text("SELECT id, username, email, tenant_id FROM public.users"))
        users = result.fetchall()
        for u in users:
            print(f"ID: {u.id} | User: {u.username} | Email: {u.email} | Tenant: {u.tenant_id}")
            
        if not users:
            print("❌ No users found!")

if __name__ == "__main__":
    check_users()
