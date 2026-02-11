from sqlalchemy.orm import Session
from sqlalchemy import text
from ..models.models import Currency, PaymentMethod, Warehouse

def seed_tenant_data(db: Session, schema: str):
    """
    Seeds initial data for a new tenant schema.
    Assumes the schema and tables already exist.
    """
    print(f"🌱 [SEED] Seeding data for schema: {schema}")
    
    try:
        # 1. Set Search Path to Tenant Schema
        db.execute(text(f'SET search_path TO "{schema}", public'))
        
        # 2. Seed Currencies
        if db.query(Currency).count() == 0:
            currencies = [
                # Base Currency (USD, Anchor = Yes, Rate = 1.00)
                Currency(name="Dólar Estadounidense", symbol="$", rate=1.00, is_anchor=True, is_active=True),
                # Secondary Currency (VES, Anchor = No, Rate = 60.00 default)
                Currency(name="Bolívar Venezolano", symbol="Bs.", rate=60.00, is_anchor=False, is_active=True)
            ]
            db.add_all(currencies)
            print("   ✅ Currencies staged")
            
        # 3. Seed Payment Methods
        if db.query(PaymentMethod).count() == 0:
            methods = [
                # Name, Active, Requires Reference, Is System
                PaymentMethod(name="Efectivo (USD)", is_active=True, requires_reference=False, is_system=True),
                PaymentMethod(name="Efectivo (VES)", is_active=True, requires_reference=False, is_system=True),
                PaymentMethod(name="Punto de Venta", is_active=True, requires_reference=True, is_system=True),
                PaymentMethod(name="Pago Móvil", is_active=True, requires_reference=True, is_system=True),
                PaymentMethod(name="Zelle", is_active=True, requires_reference=True, is_system=True),
                PaymentMethod(name="Biopago", is_active=True, requires_reference=False, is_system=True)
            ]
            db.add_all(methods)
            print("   ✅ Payment Methods staged")

        # 4. Seed Default Warehouse
        if db.query(Warehouse).count() == 0:
            main_warehouse = Warehouse(
                name="Tienda Principal",
                address="Dirección Principal",
                is_active=True
            )
            db.add(main_warehouse)
            print("   ✅ Default Warehouse staged")
            
        # 5. COMMIT EVERYTHING ONCE
        db.commit()
        print("   ✅ ALL Tenant Data Seeded & Committed")

    except Exception as e:
        db.rollback()
        print(f"❌ [SEED] Error seeding data: {e}")
        raise e
    finally:
        # Always reset search path to public to avoid side effects
        db.execute(text("SET search_path TO public"))
