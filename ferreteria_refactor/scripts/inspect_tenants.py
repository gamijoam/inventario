from sqlalchemy import create_engine, text
from backend_api.config import settings
import json

def inspect_tenants():
    print(f"Connecting to {settings.DATABASE_URL}")
    engine = create_engine(settings.DATABASE_URL)
    
    with engine.connect() as conn:
        result = conn.execute(text("SELECT id, name, schema_name, config FROM public.tenants"))
        rows = result.fetchall()
        
        print(f"Found {len(rows)} tenants:")
        for row in rows:
            print(f"ID: {row.id}")
            print(f"Name: {row.name}")
            print(f"Schema: {row.schema_name}")
            print(f"Config: {row.config}") # Should be a dict or json string
            print("-" * 20)

if __name__ == "__main__":
    inspect_tenants()
