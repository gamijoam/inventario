from sqlalchemy import create_engine, text
from passlib.context import CryptContext
import os

# Configuration
DATABASE_URL = "postgresql://postgres:password@localhost:5432/pruebita2_db"
NEW_PASSWORD = "admin123"

# Setup Hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
new_hash = pwd_context.hash(NEW_PASSWORD)

print(f"Generating new hash for '{NEW_PASSWORD}'...")
print(f"New Hash: {new_hash}")

# Connect and Update
try:
    # Force latin1 just in case, though we are writing
    engine = create_engine(DATABASE_URL, connect_args={"client_encoding": "latin1"})
    
    with engine.begin() as conn: # Use transaction
        # 1. Update
        result = conn.execute(
            text("UPDATE users SET password_hash = :p_hash WHERE username = 'admin'"),
            {"p_hash": new_hash}
        )
        print(f"Rows updated: {result.rowcount}")
        
        # 2. Verify
        result = conn.execute(text("SELECT password_hash FROM users WHERE username = 'admin'"))
        stored_hash = result.scalar()
        print(f"Stored Hash in DB: {stored_hash}")
        
        if stored_hash == new_hash:
            print("✅ SUCCESS: Password reset successfully.")
        else:
            print("❌ ERROR: Hash mismatch after update.")

except Exception as e:
    print(f"❌ CRITICAL ERROR: {e}")
