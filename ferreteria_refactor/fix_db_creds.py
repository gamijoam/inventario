import psycopg2
import os

# Possible passwords to test
passwords = [
    "postgres", 
    "123456", 
    "admin", 
    "root", 
    "password", 
    "1234",
    ""
]

print("🔍 Testing PostgreSQL credentials to fix the UnicodeDecodeError...")
print("The error is likely caused by a failed login returning a Spanish error message.")
print("="*60)

db_host = "localhost"
db_port = "5432"
db_name = "ferreteria_db"
db_user = "postgres"

success = False

for pwd in passwords:
    print(f"👉 Testing password: '{pwd}' ... ", end="")
    try:
        # We try to connect. If auth works, NO error message is sent, so NO Unicode Error!
        conn = psycopg2.connect(
            host=db_host,
            port=db_port,
            database=db_name,
            user=db_user,
            password=pwd
        )
        print("✅ SUCCESS!")
        print(f"\n🎉 FOUND CORRECT PASSWORD: '{pwd}'")
        conn.close()
        success = True
        break
    except UnicodeDecodeError:
        print("❌ Failed (Unicode Error - Auth Failed)")
    except Exception as e:
        # If we get a different error (like DB doesn't exist), auth might have worked!
        if "does not exist" in str(e):
             print(f"⚠️  Auth OK, but DB missing: {e}")
             print(f"\n🎉 FOUND CORRECT PASSWORD: '{pwd}'")
             success = True
             break
        print(f"❌ Failed: {type(e).__name__}")

if not success:
    print("\n" + "="*60)
    print("❌ Could not find the correct password.")
    print("Please check your PostgreSQL installation for the 'postgres' user password.")
else:
    print("\n" + "="*60)
    print("✅ Please update your .env file with the found password!")
