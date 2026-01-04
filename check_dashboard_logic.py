from ferreteria_refactor.backend_api.database.db import SessionLocal
from ferreteria_refactor.backend_api.models import models
from sqlalchemy import func
from datetime import datetime, date, timedelta
from decimal import Decimal

db = SessionLocal()

# Simulate Report Logic for TODAY
start_date = date.today()
end_date = date.today()

# Timezone Fix Logic
start_dt = datetime.combine(start_date, datetime.min.time())
if start_date == end_date:
    end_dt = datetime.combine(end_date + timedelta(days=1), datetime.min.time())
else:
    end_dt = datetime.combine(end_date, datetime.max.time())

print(f"Checking Dashboard Financials Logic for {start_dt} to {end_dt}")

# Query SalePayment
query = db.query(
    models.SalePayment.currency,
    func.sum(models.SalePayment.amount).label('total_collected'),
    func.count(models.SalePayment.id).label('payment_count')
).join(models.Sale).filter(
    models.Sale.date >= start_dt,
    models.Sale.date <= end_dt
)

print(f"SQL Equivalent: SELECT currency, SUM(amount), COUNT(id) FROM sale_payments JOIN sales ON sales.id = sale_payments.sale_id WHERE sales.date >= '{start_dt}' AND sales.date <= '{end_dt}' GROUP BY currency")

results = query.group_by(models.SalePayment.currency).all()
print(f"Raw Results: {results}")

if not results:
    print("NO RESULTS FOUND by the logic!")
else:
    for r in results:
        print(f"Currency: {r.currency}, Total: {r.total_collected}, Count: {r.payment_count}")

# Check Returns logic
returns_query = db.query(
    models.CashMovement.currency,
    func.sum(models.CashMovement.amount).label('total_refunded')
).filter(
    models.CashMovement.date >= start_dt,
    models.CashMovement.date <= end_dt,
    models.CashMovement.type == "RETURN"
).group_by(models.CashMovement.currency).all()

print(f"Returns Raw: {returns_query}")
