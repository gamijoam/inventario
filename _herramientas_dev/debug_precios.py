import sys
import os

# Añadir el directorio raíz al path para poder importar módulos
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ferreteria_refactor.backend_api.database.db import SessionLocal
from ferreteria_refactor.backend_api.models import models

def check_prices():
    try:
        db = SessionLocal()
        products = db.query(models.Product).filter(models.Product.is_active==True).limit(10).all()
        
        print("\n--- DEBUG PRECIOS ---")
        for p in products:
            print(f"ID: {p.id} | Name: {p.name} | Cost: {p.cost_price} (Type: {type(p.cost_price)}) | Price: {p.price}")
        print("---------------------\n")
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    check_prices()
