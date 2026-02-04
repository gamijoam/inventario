from backend_api.database.db import SessionLocal
from backend_api.models import models
from decimal import Decimal

def create_laundry_prod():
    db = SessionLocal()
    try:
        # Check if exists
        existing = db.query(models.Product).filter(models.Product.name.ilike('%Lavado%')).first()
        if existing:
            print(f"Product already exists: {existing.name} (ID: {existing.id})")
            return

        # Create
        new_prod = models.Product(
            name="Servicio de Lavado",
            description="Lavado por Kilo (Ropa General)",
            price=Decimal("2.50"),
            cost_price=Decimal("0.50"),
            stock=Decimal("10000.00"), # Service doesn't really have stock, but keep high
            min_stock=Decimal("0.00"),
            unit_type="Kilo",
            is_active=True,
            sku="LAV-001"
        )
        db.add(new_prod)
        db.commit()
        print(f"Created 'Servicio de Lavado' with Price $2.50")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_laundry_prod()
