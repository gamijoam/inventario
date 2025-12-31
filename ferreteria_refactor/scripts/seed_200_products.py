
import sys
import os
import random

# Add parent directory to path so we can import backend_api modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend_api.database.db import SessionLocal
from backend_api.models import models

def create_bulk_products(n=200):
    db = SessionLocal()
    try:
        print(f"🚀 Iniciando creación de {n} productos de prueba...")
        
        # Get a category ID to assign (first one found)
        category = db.query(models.Category).first()
        category_id = category.id if category else None
        
        products_to_add = []
        for i in range(1, n + 1):
            # Usar un prefijo unico para evitar colisiones si se corre varias veces
            suffix = random.randint(10000, 99999) 
            
            product = models.Product(
                name=f"Producto Prueba {i} - {suffix}",
                sku=f"TEST-SKU-{i}-{suffix}",
                description="Producto generado automáticamente para pruebas de carga",
                price=random.uniform(10.0, 500.0),
                cost_price=random.uniform(5.0, 250.0),
                stock=random.randint(10, 1000),
                min_stock=5,
                unit_type="UNID",
                location=f"Pasillo {random.choice(['A','B','C'])}",
                category_id=category_id,
                is_active=True
            )
            products_to_add.append(product)
            
            # Batch commit every 50 to avoid huge memory usage if N is large
            if len(products_to_add) >= 50:
                db.add_all(products_to_add)
                db.commit()
                products_to_add = []
                print(f"✅ Progresio: {i}/{n} productos guardados...")

        # Add remaining
        if products_to_add:
            db.add_all(products_to_add)
            db.commit()
            
        print(f"✨ Éxito: {n} productos creados correctamente.")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_bulk_products(200)
