import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from backend_api.models import models

DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/inventario_db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

db.execute(text("SET search_path TO prueba, public"))

try:
    config = db.query(models.BusinessConfig).filter(models.BusinessConfig.key == "ticket_template").first()
    if config and config.value:
        print("--- TEMPLATE FOUND IN DB ---")
        with open("template_dump.txt", "w", encoding="utf-8") as f:
            f.write(config.value)
        print("Template written to template_dump.txt")
    else:
        print("--- NO TEMPLATE FOUND (Uses codebase fallback) ---")
except Exception as e:
    print(f"Error: {e}")
