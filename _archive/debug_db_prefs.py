from ferreteria_refactor.backend_api.database.db import SessionLocal
from ferreteria_refactor.backend_api.models.models import User

def check_prefs():
    db = SessionLocal()
    try:
        users = db.query(User).all()
        print(f"Found {len(users)} users.")
        for u in users:
            print(f"User: {u.username} | Prefs Type: {type(u.preferences)} | Content: {u.preferences}")
    finally:
        db.close()

if __name__ == "__main__":
    check_prefs()
