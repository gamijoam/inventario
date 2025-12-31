import sys
import os
import random

# Añadir root al path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ferreteria_refactor.backend_api.database.db import SessionLocal
from ferreteria_refactor.backend_api.models import models

def test_insert():
    print("--- Probando Insercion en SQLite ---")
    db = SessionLocal()
    try:
        # Crear un producto dummy
        sku = f"TEST-{random.randint(1000, 9999)}"
        p = models.Product(
            name=f"Producto Test {sku}",
            sku=sku,
            price=10.0,
            cost_price=5.0,
            stock=100,
            is_active=True
        )
        db.add(p)
        print("Intentando commit...")
        db.commit()
        db.refresh(p)
        print(f"EXITO: Producto creado con ID {p.id}")
        
        # Limpiar
        db.delete(p)
        db.commit()
        print("Limpieza completada.")
        
    except Exception as e:
        print(f"FALLO: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_insert()
