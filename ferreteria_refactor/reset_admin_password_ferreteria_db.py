from sqlalchemy import create_engine, text
from passlib.context import CryptContext
import os

# Configuration FROM ROOT .ENV
DATABASE_URL = "postgresql://postgres:password@localhost:5432/ferreteria_db"
NEW_PASSWORD = "admin123"

# Force English messages to avoid UnicodeDecodeError
os.environ["LC_MESSAGES"] = "C"
# REMOVED conflicting PGCLIENTENCODING

# Setup Hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
new_hash = pwd_context.hash(NEW_PASSWORD)

print(f"Generating new hash for '{NEW_PASSWORD}' in 'ferreteria_db'...")

# Connect and Update
try:
    # Force latin1 to handle potential Spanish error messages
    engine = create_engine(DATABASE_URL, connect_args={"client_encoding": "latin1"})
    
    with engine.begin() as conn: # Use transaction
        # 1. Update
        result = conn.execute(
            text("UPDATE users SET password_hash = :p_hash WHERE username = 'admin'"),
            {"p_hash": new_hash}
        )
        print(f"Rows updated: {result.rowcount}")
        
        if result.rowcount == 0:
            print("❌ WARNING: User 'admin' not found in ferreteria_db")
        else:
            print("✅ SUCCESS: Password reset successfully in ferreteria_db.")

except Exception as e:
    print(f"❌ ERROR: {e}")
