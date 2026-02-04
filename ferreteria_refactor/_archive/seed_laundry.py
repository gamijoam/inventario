import random
from datetime import datetime, timedelta
from backend_api.database.db import SessionLocal
from backend_api.models.models import ServiceOrder, Customer, ServiceOrderStatus
# Assuming standard structure, adjust imports if needed

def seed_laundry():
    db = SessionLocal()
    try:
        # Get a customer
        customer = db.query(Customer).first()
        if not customer:
            print("No customer found. Creating one...")
            customer = Customer(name="Cliente Prueba", phone="555-0000", id_number="V-12345678", email="test@example.com")
            db.add(customer)
            db.commit()
            db.refresh(customer)
        
        print(f"Using customer: {customer.name} (ID: {customer.id})")

        # Define test cases
        test_orders = [
            {
                "status": "RECEIVED",
                "days_ago": 4, 
                "desc": "Ropa muy sucia, atrasada 4 días",
                "type": "General",
                "bag": "Rojo #01"
            },
            {
                "status": "IN_PROGRESS",
                "days_ago": 3, 
                "desc": "Lavando Edredones, atrasado 3 días",
                "type": "Edredones",
                "bag": "Azul #99"
            },
            {
                "status": "RECEIVED",
                "days_ago": 0, 
                "desc": "Recién llegado hoy",
                "type": "Solo Planchado",
                "bag": "Verde #20"
            },
            {
                "status": "READY",
                "days_ago": 1, 
                "desc": "Listo para entregar (ayer)",
                "type": "Desmanchado",
                "bag": "Blanco #55"
            },
            {
                "status": "DELIVERED",
                "days_ago": 10, 
                "desc": "Entregado hace mucho (No debe salir late)",
                "type": "General",
                "bag": "Negro #11"
            }
        ]

        created_count = 0
        for case in test_orders:
            # Generate Ticket Number
            ticket = f"TEST-{random.randint(1000, 9999)}"
            
            created_at = datetime.now() - timedelta(days=case["days_ago"])
            
            order = ServiceOrder(
                customer_id=customer.id,
                ticket_number=ticket,
                service_type="LAUNDRY",
                priority="NORMAL",
                status=case["status"],
                device_type="ROPA",
                brand="GENERICA",
                model="LAVANDERIA",
                problem_description=case["desc"],
                physical_condition="Test seeding",
                created_at=created_at,
                updated_at=datetime.now(),
                order_metadata={
                    "weight_kg": round(random.uniform(1.0, 10.0), 2),
                    "pieces": random.randint(3, 15),
                    "bag_color": case["bag"],
                    "wash_type": case["type"]
                }
            )
            db.add(order)
            created_count += 1
        
        db.commit()
        print(f"Successfully seeded {created_count} Laundry orders.")
        print("Please refresh your dashboard.")

    except Exception as e:
        print(f"Error seeding: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_laundry()
