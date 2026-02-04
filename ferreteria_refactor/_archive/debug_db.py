from sqlalchemy import create_engine, text
from backend_api.config import settings

def debug():
    print(f"Connecting to: {settings.DATABASE_URL}")
    engine = create_engine(settings.DATABASE_URL)
    
    with engine.connect() as conn:
        # 1. Check current schema path
        res = conn.execute(text("SHOW search_path"))
        print(f"Search Path: {res.fetchone()[0]}")
        
        # 2. Check schemas
        res = conn.execute(text("SELECT schema_name FROM information_schema.schemata"))
        schemas = [r[0] for r in res]
        print(f"Schemas found: {schemas}")
        
        # 3. Check public tables
        res = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'"))
        tables = [r[0] for r in res]
        print(f"Tables in public: {tables}")
        
        # 4. Check for alebmic_version specifically
        if 'alembic_version' in tables:
            res = conn.execute(text("SELECT version_num FROM public.alembic_version"))
            print(f"Current Revision: {res.fetchall()}")
        else:
            print("⚠️ alembic_version table MISSING in public.")

if __name__ == "__main__":
    debug()
