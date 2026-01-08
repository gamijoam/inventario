
from ferreteria_refactor.backend_api.database.db import SessionLocal
from sqlalchemy import text


from ferreteria_refactor.backend_api.database.db import SessionLocal, engine
from ferreteria_refactor.backend_api.models import models
from sqlalchemy import inspect

def check_schema_match():
    db = SessionLocal()
    try:
        print("Inspecting DB 'products' table...")
        inspector = inspect(engine)
        columns = inspector.get_columns('products')
        db_cols = {c['name'] for c in columns}
        print(f"DB Columns: {sorted(list(db_cols))}")
        
        print("\nInspecting SQLAlchemy Model 'Product'...")
        model_cols = {c.name for c in models.Product.__table__.columns}
        print(f"Model Columns: {sorted(list(model_cols))}")
        
        missing_in_db = model_cols - db_cols
        missing_in_model = db_cols - model_cols
        
        if missing_in_db:
             print(f"\n[CRITICAL] Columns in Model but MISSING in DB: {missing_in_db}")
        else:
             print(f"\n[OK] All Model columns exist in DB.")
             
        if missing_in_model:
             print(f"[INFO] Columns in DB but not in Model: {missing_in_model}")

    except Exception as e:
        print(f"[CRITICAL] Script Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_schema_match()
