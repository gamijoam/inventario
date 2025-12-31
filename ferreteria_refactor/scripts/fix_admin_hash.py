from ferreteria_refactor.backend_api.database.db import SessionLocal
from ferreteria_refactor.backend_api.models import models
from ferreteria_refactor.backend_api.security import get_password_hash

def fix_admin():
    db = SessionLocal()
    try:
        print("[INFO] Searching for 'admin' user...")
        admin = db.query(models.User).filter(models.User.username == "admin").first()
        
        if admin:
            print(f"[INFO] Found admin user (ID: {admin.id})")
            print("[INFO] Generating new bcrypt hash for password 'admin123'...")
            new_hash = get_password_hash("admin123")
            
            admin.password_hash = new_hash
            db.commit()
            print("[OK] Password updated successfully!")
            print(f"   New Hash Prefix: {new_hash[:20]}...")
        else:
            print("[WARN] Admin user not found!")
            
    except Exception as e:
        print(f"[ERR] Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    fix_admin()
