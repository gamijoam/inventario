import sys
import os

# Add parent directory to path to allow imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ferreteria_refactor.backend_api.database.db import SessionLocal
from ferreteria_refactor.backend_api.models.restaurant import RestaurantTable, TableStatusDB
# Import models to ensure they are registered in Base.metadata for relationships
from ferreteria_refactor.backend_api.models.models import User, Product

def seed_tables():
    db = SessionLocal()
    try:
        print("Checking existing tables...")
        count = db.query(RestaurantTable).count()
        if count > 0:
            print(f"Database already has {count} tables. Skipping seed.")
            return

        print("Seeding restaurant tables...")
        
        tables_data = [
            # Terraza
            {"name": "T-01", "zone": "Terraza", "capacity": 4},
            {"name": "T-02", "zone": "Terraza", "capacity": 4},
            {"name": "T-03", "zone": "Terraza", "capacity": 6},
            {"name": "T-04", "zone": "Terraza", "capacity": 2},
            
            # Salón Principal
            {"name": "S-01", "zone": "Salón", "capacity": 4},
            {"name": "S-02", "zone": "Salón", "capacity": 8},
            {"name": "S-03", "zone": "Salón", "capacity": 4},
            {"name": "S-04", "zone": "Salón", "capacity": 2},
            {"name": "VIP-1", "zone": "Salón", "capacity": 10},
            
            # Barra
            {"name": "B-01", "zone": "Barra", "capacity": 1},
            {"name": "B-02", "zone": "Barra", "capacity": 1},
            {"name": "B-03", "zone": "Barra", "capacity": 1},
        ]

        for t_data in tables_data:
            table = RestaurantTable(
                name=t_data["name"],
                zone=t_data["zone"],
                capacity=t_data["capacity"],
                status=TableStatusDB.AVAILABLE,
                is_active=True
            )
            db.add(table)
        
        db.commit()
        print(f"Successfully added {len(tables_data)} tables!")

    except Exception as e:
        print(f"Error seeding tables: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_tables()
