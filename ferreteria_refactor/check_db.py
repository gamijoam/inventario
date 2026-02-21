import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text, inspect

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

inspector = inspect(engine)

for schema in ['public', 'prueba3']:
    print(f"\n--- Schema: {schema} ---")
    if 'sales' in inspector.get_table_names(schema=schema):
        cols = inspector.get_columns('sales', schema=schema)
        col_names = [c['name'] for c in cols]
        print("Columns in 'sales':")
        for name in col_names:
            if 'discount' in name:
                print(f" - {name}")
    else:
        print("Table 'sales' not found.")
