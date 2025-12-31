from sqlalchemy.orm import Session
from ferreteria_refactor.backend_api.database.db import SessionLocal, engine
from ferreteria_refactor.backend_api.models import models
import datetime

def seed_db():
    print("🌱 Seeding Cloud DB...")
    db = SessionLocal()
    
    try:
        # 1. Categories
        print("Creating Categories...")
        cat_general = models.Category(id=1, name="General", description="Artículos Varios")
        cat_tools = models.Category(id=2, name="Herramientas", description="Martillos, Taladros, etc")
        
        # Check if exists
        if not db.query(models.Category).filter_by(id=1).first():
            db.add(cat_general)
        if not db.query(models.Category).filter_by(id=2).first():
            db.add(cat_tools)
            
        # 2. Products (Clean up bad data first maybe? No, let's just add new ones)
        # We will add a test product that is DEFINITELY valid
        print("Creating Test Product...")
        
        # Ensure rate 1 exists (USD)
        rate_usd = db.query(models.ExchangeRate).filter_by(id=1).first()
        if not rate_usd:
            rate_usd = models.ExchangeRate(id=1, name="USD Default", currency_code="USD", currency_symbol="$", rate=1, is_default=True, is_active=True)
            db.add(rate_usd)
            
        valid_product = models.Product(
            name="Taladro Percutor Test",
            description="Producto de prueba insertado vía script",
            price=150.00,
            stock=10.0,
            category_id=2, # Herramientas
            exchange_rate_id=1, # USD
            is_active=True, # Python boolean ends up as 1 in SQLite
            image_url=None
        )
        
        # Check duplication by name
        if not db.query(models.Product).filter_by(name="Taladro Percutor Test").first():
            db.add(valid_product)
            
        db.commit()
        print("✅ Data seeded successfully! Now press Sync.")
        
    except Exception as e:
        print(f"❌ Error seeding: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    # Ensure tables exist
    models.Base.metadata.create_all(bind=engine)
    seed_db()
