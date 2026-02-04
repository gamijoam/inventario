
import sys
import os
sys.path.append(os.getcwd())

from backend_api.database.db import SessionLocal
from backend_api.models import models

def check_methods():
    db = SessionLocal()
    try:
        methods = db.query(models.PaymentMethod).all()
        for m in methods:
            print(f"ID: {m.id}, Name: '{m.name}', Active: {m.is_active}")
    finally:
        db.close()

if __name__ == "__main__":
    check_methods()
