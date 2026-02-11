import random
from datetime import timedelta
from decimal import Decimal
from faker import Faker
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..models.models import Category, Product, Customer, Sale, SaleDetail, Warehouse
from ..models.tenant import Tenant
from ..tenant_context import set_tenant_schema, reset_tenant_schema
from ..utils.time_utils import get_venezuela_now

fake = Faker(['es_ES'])

# Static data dictionaries
HARDWARE_ITEMS = [
    {"name": "Martillo de Uña Professional", "price": 12.50, "category": "Herramientas"},
    {"name": "Taladro Percutor 1/2pulg", "price": 45.00, "category": "Herramientas Eléctricas"},
    {"name": "Saco Cemento Gris 42kg", "price": 8.50, "category": "Construcción"},
    {"name": "Tubo PVC 4pulg x 6m", "price": 15.00, "category": "Plomería"},
    {"name": "Bombillo LED 12W 6500K", "price": 2.25, "category": "Electricidad"},
    {"name": "Pala Punta de Huevo", "price": 18.00, "category": "Construcción"},
    {"name": "Cerradura de Pomo Acero", "price": 10.50, "category": "Cerrajería"},
]

RETAIL_ITEMS = [
    {"name": "Coca Cola 1.5L", "price": 2.00, "category": "Bebidas"},
    {"name": "Harina Pan 1kg", "price": 1.40, "category": "Alimentos"},
    {"name": "Arroz Primor Clasico 1kg", "price": 1.50, "category": "Alimentos"},
    {"name": "Jabón en Polvo Las Llaves 400g", "price": 1.80, "category": "Limpieza"},
    {"name": "Aceite Vegetal 1L", "price": 3.20, "category": "Alimentos"},
]

LAUNDRY_SERVICES = [
    {"name": "Lavado Edredón King", "price": 15.00, "category": "Servicios"},
    {"name": "Secado por Cesta (L)", "price": 5.00, "category": "Servicios"},
    {"name": "Planchado Camisa", "price": 2.50, "category": "Servicios"},
    {"name": "Tintorería Traje Completo", "price": 12.00, "category": "Servicios"},
    {"name": "Lavado de Alfombra (m2)", "price": 8.00, "category": "Servicios"},
]

def seed_tenant_data(db: Session, tenant_id: int):
    # 1. Load Tenant from public schema
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise ValueError(f"Tenant with ID {tenant_id} not found")

    # 2. Set search path to tenant's schema
    # We must do this at the DB level for this specific session
    db.execute(text(f'SET search_path TO "{tenant.schema_name}", public'))
    set_tenant_schema(tenant.schema_name)
    
    try:
        # 3. Create a Default Warehouse if none exists
        warehouse = db.query(Warehouse).filter(Warehouse.is_main == True).first()
        if not warehouse:
            warehouse = Warehouse(name="Almacén Principal", is_main=True, is_active=True)
            db.add(warehouse)
            db.flush()

        # 4. Inject Categories and Products
        item_list = []
        if tenant.has_hardware_module:
            item_list.extend(HARDWARE_ITEMS)
            item_list.extend(RETAIL_ITEMS)
        
        if tenant.has_laundry_module:
            item_list.extend(LAUNDRY_SERVICES)
            
        # Deduplicate categories
        cat_names = list(set([item["category"] for item in item_list]))
        categories = {}
        for name in cat_names:
            existing_cat = db.query(Category).filter(Category.name == name).first()
            if not existing_cat:
                cat = Category(name=name)
                db.add(cat)
                db.flush()
                categories[name] = cat
            else:
                categories[name] = existing_cat

        # Inject Products
        products = []
        for item in item_list:
            existing_prod = db.query(Product).filter(Product.name == item["name"]).first()
            if not existing_prod:
                is_service = item["category"] == "Servicios"
                prod = Product(
                    name=item["name"],
                    price=Decimal(str(item["price"])),
                    cost_price=Decimal(str(item["price"] * 0.7)), # 30% margin approx
                    stock=Decimal("100.000") if not is_service else Decimal("0.000"),
                    is_service=is_service,
                    category_id=categories[item["category"]].id,
                    is_active=True
                )
                db.add(prod)
                products.append(prod)
            else:
                products.append(existing_prod)
        db.flush()

        # 5. Create 10 Fictitious Customers
        customers = []
        for _ in range(10):
            customer = Customer(
                name=fake.name(),
                email=fake.email(),
                phone=fake.phone_number(),
                id_number=str(random.randint(1000000, 30000000)),
                address=fake.address()
            )
            db.add(customer)
            customers.append(customer)
        db.flush()

        # 6. Create 15 Sales in the last 30 days
        now = get_venezuela_now()
        for _ in range(15):
            days_ago = random.randint(0, 30)
            sale_date = now - timedelta(days=days_ago, hours=random.randint(0, 23))
            
            # Select 1-3 random products for the sale
            sale_prods = random.sample(products, random.randint(1, 3))
            total = Decimal("0.00")
            
            sale = Sale(
                date=sale_date,
                total_amount=Decimal("0.00"), # Will update
                payment_method=random.choice(["Efectivo", "Pago Móvil", "Zelle", "Tarjeta"]),
                customer_id=random.choice(customers).id if random.random() > 0.3 else None,
                warehouse_id=warehouse.id
            )
            db.add(sale)
            db.flush()
            
            for prod in sale_prods:
                qty = Decimal(str(random.randint(1, 5)))
                detail_total = prod.price * qty
                detail = SaleDetail(
                    sale_id=sale.id,
                    product_id=prod.id,
                    quantity=qty,
                    unit_price=prod.price,
                    subtotal=detail_total,
                    cost_at_sale=prod.cost_price
                )
                db.add(detail)
                total += detail_total
            
            sale.total_amount = total
            
        db.commit()
        return {"status": "success", "message": f"Seeded {len(products)} products, 10 customers, and 15 sales."}

    except Exception as e:
        db.rollback()
        raise e
    finally:
        # IMPORTANT: Reset schema after work is done
        db.execute(text("SET search_path TO public"))
        reset_tenant_schema()
