from backend_api.database.db import engine
from sqlalchemy import text

def drop_admin_tasks():
    with engine.connect() as conn:
        print("Dropping admin_tasks table...")
        conn.execute(text("DROP TABLE IF EXISTS public.admin_tasks CASCADE"))
        conn.commit()
        print("Dropped.")

if __name__ == "__main__":
    drop_admin_tasks()
