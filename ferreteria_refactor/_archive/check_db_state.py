
from sqlalchemy import create_engine, text, inspect
from backend_api.config import settings

def check_db_state():
    engine = create_engine(settings.DATABASE_URL)
    inspector = inspect(engine)
    
    print("Checking 'public' schema:")
    tables_public = inspector.get_table_names(schema="public")
    print(f"Tables: {tables_public}")
    
    print("\nChecking 'ferreteria' schema:")
    try:
        tables_ferreteria = inspector.get_table_names(schema="ferreteria")
        print(f"Tables: {tables_ferreteria}")
    except Exception as e:
        print(f"Error checking ferreteria schema: {e}")

    with engine.connect() as conn:
        print("\nChecking version table contents:")
        if "alembic_version_shared" in tables_public:
            res = conn.execute(text("SELECT * FROM public.alembic_version_shared"))
            print(f"alembic_version_shared: {res.fetchall()}")
        
        if "ferreteria" in inspector.get_schema_names():
             # Check for tenant version table
             pass # Logic is complex, just assume if table exists it might be dirty

if __name__ == "__main__":
    check_db_state()
