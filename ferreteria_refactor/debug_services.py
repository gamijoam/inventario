import sys
import os
# Add parent dir to path so we can import
sys.path.append(os.getcwd())

from backend_api.models import models
from backend_api.database.db import SessionLocal
from backend_api import schemas

db = SessionLocal()
try:
    print("Querying service orders...")
    orders = db.query(models.ServiceOrder).all()
    print(f"Found {len(orders)} orders.")
    
    for o in orders:
        print(f"Order {o.id}: {o.ticket_number}")
        print(f"Details count: {len(o.details)}")
        for d in o.details:
            print(f"  - Item: {d.description} (Manual: {d.is_manual}, Product: {d.product_id})")
            
except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    db.close()
