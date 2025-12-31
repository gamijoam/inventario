import sys
import os

# Set up path to import backend_api
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy.orm import Session
from backend_api.database.db import SessionLocal, engine
from backend_api.models import models

def migrate_stock():
    db = SessionLocal()
    try:
        # 1. Ensure Main Warehouse Exists
        main_warehouse = db.query(models.Warehouse).filter(models.Warehouse.is_main == True).first()
        if not main_warehouse:
            print("Creating Main Warehouse...")
            main_warehouse = models.Warehouse(
                name="Bodega Principal",
                address="Sede Central",
                is_main=True,
                is_active=True
            )
            db.add(main_warehouse)
            db.commit()
            db.refresh(main_warehouse)
        else:
            print(f"Main Warehouse found: {main_warehouse.name}")

        # 2. Iterate Products and Migrate Stock
        products = db.query(models.Product).all()
        count = 0
        skipped = 0
        
        for product in products:
            # Check if stock entry already exists
            existing_stock = db.query(models.ProductStock).filter(
                models.ProductStock.product_id == product.id,
                models.ProductStock.warehouse_id == main_warehouse.id
            ).first()

            if existing_stock:
                skipped += 1
                continue

            # Create Stock Entry
            new_stock = models.ProductStock(
                product_id=product.id,
                warehouse_id=main_warehouse.id,
                quantity=product.stock, # Copy from legacy field
                location=product.location # Copy from legacy field
            )
            db.add(new_stock)
            count += 1
        
        db.commit()
        print(f"Migration Complete. Migrated {count} products. Skipped {skipped} (already existed).")

    except Exception as e:
        print(f"Error during migration: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    migrate_stock()
