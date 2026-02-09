import psycopg2
from passlib.context import CryptContext

# Setup password context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password):
    return pwd_context.hash(password)

def reset_password(email, new_password):
    try:
        conn = psycopg2.connect(
            dbname="ferreteria_db",
            user="postgres",
            password="postgres",
            host="localhost",
            port="5432"
        )
        cur = conn.cursor()
        
        new_hash = get_password_hash(new_password)
        
        # Direct Update - No Reads
        cur.execute("""
            UPDATE public.users 
            SET password_hash = %s, is_active = true, is_superuser = true 
            WHERE email = %s
        """, (new_hash, email))
        
        rows = cur.rowcount
        conn.commit()
        
        if rows > 0:
            print(f"✅ Password reset SUCCESS for '{email}'")
        else:
            print(f"❌ User '{email}' NOT FOUND (0 rows updated)")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if 'conn' in locals() and conn: conn.close()


if __name__ == "__main__":
    reset_password("rodriguezisaac876@gmail.com", "admin123")
