from passlib.context import CryptContext

# Hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

hash_from_db = "$2b$12$7VjKQxbTVDL9kQZ.MAit3.FZpd7P0FbX/h5TTy5kXie2O/IBgqyQcW"
password = "admin123"

print(f"Testing verification...")
print(f"Password: {password}")
print(f"Hash: {hash_from_db}")

try:
    result = pwd_context.verify(password, hash_from_db)
    print(f"Verification Result: {result}")
except Exception as e:
    print(f"Verification ERROR: {e}")
    import traceback
    traceback.print_exc()

# Also try to re-hash
new_hash = pwd_context.hash(password)
print(f"New Hash: {new_hash}")
print(f"Verify New: {pwd_context.verify(password, new_hash)}")
