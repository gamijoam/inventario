from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

# Connect to ferreteria.db (Local)
DB_URL = "sqlite:///ferreteria.db"
engine = create_engine(DB_URL)
Session = sessionmaker(bind=engine)
session = Session()

try:
    print("--- INSPECTING LOCAL FERRETERIA.DB ---")
    
    # Check Products
    print("\n--- PRODUCTS ---")
    products = session.execute(text("SELECT id, name, is_active, category_id, stock FROM products")).fetchall()
    print(f"Count: {len(products)}")
    for p in products:
        print(f"ID: {p[0]}, Name: {p[1]}, Active: {p[2]}, CatID: {p[3]}, Stock: {p[4]}")
        
    # Check Categories
    print("\n--- CATEGORIES ---")
    categories = session.execute(text("SELECT id, name FROM categories")).fetchall()
    print(f"Count: {len(categories)}")
    
except Exception as e:
    print(f"❌ Error: {e}")
finally:
    session.close()
