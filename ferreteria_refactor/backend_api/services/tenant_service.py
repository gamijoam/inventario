import os
import subprocess
import logging
import re
from sqlalchemy import text
from ..config import settings
from ..models.tenant import Tenant
from ..models.models import User, UserRole, Base # Import Base for reflection
from ..database.db import SessionLocal, engine # Import shared engine
from ..security import get_password_hash

# Logger
import traceback
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# REMOVED: Local engine creation to avoid duplicates
# engine = create_engine(settings.DATABASE_URL)
# SessionLocal = sessionmaker(bind=engine)

class TenantService:
    
    @staticmethod
    def slugify_schema_name(name: str) -> str:
        """Convert 'My Company' to 'my-company'"""
        slug = name.lower().strip()
        slug = re.sub(r'[^a-z0-9]', '-', slug) # Use dashes per user request
        slug = re.sub(r'-+', '-', slug)
        return slug.strip('-')

    @staticmethod
    def create_tenant(name: str, schema_name: str, admin_email: str, admin_password: str, plan_type: str = "FERRETERIA"):
        """
        Orchestrates full tenant creation (v30 Schema Reflection):
        1. DB Registration in public.tenants
        2. Schema Creation (Postgres)
        3. Provision Tables (Schema Reflection)
        4. Admin User Seeding
        """
        logger.info(f"🏗️  TenantService: Creating Tenant '{name}' ({schema_name})")
        db = SessionLocal()
        
        try:
            # 0. Check if Admin Email exists (Global Check)
            # This prevents the DuplicateKeyError (UniqueViolation) later in the process
            # and avoids creating "Zombie Tenants" with no admin.
            existing_user = db.query(User).filter(User.email == admin_email).first()
            if existing_user:
                raise ValueError(f"El correo electrónico '{admin_email}' ya se encuentra registrado. Por favor use otro.")
                
            # 1. Check if exists
            existing = db.query(Tenant).filter(Tenant.schema_name == schema_name).first()
            if existing:
                raise ValueError(f"El ID de empresa '{schema_name}' ya existe. Por favor elija otro.")
            
            # --- INTELIGENCIA DE SEGMENTACIÓN (Rubro -> Módulos) ---
            rubro_seleccionado = (plan_type or "Ferretería").upper()
            
            # Mapeo de Rubros a Módulos Internos
            # Default: Todo es Retail (Ferretería) a menos que se especifique lo contrario
            m_hardware = True
            m_restaurant = False
            m_laundry = False
            m_services = False
            m_barbershop = False
            
            # Segmentación por Palabras Clave
            # Restaurant
            if any(k in rubro_seleccionado for k in ["RESTAURANT", "COMIDA", "PIZZA", "CAFÉ", "CAFETERIA", "HELADO", "PANADER"]):
                m_restaurant = True
                m_hardware = False # Restaurantes usualmente no necesitan el módulo de ferretería puro
            
            # Laundry
            if any(k in rubro_seleccionado for k in ["LAVANDER", "TINTORER"]):
                m_laundry = True
                m_hardware = False
            
            # Services / Technical
            if any(k in rubro_seleccionado for k in ["TALLER", "SERVICIO", "REPARAC", "ELECTRÓNICA"]):
                m_services = True
            
            # Barbershop / Beauty
            if any(k in rubro_seleccionado for k in ["BARBER", "PELUQUER", "BELLEZA", "ESTÉTICA", "SPA"]):
                m_barbershop = True
            
            # Configuration dictionary for JSON config
            config = {
                "modules": {
                    "restaurant": m_restaurant,
                    "laundry": m_laundry,
                    "services": m_services,
                    "barbershop": m_barbershop,
                    "ferreteria": m_hardware
                }
            }
            
            # 2. Register in public.tenants (PRE-COMMIT)
            new_tenant = Tenant(
                name=name, 
                schema_name=schema_name, 
                domain=None, 
                config=config,
                business_type=plan_type or "Ferretería", # Store exact label
                has_restaurant_module=m_restaurant,
                has_laundry_module=m_laundry,
                has_services_module=m_services,
                has_barbershop_module=m_barbershop,
                has_hardware_module=m_hardware
            )
            db.add(new_tenant)
            
            # 3. Create Schema (Postgres Only) - ATOMIC STEP
            if "sqlite" in str(settings.DATABASE_URL):
                 logger.warning("⚠️  [SQLite] Skipping CREATE SCHEMA.")
            else:
                try:
                    logger.info(f"🏗️  Executing: CREATE SCHEMA \"{schema_name}\"")
                    db.execute(text(f'CREATE SCHEMA "{schema_name}"'))
                    logger.info(f"✅ Schema '{schema_name}' created.")
                except Exception as se:
                    logger.error(f"❌ FATAL ERROR: Failed to create schema '{schema_name}': {se}")
                    # Don't raise immediately if it exists, maybe we are retrying? case-by-case
                    # But for new registration, it should be clean.
                    if "already exists" in str(se):
                         logger.warning(f"Schema {schema_name} already exists, continuing to provisioning...")
                    else:
                         raise RuntimeError(f"No se pudo crear el esquema de base de datos: {str(se)}")

            # 3.1 Create Media Directory for Tenant
            try:
                # Standardized v29 path
                if os.path.exists("/.dockerenv") or os.environ.get("DOCKER_CONTAINER"):
                    base_media = "/app/media"
                else:
                    _root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
                    base_media = os.path.join(_root, "media")
                
                tenant_media_path = os.path.join(base_media, str(schema_name), "products")
                os.makedirs(tenant_media_path, exist_ok=True)
                logger.info(f"✅ Media directory created: {tenant_media_path}")
            except Exception as me:
                logger.error(f"⚠️  Warning creating media dir: {me}")

            # 4. COMMIT Tenant Record (So ID is generated and safe)
            db.commit()
            
            # 5. Schema Reflection (Create Tables) - REPLACING ALEMBIC
            logger.info(f"🏗️ Provisioning tables via Schema Reflection in {schema_name}...")
            if "sqlite" not in str(settings.DATABASE_URL):
                with engine.connect() as conn:
                    with conn.begin():
                        conn.execute(text(f'SET search_path TO "{schema_name}"'))
                        Base.metadata.create_all(conn)
            logger.info(f"✅ Tables provisioned in: {schema_name}")

            # 6. Seed Admin User & Data
            TenantService.seed_tenant_admin(schema_name, admin_email, admin_password, name, new_tenant.id)
            TenantService.seed_exchange_rates(schema_name)
            TenantService.seed_payment_methods(schema_name)
            TenantService.seed_currencies(schema_name)
            TenantService.seed_tenant_warehouse(schema_name)

            return {
                "status": "success",
                "tenant_id": schema_name,
                "message": "Tenant created successfully"
            }

        except Exception as e:
            logger.error(f"❌ ERROR EN REGISTRO (Service Level): {e}")
            traceback.print_exc()
            try:
                db.rollback()
            except:
                pass
            raise e
        finally:
            db.close()

    @staticmethod
    def seed_tenant_admin(schema_name: str, email: str, password: str, tenant_name: str, tenant_id: int):
        """Seed initial admin user for the tenant"""
        logger.info(f"🌱 Seeding Admin User for: {schema_name} (Tenant ID: {tenant_id})")
        db = SessionLocal()
        try:
            # Set Schema for Postgres
            if "sqlite" not in str(settings.DATABASE_URL):
                # We need public for the User table, but we set search_path to ensure visibility if needed
                db.execute(text(f'SET search_path TO "{schema_name}", public'))
                
            # Check if admin exists FOR THIS TENANT
            # User table is shared (public schema), so we MUST filter by tenant_id
            existing_admin = db.query(User).filter(
                User.username == "admin",
                User.tenant_id == tenant_id
            ).first()
            
            if existing_admin:
                 logger.info(f"⚠️  Admin user already exists for tenant {tenant_id}.")
                 return

            # Create Admin
            admin_user = User(
                username="admin",
                email=email, # Use the actual email provided
                password_hash=get_password_hash(password),
                role=UserRole.ADMIN,
                is_active=True,
                full_name=f"Admin {tenant_name}",
                tenant_id=tenant_id, # Link to the tenant
                is_superuser=True # First user is superuser of the tenant
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
        from ..models.models import ExchangeRate
        
        logger.info(f"💱 Seeding Exchange Rates for: {schema_name}")
        db = SessionLocal()
        try:
            if "sqlite" not in str(settings.DATABASE_URL):
                db.execute(text(f'SET search_path TO "{schema_name}", public'))
            
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
        from ..models.models import PaymentMethod
        
        logger.info(f"💳 Seeding Payment Methods for: {schema_name}")
        db = SessionLocal()
        try:
            if "sqlite" not in str(settings.DATABASE_URL):
                db.execute(text(f'SET search_path TO "{schema_name}", public'))
            
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
        from ..models.models import Warehouse
        
        logger.info(f"🏭 Seeding Default Warehouse for: {schema_name}")
        db = SessionLocal()
        try:
            if "sqlite" not in str(settings.DATABASE_URL):
                db.execute(text(f'SET search_path TO "{schema_name}", public'))
            
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
        from ..models.models import Currency
        
        logger.info(f"💵 Seeding Currencies for: {schema_name}")
        db = SessionLocal()
        try:
            if "sqlite" not in str(settings.DATABASE_URL):
                db.execute(text(f'SET search_path TO "{schema_name}", public'))
            
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
