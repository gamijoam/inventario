import sys
import os
from decimal import Decimal

# Ensure project root is in path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from ferreteria_refactor.backend_api.database.db import SessionLocal
from ferreteria_refactor.backend_api.models import models

def fix_costs():
    db = SessionLocal()
    try:
        print("🛠️  Fixing Product Costs (Setting Cost = 70% of Price)...")
        products = db.query(models.Product).all()
        
        count = 0
        for p in products:
            # If cost is 0, estimate it from price
            if p.cost_price == 0 and p.price > 0:
                estimated_cost = p.price * Decimal("0.70")
                p.cost_price = estimated_cost
                print(f"  > Updated: {p.name} | Price: {p.price:.2f} -> Cost: {estimated_cost:.2f}")
                count += 1
        
        if count > 0:
            db.commit()
            print(f"✅ Updated {count} products with estimated costs.")
        else:
            print("👍 All products already have costs.")

    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    fix_costs()
