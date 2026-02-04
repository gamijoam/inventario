import os
import psycopg2

# Try to match the server's likely encoding (Latin-1 / Windows-1252)
# This should allow us to decoding the error message instead of crashing
# os.environ["PGCLIENTENCODING"] = "latin1" # Let's submit via connect_args

print("Attempting connection with client_encoding='latin1'...")

try:
    conn = psycopg2.connect(
        "postgresql://postgres:postgres@localhost:5432/ferreteria_db",
        client_encoding="latin1"
    )
    print("✅ Connection successful!")
    conn.close()
except Exception as e:
    print(f"❌ Connection failed: {e}")
    # print(f"Type: {type(e).__name__}")
    # if hasattr(e, 'encoding'):
    #     print(f"Encoding: {e.encoding}")
