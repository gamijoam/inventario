
from sqlalchemy import create_engine, text
from backend_api.config import settings

def create_schema(schema_name):
    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as conn:
        conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS \"{schema_name}\""))
        conn.commit()
    print(f"Schema '{schema_name}' created successfully.")

if __name__ == "__main__":
    create_schema("ferreteria")
