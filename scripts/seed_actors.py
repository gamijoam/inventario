import sys
import os

# Ensure project root is in path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from ferreteria_refactor.backend_api.database.db import SessionLocal
from ferreteria_refactor.backend_api.models import models
from ferreteria_refactor.backend_api.models.models import UserRole
# Import hashing function - Assuming it's in backend_api.security
# If this fails, we might need to adjust import, but based on routers/users.py it is correct
try:
    from ferreteria_refactor.backend_api.security import get_password_hash
except ImportError:
    # Fallback if specific import structure differs
    print("⚠️  Warning: Could not import security.get_password_hash. Using dummy hash.")
    def get_password_hash(pwd): return f"hashed_{pwd}"

def log(msg):
    print(f"👥 {msg}")

def seed_actors():
    db = SessionLocal()
    try:
        log("Starting Actors Seeding...")

        # 1. SYSTEM USERS
        log("Creating Users...")
        users_data = [
            {"username": "admin", "password": "123", "role": UserRole.ADMIN, "name": "Administrador Principal", "pin": "1234"},
            {"username": "caja", "password": "123", "role": UserRole.CASHIER, "name": "Caja Principal", "pin": "0000"},
            {"username": "deposito", "password": "123", "role": UserRole.WAREHOUSE, "name": "Jefe de Almacén", "pin": "5678"},
        ]

        for u in users_data:
            existing = db.query(models.User).filter_by(username=u["username"]).first()
            if not existing:
                new_user = models.User(
                    username=u["username"],
                    password_hash=get_password_hash(u["password"]),
                    role=u["role"],
                    full_name=u["name"],
                    pin=u["pin"]
                )
                db.add(new_user)
                log(f"  + User: {u['username']} (Pass: {u['password']})")
            else:
                log(f"  = User Exists: {u['username']}")
        
        db.commit()

        # 2. SUPPLIERS
        log("Creating Suppliers...")
        suppliers_data = [
            {"name": "Materiales Los Andes", "contact": "Carlos Ruiz", "phone": "0414-1234567", "email": "ventas@losandes.com"},
            {"name": "Herramientas Import C.A.", "contact": "Ana Gomez", "phone": "0424-7654321", "email": "import@tools.com"},
        ]

        for s in suppliers_data:
            existing = db.query(models.Supplier).filter_by(name=s["name"]).first()
            if not existing:
                new_sup = models.Supplier(
                    name=s["name"],
                    contact_person=s["contact"],
                    phone=s["phone"],
                    email=s["email"],
                    address="Zona Industrial Local 5"
                )
                db.add(new_sup)
                log(f"  + Supplier: {s['name']}")
            else:
                log(f"  = Supplier Exists: {s['name']}")
        
        db.commit()

        # 3. CUSTOMERS
        log("Creating Customers...")
        customers_data = [
            {"name": "CLIENTE CASUAL", "id_doc": "00000000", "address": "N/A", "phone": "", "limit": 0},
            {"name": "Constructora Venecia", "id_doc": "J-12345678-9", "address": "Av. Bolivar, Edif. Azul", "phone": "0251-5555555", "limit": 5000.00},
            {"name": "Juan Pérez", "id_doc": "V-15888999", "address": "Urb. El Centro", "phone": "0412-9998877", "limit": 100.00},
        ]

        for c in customers_data:
            existing = db.query(models.Customer).filter_by(name=c["name"]).first()
            if not existing:
                new_cust = models.Customer(
                    name=c["name"],
                    id_number=c["id_doc"],
                    address=c["address"],
                    phone=c["phone"],
                    credit_limit=c["limit"]
                )
                db.add(new_cust)
                log(f"  + Customer: {c['name']}")
            else:
                log(f"  = Customer Exists: {c['name']}")
        
        db.commit()
        
        log("✅ Actors Seeding Complete!")

    except Exception as e:
        log(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    seed_actors()
