from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from backend_api.models import models
from backend_api.database.db import get_db, Base
import os

# Manual setup to match app
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./sql_app.db")
if "sqlite" in SQLALCHEMY_DATABASE_URL:
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(SQLALCHEMY_DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def test_query():
    db = SessionLocal()
    try:
        print("Querying PaymentMethods...")
        methods = db.query(models.PaymentMethod).all()
        print(f"Found {len(methods)} methods.")
        for m in methods:
            print(f"- {m.name}: Active={m.is_active}, Ref={m.requires_reference}")
    except Exception as e:
        print("CRITICAL ERROR:")
        print(e)
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_query()
