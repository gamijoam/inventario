from backend_api.database.db import engine
from sqlalchemy import text

def check_version():
    with engine.connect() as conn:
        result = conn.execute(text("SELECT * FROM public.alembic_version"))
        for row in result:
            print(f"Current version: {row}")

if __name__ == "__main__":
    check_version()
