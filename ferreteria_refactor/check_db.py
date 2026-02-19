from backend_api.database.db import engine
from sqlalchemy import inspect

inspector = inspect(engine)
print("Tables in DB:", inspector.get_table_names())
