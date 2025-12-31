from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

# Connect to cloud.db
# Adjust path if necessary, assuming it's in the CWD
DB_URL = "sqlite:///cloud.db"
engine = create_engine(DB_URL)
Session = sessionmaker(bind=engine)
session = Session()

try:
    print("--- INSPECTING CLOUD.DB ---")
    
    # Check Categories
    print("\n--- CATEGORIES ---")
    categories = session.execute(text("SELECT id, name FROM categories")).fetchall()
    print(f"Count: {len(categories)}")
    for c in categories:
        print(c)

    # Check Products
    print("\n--- PRODUCTS ---")
    products = session.execute(text("SELECT id, name, is_active, category_id, exchange_rate_id, stock FROM products")).fetchall()
    print(f"Count: {len(products)}")
    if len(products) == 0:
        print("⚠️ NO PRODUCTS FOUND! Did you insert them but not commit, or insert them into the wrong DB file?")
    for p in products:
        print(f"ID: {p[0]}, Name: {p[1]}, Active: {p[2]}, CatID: {p[3]}, RateID: {p[4]}, Stock: {p[5]}")
        
    # Check Exchange Rates
    print("\n--- EXCHANGE RATES ---")
    rates = session.execute(text("SELECT id, name, currency_symbol FROM exchange_rates")).fetchall()
    print(f"Count: {len(rates)}")
    for r in rates:
        print(r)

except Exception as e:
    print(f"❌ Error: {e}")
finally:
    session.close()
