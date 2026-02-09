"""
Drop all Alembic version tracking tables to start fresh.
"""
from sqlalchemy import create_engine, text, inspect
from backend_api.config import settings

def drop_all_version_tables():
    engine = create_engine(settings.DATABASE_URL)
    inspector = inspect(engine)
    
    with engine.connect() as conn:
        with conn.begin():
            # Drop shared version table
            if "alembic_version_shared" in inspector.get_table_names(schema="public"):
                conn.execute(text("DROP TABLE public.alembic_version_shared"))
                print("✓ Dropped public.alembic_version_shared")
            
            # Drop tenant version tables from all schemas
            for schema in inspector.get_schema_names():
                if schema in ["public", "information_schema", "pg_catalog"]:
                    continue
                
                tables = inspector.get_table_names(schema=schema)
                if "alembic_version_tenant" in tables:
                    conn.execute(text(f'DROP TABLE "{schema}".alembic_version_tenant'))
                    print(f"✓ Dropped {schema}.alembic_version_tenant")
            
            print("\n✅ All Alembic version tables dropped. Fresh start ready.")

if __name__ == "__main__":
    drop_all_version_tables()
