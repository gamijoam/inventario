import sys
import os

# 1. Setup path to include backend_api
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from backend_api.database.db import SessionLocal
from backend_api.security import verify_password
import traceback

print("🔹 Starting Full Auth Debug...")
print(f"🔹 Sys Path: {sys.path}")

db = SessionLocal()
try:
    print("🔹 Connected to DB. Fetching admin user...")
    # Fetch admin using raw SQL to be sure
    result = db.execute(text("SELECT username, password_hash FROM users WHERE username = 'admin'"))
    user = result.fetchone()
    
    if not user:
        print("❌ CRITICAL: User 'admin' NOT found in this database!")
    else:
        username, p_hash = user
        print(f"✅ User found: {username}")
        print(f"🔹 Hash from DB: {p_hash}")
        
        test_pass = "admin123"
        print(f"🔹 Testing Verify with password: '{test_pass}'")
        
        try:
            valid = verify_password(test_pass, p_hash)
            print(f"🔹 Verification Result: {valid}")
            if valid:
                print("✅ SUCCESS: Password valid!")
            else:
                print("❌ FAILED: Password invalid (returned False).")
        except Exception as e:
            print(f"❌ AUTH CRASH: verify_password raised exception!")
            print(f"❌ Exception: {e}")
            traceback.print_exc()

except Exception as e:
    print(f"❌ DB ERROR: {e}")
    traceback.print_exc()
finally:
    db.close()
