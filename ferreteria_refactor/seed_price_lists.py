
from ferreteria_refactor.backend_api.config.database import SessionLocal
from ferreteria_refactor.backend_api.models.price_list import PriceList
from sqlalchemy import text

db = SessionLocal()

try:
    # Check if table exists (handled by models usually, but valid check)
    count = db.query(PriceList).count()
    print(f"Current Price Lists: {count}")
    
    if count == 0:
        print("Seeding default price lists...")
        pl1 = PriceList(name="Mayorista", margin_percentage=10.0, is_active=True)
        pl2 = PriceList(name="VIP", margin_percentage=15.0, is_active=True, requires_auth=True)
        db.add(pl1)
        db.add(pl2)
        db.commit()
        print("Added: Mayorista, VIP")
    else:
        lists = db.query(PriceList).all()
        for l in lists:
            print(f"- {l.name}")

except Exception as e:
    print(f"Error: {e}")
finally:
    db.close()
