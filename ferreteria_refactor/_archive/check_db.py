
from backend_api.config.database import engine
from sqlalchemy import inspect

inspector = inspect(engine)
tables = inspector.get_table_names()

print("Tables in DB:")
for table in tables:
    print(f"- {table}")

if "product_prices" in tables:
    print("\n[OK] product_prices table exists.")
    columns = [c['name'] for c in inspector.get_columns("product_prices")]
    print(f"Columns: {columns}")
else:
    print("\n[ERROR] product_prices table MISSING!")
