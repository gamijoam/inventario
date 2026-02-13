from sqlalchemy import create_engine, text
from backend_api.config import settings

def test_create():
    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as conn:
        with conn.begin(): # Start transaction
            conn.execute(text("CREATE TABLE ferreteria.test_manual (id serial primary key)"))
            print("Table created.")
    
    # Check persistence
    with engine.connect() as conn:
        res = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='ferreteria'")).fetchall()
        print(f"FERRETERIA TABLES AFTER CREATE: {res}")

if __name__ == "__main__":
    test_create()
