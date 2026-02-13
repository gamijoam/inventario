from sqlalchemy import create_engine, text
from backend_api.config import settings

def reset_tenant_history():
    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as conn:
        with conn.begin():
            conn.execute(text("DROP TABLE IF EXISTS ferreteria.alembic_version_tenant"))
            print("Dropped ferreteria.alembic_version_tenant")

if __name__ == "__main__":
    reset_tenant_history()
