from ferreteria_refactor.backend_api.database.db import SessionLocal
from ferreteria_refactor.backend_api.models import models
from sqlalchemy import func
from datetime import datetime

db = SessionLocal()

# Check Sales for Today (2026-01-03)
target_date = "2026-01-03"
start = datetime.strptime(target_date + " 00:00:00", "%Y-%m-%d %H:%M:%S")
end = datetime.strptime(target_date + " 23:59:59", "%Y-%m-%d %H:%M:%S")

print(f"Checking Sales between {start} and {end}...")
sales = db.query(models.Sale).filter(models.Sale.date >= start, models.Sale.date <= end).all()
print(f"Found {len(sales)} sales.")
for s in sales:
    print(f"ID: {s.id}, Date: {s.date}, Total: {s.total_amount}")

# Check with the +1 day logic manually
end_extended = datetime.strptime("2026-01-04 23:59:59", "%Y-%m-%d %H:%M:%S")
print(f"\nChecking Sales between {start} and {end_extended} (Extended)...")
sales_ext = db.query(models.Sale).filter(models.Sale.date >= start, models.Sale.date <= end_extended).all()
print(f"Found {len(sales_ext)} sales (Extended).")
for s in sales_ext:
    print(f"ID: {s.id}, Date: {s.date} (Type: {type(s.date)})")
