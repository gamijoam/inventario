from ferreteria_refactor.backend_api.database.db import engine
from sqlalchemy import text

def add_sale_id_column():
    try:
        with engine.connect() as connection:
            print("Checking if column exists...")
            result = connection.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='restaurant_orders' AND column_name='sale_id'"))
            if result.fetchone():
                print(" Column 'sale_id' already exists.")
            else:
                print(" Adding 'sale_id' column...")
                connection.execute(text("ALTER TABLE restaurant_orders ADD COLUMN sale_id INTEGER REFERENCES sales(id)"))
                connection.commit()
                print(" Column added successfully.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    add_sale_id_column()
