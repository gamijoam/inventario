from backend_api.database.db import SessionLocal
from sqlalchemy import text

def fix_sequences():
    db = SessionLocal()
    try:
        print("Fixing audit_logs_id_seq...")
        # Check max id
        result = db.execute(text("SELECT MAX(id) FROM audit_logs"))
        max_id = result.scalar() or 0
        print(f"Max ID is {max_id}")
        
        # Reset sequence
        db.execute(text(f"SELECT setval('audit_logs_id_seq', {max_id + 1}, false)"))
        db.commit()
        print("Sequence fixed.")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    fix_sequences()
