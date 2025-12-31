import sys
import os

# Ensure backend_api is in path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from ferreteria_refactor.backend_api.database.db import SessionLocal
from ferreteria_refactor.backend_api.models import models
from decimal import Decimal

def log(msg):
    print(f"🌱 {msg}")

def seed_data():
    db = SessionLocal()
    try:
        log("Starting Database Seeding...")

        # 1. CATEGORIES (Hierarchy)
        log("Creating Categories...")
        cats_data = [
            {"name": "Construcción", "parent": None},
            {"name": "Acabados", "parent": "Construcción"},
            {"name": "Herramientas", "parent": None},
            {"name": "Manuales", "parent": "Herramientas"},
            {"name": "Eléctricas", "parent": "Herramientas"},
            {"name": "Plomería", "parent": None},
        ]
        
        cat_map = {}
        for c in cats_data:
            existing = db.query(models.Category).filter_by(name=c["name"]).first()
            if not existing:
                parent_id = cat_map.get(c["parent"])
                new_cat = models.Category(name=c["name"], parent_id=parent_id)
                db.add(new_cat)
                db.commit()
                db.refresh(new_cat)
                cat_map[c["name"]] = new_cat.id
                log(f"  + Category: {c['name']}")
            else:
                cat_map[c["name"]] = existing.id
                log(f"  = Cat Exists: {c['name']}")

        # 2. PRODUCTS & UNITS
        log("Creating Products...")
        
        # Helper to get or create
        def create_product(data, units=[], combos=[]):
            existing = db.query(models.Product).filter_by(name=data["name"]).first()
            if existing:
                log(f"  = Product Exists: {data['name']}")
                return existing

            new_prod = models.Product(**data)
            db.add(new_prod)
            db.commit()
            db.refresh(new_prod)
            log(f"  + Product: {data['name']}")

            # Units
            for u in units:
                 unit_model = models.ProductUnit(
                     product_id=new_prod.id,
                     unit_name=u["name"],
                     conversion_factor=Decimal(str(u["factor"])),
                     barcode=u.get("barcode"),
                     price_usd=Decimal(str(u["price"])) if u.get("price") else None
                 )
                 db.add(unit_model)
                 log(f"    > Unit: {u['name']}")
            
            db.commit()
            return new_prod

        # Supply products
        p_cement = create_product({
            "name": "Cemento Gris Tipo I",
            "sku": "CEM-001",
            "price": Decimal("10.00"),
            "stock": Decimal("500.000"),
            "category_id": cat_map["Construcción"],
            "unit_type": "Saco"
        }) # No extra units, base is Saco

        p_sand = create_product({
            "name": "Arena Lavada",
            "sku": "ARE-LAV",
            "price": Decimal("35.00"), # Price per Metro Cubico
            "stock": Decimal("20.000"),
            "category_id": cat_map["Construcción"],
            "unit_type": "M3"
        }, units=[
            {"name": "Saco (20kg)", "factor": 0.02, "price": 1.50}, # 1m3 approx 1000kg -> 20kg = 0.02 m3? Rough logic for test
            {"name": "Camión (5m3)", "factor": 5.0, "price": 160.00}
        ])

        p_hammer = create_product({
            "name": "Martillo Carpintero 16oz",
            "sku": "HER-MAN-001",
            "price": Decimal("12.50"),
            "stock": Decimal("50.000"),
            "category_id": cat_map["Manuales"]
        })

        p_drill = create_product({
            "name": "Taladro Percutor 600W",
            "sku": "HER-ELE-001",
            "price": Decimal("65.00"),
            "stock": Decimal("15.000"),
            "category_id": cat_map["Eléctricas"]
        })
        
        # Check if COMBO Logic is supported (models check)
        # Combo: "Kit Básico Albañil" -> 1 Martillo + 1 Cemento + 1 Arena Saco
        # First ensure we have Saco unit for Arena
        
        log("Creating Combos...")
        existing_combo = db.query(models.Product).filter_by(name="Kit Básico Albañil").first()
        if not existing_combo:
            combo = models.Product(
                name="Kit Básico Albañil",
                sku="KIT-ALB-01",
                price=Decimal("22.00"), # Discounted price
                stock=Decimal("0.00"), # Virtual stock
                category_id=cat_map["Construcción"],
                is_combo=True
            )
            db.add(combo)
            db.commit()
            db.refresh(combo)
            
            # Add items
            # 1. Martillo
            db.add(models.ComboItem(parent_product_id=combo.id, child_product_id=p_hammer.id, quantity=1))
            # 2. Cemento (1 Saco)
            db.add(models.ComboItem(parent_product_id=combo.id, child_product_id=p_cement.id, quantity=1))
            # 3. Arena (1 Saco unit) - Need unit ID
            # Find unit
            arena_saco = db.query(models.ProductUnit).filter_by(product_id=p_sand.id, unit_name="Saco (20kg)").first()
            if arena_saco:
                db.add(models.ComboItem(parent_product_id=combo.id, child_product_id=p_sand.id, quantity=1, unit_id=arena_saco.id))
            
            db.commit()
            log("  + Combo Created: Kit Básico Albañil")
        else:
             log("  = Combo Exists")

        log("✅ Seeding Complete!")

    except Exception as e:
        log(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
