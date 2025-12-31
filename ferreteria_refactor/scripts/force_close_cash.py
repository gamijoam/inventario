import sys
import os
import datetime

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend_api.database.db import SessionLocal
from backend_api.models import models

def force_close_sessions():
    db = SessionLocal()
    try:
        print("🔍 Searching for stuck OPEN sessions...")
        open_sessions = db.query(models.CashSession).filter(models.CashSession.status == "OPEN").all()
        
        if not open_sessions:
            print("✅ No stuck sessions found. The database is clean.")
            return

        print(f"⚠️ Found {len(open_sessions)} stuck sessions.")
        
        for session in open_sessions:
            print(f"   - Closing Session ID {session.id} (User {session.user_id}) started at {session.start_time}")
            session.status = "CLOSED"
            session.end_time = datetime.datetime.now()
            session.final_cash_reported = 0 # Force 0
            session.final_cash_expected = 0 
            session.notes = "Force closed by debug script"
            
        db.commit()
        print("✅ All sessions have been FORCE QUALIFIED as CLOSED.")
        print("🚀 You can now open a new session in the app.")
        
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    force_close_sessions()
