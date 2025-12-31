
import sys
import os
import random

# Add parent directory to path to allow importing modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend_api.database.db import SessionLocal, engine
from backend_api.models import models
from backend_api.security import get_password_hash
from backend_api.database.db import Base

def seed_data():
    # CREATE ALL TABLES FIRST
    print("🔧 Creating database tables...")
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Tables created successfully!")
    except Exception as e:
        print(f"⚠️ Error creating tables: {e}")
        print("Continuing with seed data...")
    
    db = SessionLocal()
    try:
        print("🌱 Seeding database...")

        # 1. Users
        print("Creating Users...")
        users = [
            {"username": "admin", "password": "123", "role": models.UserRole.ADMIN, "pin_code": "1234"},
            {"username": "cajero", "password": "123", "role": models.UserRole.CASHIER, "pin_code": "0000"},
            {"username": "almacen", "password": "123", "role": models.UserRole.WAREHOUSE, "pin_code": "1111"},
        ]
        
        for u in users:
            existing = db.query(models.User).filter(models.User.username == u["username"]).first()
            if not existing:
                user = models.User(
                    username=u["username"],
                    password_hash=get_password_hash(u["password"]),
                    role=u["role"],
                    pin=u["pin_code"],
                    is_active=True
                )
                db.add(user)
        db.commit()

        # 2. Currencies & Exchange Rates
        print("Creating Currencies & Rates...")
        currencies = [
            {"code": "USD", "name": "Dólar", "symbol": "$", "is_anchor": True, "rate": 1.0},
            {"code": "VES", "name": "Bolívar", "symbol": "Bs", "is_anchor": False, "rate": 50.0},
            {"code": "EUR", "name": "Euro", "symbol": "€", "is_anchor": False, "rate": 0.92},
        ]
        
        rates_map = {} # To store rate IDs
        
        for c in currencies:
            # Check or Create Rate (Assuming ExchangeRate table holds currency info now based on recent refactors)
            # Logic: We create an ExchangeRate entry
            
            # Deactivate old ones if we were strict, but let's just create/get
            existing = db.query(models.ExchangeRate).filter(
                models.ExchangeRate.currency_code == c["code"],
                models.ExchangeRate.name == ("Tasa Oficial" if not c["is_anchor"] else "Base")
            ).first()
            
            if not existing:
                rate = models.ExchangeRate(
                    name="Tasa Oficial" if not c["is_anchor"] else "Base",
                    currency_code=c["code"],
                    currency_symbol=c["symbol"],
                    rate=c["rate"],
                    is_active=True,
                    is_default=True # Simplification
                )
                db.add(rate)
                db.flush()
                rates_map[c["code"]] = rate.id
            else:
                rates_map[c["code"]] = existing.id
        db.commit()

        # 3. Categories
        print("Creating Categories...")
        categories = ["Herramientas Manuales", "Herramientas Eléctricas", "Plomería", "Electricidad", "Pinturas", "Jardinería", "Seguridad"]
        cat_objs = []
        for cat_name in categories:
            cat = db.query(models.Category).filter(models.Category.name == cat_name).first()
            if not cat:
                cat = models.Category(name=cat_name, description=f"Productos de {cat_name}")
                db.add(cat)
                db.flush()
            cat_objs.append(cat)
        db.commit()

        # 4. Suppliers
        print("Creating Suppliers...")
        suppliers_data = [
            {"name": "FerreTodo Import", "email": "contacto@ferretodo.com", "phone": "555-0101"},
            {"name": "Materiales Los Andes", "email": "ventas@losandes.com", "phone": "555-0202"},
            {"name": "Distribuidora El Constructor", "email": "info@constructor.com", "phone": "555-0303"},
        ]
        suppliers = []
        for s in suppliers_data:
            sup = db.query(models.Supplier).filter(models.Supplier.name == s["name"]).first()
            if not sup:
                sup = models.Supplier(
                    name=s["name"], 
                    email=s["email"], 
                    phone=s["phone"],
                    address="Zona Industrial",
                    payment_terms=30
                )
                db.add(sup)
                db.flush()
            suppliers.append(sup)
        db.commit()

        # 5. Products
        print("Creating Products...")
        # Helper to pick random category/supplier
        
        products_data = [
            # Herramientas Manuales
            {"name": "Martillo de Uña 16oz", "price": 12.50, "cat_idx": 0, "stock": 50},
            {"name": "Destornillador Phillips #2", "price": 4.50, "cat_idx": 0, "stock": 100},
            {"name": "Llave Inglesa 10\"", "price": 15.00, "cat_idx": 0, "stock": 30},
            
            # Eléctricas
            {"name": "Taladro Percutor 650W", "price": 85.00, "cat_idx": 1, "stock": 15},
            {"name": "Esmeril Angular 4-1/2\"", "price": 65.00, "cat_idx": 1, "stock": 20},
            
            # Plomería
            {"name": "Tubo PVC 1/2\" x 3m", "price": 3.80, "cat_idx": 2, "stock": 200},
            {"name": "Codo PVC 1/2\"", "price": 0.50, "cat_idx": 2, "stock": 500},
            {"name": "Pegamento PVC 1/4 Gal", "price": 8.50, "cat_idx": 2, "stock": 40},
            
            # Electricidad
            {"name": "Cable THW #12 (Metro)", "price": 0.85, "cat_idx": 3, "stock": 5000}, # Base unit: Metro
            {"name": "Interruptor Sencillo", "price": 2.50, "cat_idx": 3, "stock": 80},
            {"name": "Tomacorriente Doble", "price": 3.20, "cat_idx": 3, "stock": 80},
            {"name": "Bombillo LED 9W", "price": 1.50, "cat_idx": 3, "stock": 150},
            
            # Pinturas
            {"name": "Pintura Caucho Blanco 1 Gal", "price": 25.00, "cat_idx": 4, "stock": 25},
            {"name": "Brocha 2\"", "price": 2.20, "cat_idx": 4, "stock": 60},
            
            # Tornillería (Unidades compuestas)
            {"name": "Tornillo Drywall 1\" (Unidad)", "price": 0.02, "cat_idx": 0, "stock": 10000},
        ]

        for p_data in products_data:
            prod = db.query(models.Product).filter(models.Product.name == p_data["name"]).first()
            if not prod:
                rate_id = rates_map["USD"] # Default to USD rate
                
                prod = models.Product(
                    name=p_data["name"],
                    description="Producto de prueba generado automáticamente",
                    price=p_data["price"],
                    stock=p_data["stock"],
                    min_stock=5,
                    sku=f"SKU-{random.randint(1000, 9999)}",
                    is_active=True,
                    category_id=cat_objs[p_data["cat_idx"]].id,
                    supplier_id=random.choice(suppliers).id,
                    exchange_rate_id=rate_id
                )
                db.add(prod)
                db.flush()
                
                # Special Units Logic
                if "Cable" in prod.name:
                    # Unit: Rollo 100m
                    rollo = models.ProductUnit(
                        product_id=prod.id,
                        unit_name="Rollo 100m",
                        conversion_factor=100,
                        barcode=f"ROLLO-{prod.sku}",
                        price_usd=prod.price * 100 * 0.9 # 10% discount for roll
                    )
                    db.add(rollo)
                
                if "Tornillo" in prod.name:
                    # Unit: Caja 100
                    caja = models.ProductUnit(
                        product_id=prod.id,
                        unit_name="Caja x100",
                        conversion_factor=100,
                        barcode=f"BOX-{prod.sku}",
                        price_usd=prod.price * 100 * 0.8 # 20% discount
                    )
                    db.add(caja)

        db.commit()
        
        # 6. Customers
        print("Creating Customers...")
        customers_data = [
            {"name": "Cliente Casual", "dni": "V-0000000", "limit": 0, "term": 0},
            {"name": "Constructora Venecia", "dni": "J-30505050", "limit": 1000, "term": 15},
            {"name": "Ferretero Local", "dni": "V-12345678", "limit": 500, "term": 7},
        ]
        
        for c in customers_data:
            cust = db.query(models.Customer).filter(models.Customer.id_number == c["dni"]).first()
            if not cust:
                cust = models.Customer(
                    name=c["name"],
                    id_number=c["dni"],
                    email=f"cliente{random.randint(1,100)}@mail.com",
                    phone="555-0000",
                    address="Ciudad",
                    credit_limit=c["limit"],
                    payment_term_days=c["term"]
                )
                db.add(cust)
        db.commit()

        print("✅ Seed Data Inserted Successfully!")

    except Exception as e:
        print(f"❌ Error seeding data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
