import os
import sys

print(f"Python Encoding: {sys.getdefaultencoding()}")
print(f"Filesystem Encoding: {sys.getfilesystemencoding()}")

# Check environment variables for non-ascii characters
print("\nChecking Env Vars for non-ascii:")
for key, value in os.environ.items():
    try:
        value.encode('ascii')
    except UnicodeEncodeError:
        print(f"Key with non-ascii: {key}")
        # Print only safe part of value
        print(f"  Value starts with: {value[:10]}")

print("\nTesting psycopg2 connection directly:")
try:
    import psycopg2
    print(f"Psycopg2 version: {psycopg2.__version__}")
    
    # Intentionally simple connection string
    # Replace with your actual password manually if running interactively
    # or rely on .env if loaded
    
    conn = psycopg2.connect(
        user="postgres",
        password="postgres", 
        host="localhost",
        port="5432",
        database="prueba_db"
    )
    print("Direct connection successful!")
    conn.close()
except Exception as e:
    print(f"Direct connection failed: {e}")
