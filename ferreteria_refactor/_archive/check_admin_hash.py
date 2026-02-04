from sqlalchemy import create_engine, text
# from backend_api.core.config import settings
import os
from dotenv import load_dotenv

load_dotenv()

# Force English messages to avoid UnicodeDecodeError
os.environ["LC_MESSAGES"] = "C"
os.environ["PGCLIENTENCODING"] = "utf-8"

# USE CORRECT DB URL from backend_api/.env
DATABASE_URL = "postgresql://postgres:password@localhost:5432/pruebita2_db"
if not DATABASE_URL:
    print("Error: DATABASE_URL not set")
    exit(1)

# Force latin1 to read Spanish error messages from Postgres
engine = create_engine(
    DATABASE_URL,
    connect_args={"client_encoding": "latin1"}
)

with engine.connect() as conn:
    result = conn.execute(text("SELECT username, password_hash FROM users WHERE username = 'admin'"))
    user = result.fetchone()
    if user:
        print(f"User: {user[0]}")
        print(f"Hash: {user[1]}")
    else:
        print("User 'admin' not found")
