import sys
import os

# Ensure current directory is in path for imports
sys.path.append(os.getcwd())

from backend_api.database.db import SessionLocal
from backend_api.models import models

def check_users():
    db = SessionLocal()
    try:
        print("\n--- Users Check ---")
        users = db.query(models.User).all()
        for u in users:
            print(f"ID: {u.id} | User: {u.username} | Role: {u.role} (Type: {type(u.role)}) | Active: {u.is_active}")
            if hasattr(u.role, 'value'):
                 print(f"   -> Role Value: {u.role.value}")
            
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    check_users()
