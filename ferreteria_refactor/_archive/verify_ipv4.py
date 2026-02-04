import psycopg2
import os

print("🔍 Testing connection via 127.0.0.1 (IPv4) ...")

try:
    conn = psycopg2.connect(
        "postgresql://postgres:postgres@127.0.0.1:5432/ferreteria_db",
        client_encoding="latin1"
    )
    print("✅ Connection successful using 127.0.0.1!")
    conn.close()
except UnicodeDecodeError:
    print("❌ Failed (Unicode Error - Auth Failed)")
except Exception as e:
    print(f"❌ Failed: {e}")
