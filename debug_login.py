import sys
import psycopg2
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def check_user(email):
    try:
        conn = psycopg2.connect(
            dbname="ferreteria_db",
            user="postgres",
            password="postgres",
            host="localhost",
            port="5432"
        )
        cur = conn.cursor()
        
        # 1. Check Existence (Count)
        cur.execute("SELECT count(*) FROM public.users WHERE email = %s", (email,))
        count = cur.fetchone()[0]
        
        if count == 0:
            print(f"User {email}: NOT FOUND")
            return

        print(f"User {email}: FOUND (Count={count})")

        # 2. Get Salt/Hash ONLY (Assuming hash is proper ASCII/UTF-8 compatible)
        cur.execute("SELECT password_hash, is_active, is_superuser FROM public.users WHERE email = %s", (email,))
        p_hash, is_active, is_superuser = cur.fetchone()
        
        print(f"Status: Active={is_active}, Superuser={is_superuser}")
        
        # 3. Verify Passwords
        passwords = ["admin123", "123456", "admin", "1234"]
        for pwd in passwords:
            try:
                if verify_password(pwd, p_hash):
                    print(f"Password '{pwd}': VALID")
                else:
                    print(f"Password '{pwd}': INVALID")
            except Exception as e:
                 print(f"Password check error for '{pwd}': {e}")

    except Exception as e:
        print(f"CRITICAL ERROR: {e}")
    finally:
        if 'conn' in locals() and conn: conn.close()

if __name__ == "__main__":
    check_user("rodriguezisaac876@gmail.com")
