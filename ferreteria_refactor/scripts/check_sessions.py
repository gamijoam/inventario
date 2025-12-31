from backend_api.database.db import SessionLocal
from backend_api.models import models
import sys
import os

# Add parent directory to path to allow imports
sys.path.append(os.getcwd())

db = SessionLocal()

sessions = db.query(models.CashSession).all()
print(f"Total sessions: {len(sessions)}")
for s in sessions:
    print(f"ID: {s.id}, UserID: {s.user_id}, Status: {s.status}, Start: {s.start_time}, End: {s.end_time}, Initial: {s.initial_cash}, Final: {s.final_cash_reported}")

db.close()
