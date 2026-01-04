import sys
import os
sys.path.append(os.getcwd())

from backend_api.models import models
from backend_api.database.db import SessionLocal

db = SessionLocal()
try:
    print("Fixing Null values in ServiceOrderDetail...")
    details = db.query(models.ServiceOrderDetail).all()
    count = 0
    for d in details:
        changed = False
        # Fix is_manual
        if d.is_manual is None:
            d.is_manual = False
            changed = True
            
        # Fix description
        if not d.description and d.product_id:
            # Fetch product name
            product = db.query(models.Product).get(d.product_id)
            if product:
                d.description = product.name
                changed = True
        
        if changed:
            count += 1
            
    if count > 0:
        db.commit()
        print(f"Updated {count} records.")
    else:
        print("No records needed updating.")
        
except Exception as e:
    import traceback
    traceback.print_exc()
    db.rollback()
finally:
    db.close()
