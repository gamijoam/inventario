from backend_api.database.db import engine
from sqlalchemy import text

def reset_table():
    with engine.connect() as conn:
        print("Dropping sale_payments table...")
        try:
            conn.execute(text("DROP TABLE IF EXISTS sale_payments CASCADE"))
            conn.commit()
            print("Table dropped successfully.")
        except Exception as e:
            print(f"Error dropping table: {e}")

if __name__ == "__main__":
    reset_table()
