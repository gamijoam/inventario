from ferreteria_refactor.backend_api.database.db import engine
from sqlalchemy import text

def fix_enum():
    with engine.connect() as connection:
        # 1. Check existing values
        print("Checking existing enum values...")
        try:
            result = connection.execute(text("SELECT unnest(enum_range(NULL::movementtype))"))
            existing_values = [row[0] for row in result]
            print(f"Current values: {existing_values}")
            
            # 2. Add missing values
            values_to_add = ['EXTERNAL_TRANSFER_OUT', 'EXTERNAL_TRANSFER_IN']
            
            # PostgreSQL "ALTER TYPE ... ADD VALUE" cannot run inside a transaction block usually, 
            # but SQLAlchemy 'engine.connect()' might imply one.
            # We need to run it with 'execution_options(isolation_level="AUTOCOMMIT")'
            
        except Exception as e:
             print(f"Error reading enum: {e}")
             return

    # Helper to add value efficiently
    # We use a separate connection with autocommit for ALTER TYPE
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as connection:
        for val in values_to_add:
            if val not in existing_values:
                print(f"Adding missing value: {val}")
                try:
                    connection.execute(text(f"ALTER TYPE movementtype ADD VALUE '{val}'"))
                    print(f"Successfully added {val}")
                except Exception as e:
                    print(f"Error adding {val}: {e}")
            else:
                print(f"Value {val} already exists.")

if __name__ == "__main__":
    fix_enum()
