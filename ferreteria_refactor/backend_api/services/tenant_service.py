import os
import subprocess
import logging
import re
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from backend_api.config import settings
from backend_api.models.tenant import Tenant
from backend_api.models.models import User, UserRole
from backend_api.security import get_password_hash

# Logger
logger = logging.getLogger(__name__)

# Database Connection (Public/System)
engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

class TenantService:
    
    @staticmethod
    def slugify_schema_name(name: str) -> str:
        """Convert 'My Company' to 'tenant_my_company'"""
        slug = name.lower().strip()
        slug = re.sub(r'[^a-z0-9]', '_', slug)
        slug = re.sub(r'_+', '_', slug)
        return f"tenant_{slug}"

    @staticmethod
    def create_tenant(name: str, schema_name: str, admin_email: str, admin_password: str, plan_type: str = "FERRETERIA"):
        """
        Orchestrates full tenant creation:
        1. DB Registration
        2. Schema Creation
        3. Migrations
        4. Admin User Seeding
        """
        logger.info(f"🏗️  TenantService: Creating Tenant '{name}' ({schema_name})")
        db = SessionLocal()
        
        try:
            # 1. Check if exists
            existing = db.query(Tenant).filter(Tenant.schema_name == schema_name).first()
            if existing:
                raise ValueError(f"El ID de empresa '{schema_name}' ya existe. Por favor elija otro.")
            
            # Determine Config based on Plan
            config = {
                "modules": {
                    "restaurant": False,
                    "laundry": False,
                    "services": False,
                    "ferreteria": True
                }
            }
            
            if plan_type.upper() == "RESTAURANT":
                config["modules"]["restaurant"] = True
            elif plan_type.upper() == "LAUNDRY":
                config["modules"]["laundry"] = True
            elif plan_type.upper() == "SERVICES":
                config["modules"]["services"] = True
            elif plan_type.upper() == "FERRETERIA":
                # User feedback: Ferreteria should be pure Retail (No Technical Services by default)
                # config["modules"]["services"] = True
                pass
            
            # 2. Register in public.tenants
            new_tenant = Tenant(
                name=name, 
                schema_name=schema_name, 
                domain=None, 
                config=config
            )
            db.add(new_tenant)
            db.commit()
            logger.info("✅ Tenant registered in DB.")
            
            # 3. Create Schema (Postgres Only)
            if "sqlite" in str(settings.DATABASE_URL):
                 logger.warning("⚠️  [SQLite] Skipping CREATE SCHEMA (Not supported).")
            else:
                with engine.connect() as conn:
                    conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema_name}"))
                    conn.commit()
                    logger.info(f"✅ Schema '{schema_name}' created.")

            # 4. Run Migrations
            if "sqlite" not in str(settings.DATABASE_URL):
                TenantService.run_alembic(schema_name)

            # 5. Seed Admin User
            TenantService.seed_tenant_admin(schema_name, admin_email, admin_password, name)
            
            # 6. Seed Exchange Rates (PREVENT EMPTY DB BUG)
            TenantService.seed_exchange_rates(schema_name)

            # 7. Seed Payment Methods (User Request)
            TenantService.seed_payment_methods(schema_name)

            # 8. Seed Currencies (Fix for New Tenant Cash Session)
            TenantService.seed_currencies(schema_name)
            
            # 9. Seed Default Warehouse (User Request: "Almacen1")
            TenantService.seed_tenant_warehouse(schema_name)

            return {
                "status": "success",
                "tenant_id": schema_name,
                "message": "Tenant created successfully"
            }

        except Exception as e:
            logger.error(f"❌ Error creating tenant: {e}")
            db.rollback()
            raise e
        finally:
            db.close()

    @staticmethod
    def run_alembic(schema_name):
        """Run alembic upgrade head for a specific schema"""
        logger.info(f"🔄 [ALEMBIC] Migrating schema: {schema_name}...")
        
        # Determine project root (assuming we run from backend_api or root)
        # Safe bet: We expect to be running from root in uvicorn
        cwd = os.getcwd() 
        
        cmd = [
            "alembic",
            "-x", f"tenant={schema_name}",
            "upgrade", "head"
        ]
        
        # Execute
        result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
        
        if result.returncode != 0:
            logger.error(f"❌ Migration FAILED for {schema_name}\nSTDOUT: {result.stdout}\nSTDERR: {result.stderr}")
            raise RuntimeError(f"Migration failed: {result.stderr}")
        
        logger.info(f"✅ Migration OK for {schema_name}")
        return True

    @staticmethod
    def seed_tenant_admin(schema_name: str, email: str, password: str, tenant_name: str):
        """Seed initial admin user for the tenant"""
        logger.info(f"🌱 Seeding Admin User for: {schema_name}")
        db = SessionLocal()
        try:
            # Set Schema for Postgres
            if "sqlite" not in str(settings.DATABASE_URL):
                db.execute(text(f"SET search_path TO {schema_name}, public"))
                
            # Check if admin exists
            existing_admin = db.query(User).filter(User.username == "admin").first()
            if existing_admin:
                 logger.info(f"⚠️  Admin user already exists in {schema_name}.")
                 return

            # Create Admin
            admin_user = User(
                username="admin",
                password_hash=get_password_hash(password),
                role=UserRole.ADMIN,
                is_active=True,
                full_name=f"Admin {tenant_name}"
            )
            
            db.add(admin_user)
            db.commit()
            logger.info(f"✅ Admin user created.")
            
        except Exception as e:
            logger.error(f"❌ Error seeding admin: {e}")
            db.rollback()
            raise e
        finally:
            db.close()

    @staticmethod
    def seed_exchange_rates(schema_name: str):
        """Seed default exchange rates to avoid empty state"""
        from backend_api.models.models import ExchangeRate
        
        logger.info(f"💱 Seeding Exchange Rates for: {schema_name}")
        db = SessionLocal()
        try:
            if "sqlite" not in str(settings.DATABASE_URL):
                db.execute(text(f"SET search_path TO {schema_name}, public"))
            
            if db.query(ExchangeRate).first():
                logger.info("skipped, already seeded")
                return

            # REFINED DEFAULTS per User Request:
            # No USD default (implied base). No COP default.
            # Only Venezuelan essentials.
            default_rates = [
                # ExchangeRate(name="USD Default", currency_code="USD", currency_symbol="$", rate=1.00, is_default=True, is_active=True), # REMOVED
                ExchangeRate(name="BCV", currency_code="VES", currency_symbol="Bs", rate=45.00, is_default=True, is_active=True),
                ExchangeRate(name="Paralelo", currency_code="VES", currency_symbol="Bs", rate=52.00, is_default=False, is_active=True),
                # ExchangeRate(name="COP", currency_code="COP", currency_symbol="COP", rate=4200.00, is_default=True, is_active=True), # REMOVED
            ]
            for r in default_rates:
                db.add(r)
            db.commit()
            logger.info("✅ Exchange Rates seeded.")
        except Exception as e:
            logger.error(f"❌ Error seeding rates: {e}")
            db.rollback()
        finally:
            db.close()

    @staticmethod
    def seed_payment_methods(schema_name: str):
        """Seed default payment methods (Efectivo, Pago Movil, Zelle, Punto)"""
        from backend_api.models.models import PaymentMethod
        
        logger.info(f"💳 Seeding Payment Methods for: {schema_name}")
        db = SessionLocal()
        try:
            if "sqlite" not in str(settings.DATABASE_URL):
                db.execute(text(f"SET search_path TO {schema_name}, public"))
            
            if db.query(PaymentMethod).first():
                logger.info("skipped, already seeded")
                return

            methods = [
                PaymentMethod(name="Efectivo", is_active=True, is_system=True),
                PaymentMethod(name="Pago Móvil", is_active=True, is_system=True),
                PaymentMethod(name="Zelle", is_active=True, is_system=True),
                PaymentMethod(name="Punto de Venta", is_active=True, is_system=True),
                PaymentMethod(name="Transferencia", is_active=True, is_system=True),
            ]
            for m in methods:
                db.add(m)
            db.commit()
            logger.info("✅ Payment Methods seeded.")
        except Exception as e:
            logger.error(f"❌ Error seeding payment methods: {e}")
            db.rollback()
        finally:
            db.close()

    @staticmethod
    def seed_tenant_warehouse(schema_name: str):
        """Seed default main warehouse 'Almacen1'"""
        from backend_api.models.models import Warehouse
        
        logger.info(f"🏭 Seeding Default Warehouse for: {schema_name}")
        db = SessionLocal()
        try:
            if "sqlite" not in str(settings.DATABASE_URL):
                db.execute(text(f"SET search_path TO {schema_name}, public"))
            
            # Check if any warehouse exists
            if db.query(Warehouse).count() > 0:
                 logger.info("skipped, warehouse already exists")
                 return
            
            default_wh = Warehouse(
                name="Almacen1",
                address="Dirección Principal",
                is_active=True,
                is_main=True
            )
            db.add(default_wh)
            db.commit()
            logger.info("✅ Default Warehouse 'Almacen1' created.")
            
        except Exception as e:
            logger.error(f"❌ Error seeding warehouse: {e}")
            db.rollback()
        finally:
            db.close()

    @staticmethod
    def seed_currencies(schema_name: str):
        """Seed default currencies for new tenant"""
        from backend_api.models.models import Currency
        
        logger.info(f"💵 Seeding Currencies for: {schema_name}")
        db = SessionLocal()
        try:
            if "sqlite" not in str(settings.DATABASE_URL):
                db.execute(text(f"SET search_path TO {schema_name}, public"))
            
            if db.query(Currency).count() > 0:
                 logger.info("skipped, currencies already exist")
                 return
            
            # Use same robust list as config.py
            currencies_data = [
                {"name": "Dólar Americano", "symbol": "USD", "rate": 1.00, "is_anchor": True, "is_active": True},
                {"name": "Bolívar Venezolano", "symbol": "VES", "rate": 60.00, "is_anchor": False, "is_active": True},
                {"name": "Peso Colombiano", "symbol": "COP", "rate": 4200.00, "is_anchor": False, "is_active": True},
            ]
            
            for curr in currencies_data:
                db.add(Currency(**curr))
            
            db.commit()
            logger.info("✅ Currencies seeded.")
            
        except Exception as e:
            logger.error(f"❌ Error seeding currencies: {e}")
            db.rollback()
        finally:
            db.close()
