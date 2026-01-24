from backend_api.database.db import SessionLocal
from backend_api.models import models

def clean_laundry_orders():
    db = SessionLocal()
    try:
        # Find bad laundry orders
        orders = db.query(models.ServiceOrder).filter(models.ServiceOrder.service_type == 'LAUNDRY').all()
        count = len(orders)
        
        for order in orders:
            # Delete related details first if any (cascade handled by ORM usually but forced here for safety)
            db.query(models.ServiceOrderDetail).filter(models.ServiceOrderDetail.service_order_id == order.id).delete()
            db.delete(order)
            
        db.commit()
        print(f"Deleted {count} laundry orders.")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    clean_laundry_orders()
