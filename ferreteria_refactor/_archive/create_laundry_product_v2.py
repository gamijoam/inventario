from backend_api.database.db import SessionLocal
from backend_api.models import models
from sqlalchemy import text
from decimal import Decimal

def fix_and_create():
    db = SessionLocal()
    try:
        # 1. FIX SEQUENCE (Postgres specific)
        print("Fixing product ID sequence...")
        try:
            # Try standard naming convention for serial sequence
            db.execute(text("SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));"))
            db.commit()
            print("Sequence fixed.")
        except Exception as e:
            print(f"Sequence fix warning (might be different DB type or name): {e}")
            db.rollback()

        # 2. Check if exists
        existing = db.query(models.Product).filter(models.Product.name.ilike('%Lavado%')).first()
        if existing:
            print(f"Product already exists: {existing.name} (ID: {existing.id})")
            return

        # 3. Create
        new_prod = models.Product(
            name="Servicio de Lavado",
            description="Lavado por Kilo (Ropa General)",
            price=Decimal("2.50"),
            cost_price=Decimal("0.50"),
            stock=Decimal("10000.00"), 
            min_stock=Decimal("0.00"),
            unit_type="Kilo",
            is_active=True,
            sku="LAV-001"
        )
        db.add(new_prod)
        db.commit()
        print(f"Created 'Servicio de Lavado' with Price $2.50 (ID: {new_prod.id})")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    fix_and_create()
