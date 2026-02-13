from sqlalchemy import create_engine, text
from backend_api.config import settings

def check_tables():
    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as conn:
        res_ferreteria = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='ferreteria'")).fetchall()
        print(f"FERRETERIA TABLES: {res_ferreteria}")
        
        res_public = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")).fetchall()
        print(f"PUBLIC TABLES: {res_public}")
        
        # Check alembic_version_tenant specifically
        res_ver = conn.execute(text("SELECT * FROM ferreteria.alembic_version_tenant")).fetchall()
        print(f"ALEMBIC VERSION (FERRETERIA): {res_ver}")

if __name__ == "__main__":
    check_tables()
