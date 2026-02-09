from sqlalchemy import create_engine, text
from backend_api.config import settings

def check_schema():
    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as conn:
        res = conn.execute(text("SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'ferreteria'")).fetchall()
        print(f"SCHEMA FERRETERIA: {res}")
        
        # Check ALembic versions in public
        res_ver = conn.execute(text("SELECT * FROM public.alembic_version_shared")).fetchall()
        print(f"SHARED VERSION: {res_ver}")
        
        # Check if tenant version ended up in public
        try:
            res_tenant_ver = conn.execute(text("SELECT * FROM public.alembic_version_tenant")).fetchall()
            print(f"TENANT VERSION IN PUBLIC: {res_tenant_ver}")
        except:
            print("No public.alembic_version_tenant")

if __name__ == "__main__":
    check_schema()
