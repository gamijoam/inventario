from sqlalchemy import create_engine, inspect
import os

# Manual setup to match app
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./sql_app.db")
if "sqlite" in SQLALCHEMY_DATABASE_URL:
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(SQLALCHEMY_DATABASE_URL)

inspector = inspect(engine)
columns = inspector.get_columns('payment_methods')
print("Columns in payment_methods:")
found = False
for c in columns:
    print(f"- {c['name']} ({c['type']})")
    if c['name'] == 'requires_reference':
        found = True

if found:
    print("SUCCESS: requires_reference column FOUND.")
else:
    print("FAILURE: requires_reference column NOT FOUND.")
