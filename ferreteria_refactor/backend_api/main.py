from fastapi import FastAPI, APIRouter, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import os
import sys
import logging

logger = logging.getLogger(__name__)

# --- DIAGNÓSTICO DE INICIO ---
print("[INFO] Verificando entorno Python...", flush=True)
try:
    import aiofiles
    print("[OK] aiofiles esta instalado y disponible.", flush=True)
except ImportError as e:
    print(f"[ERROR] ERROR CRITICO: aiofiles NO esta instalado: {e}", flush=True)


from .models import models
from .config import settings
from .database.db import engine
from .routers.products import router as products_router
from .routers.customers import router as customers_router
from .routers.whatsapp import router as whatsapp_router
from .routers.onboarding import router as onboarding_router
from .routers.public_catalog import router as public_catalog_router
from .routers.quotes import router as quotes_router
from .routers.cash import router as cash_router
from .routers.suppliers import router as suppliers_router
from .routers.inventory import router as inventory_router
from .routers.returns import router as returns_router
from .routers.reports import router as reports_router
from .routers.purchases import router as purchases_router
from .routers.users import router as users_router
from .routers.config import router as config_router
from .routers.auth import router as auth_router
from .routers.categories import router as categories_router
from .routers.websocket import router as websocket_router
from .routers.audit import router as audit_router
from .routers.system import router as system_router
from .routers.payment_methods import router as payment_methods_router
from .routers.external_financing import router as external_financing_router
from .routers.sync import router as sync_router
from .routers.cloud import router as cloud_router
from .routers.chatbot import router as chatbot_router
from .routers.credits import router as credits_router
from .routers.services import router as services_router
from .routers.service_templates import router as service_templates_router
from .routers.commissions import router as commissions_router
from .routers.commission_config import router as commission_config_router
from .routers.rma import router as rma_router
from .routers.price_lists import router as price_lists_router
from .routers.employees import router as employees_router
from .routers.warehouses import router as warehouses_router
from .routers.transfers import router as transfers_router
from .routers.warranties import router as warranties_router # NEW: Warranty System
from .routers.layaways import router as layaways_router
from .routers.pharmacy import router as pharmacy_router  # NEW: Pharmacy Module
from .routers.admin import router as admin_router  # NEW: Admin panel
from .routers.support_client import router as support_client_router
from .routers.support_admin import router as support_admin_router
from .routers.system_health import router as system_health_router
from .audit_utils import log_action
from .models.models import UserRole
from .middleware.license_guard import LicenseGuardMiddleware
from .scheduler import start_scheduler, stop_scheduler

app = FastAPI(
    title="Ferretería Enterprise API",
    description="API profesional para la gestión integral de ferretería.",
    version="2.2.0",
)

# --- RATE LIMITING (slowapi) ---
# Import the shared limiter instance defined in dependencies.py
from .dependencies import limiter, get_current_superuser
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- CONFIGURACIÓN DE CORS DINÁMICA (v36 - CORS FIX) ---
_default_origins = [
    # --- LOCAL DEVELOPMENT ---
    "http://localhost:5173",
    "http://localhost:5174",         # SaaS Admin Panel
    "http://localhost:5175",         # Landing Page / Extra dev server
    "http://localhost:8000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:8000",

    # --- MOBILE APPS (Capacitor/Native) ---
    "http://localhost",             # Android WebView Default
    "https://localhost",            # Android WebView (Secure)
    "capacitor://localhost",        # iOS Default

    # --- PRODUCTION DOMAINS ---
    "https://miinventariofacil.com",
    "https://api.miinventariofacil.com",
    "https://qa.miinventariofacil.com",
    "https://api-qa.miinventariofacil.com",
    "https://admin.qa.miinventariofacil.com",

    # --- TENANT SUBDOMAINS (Local) ---
    "http://prueba3.localhost:5173",
    "http://prueba3.localhost:8000",
    "http://prueba9.localhost:5173",
    "http://prueba9.localhost:8000",
    "http://demo.localhost:5173",
    "http://admin.localhost:5173",
]

# Merge extra origins from CORS_ORIGINS env var (comma-separated)
if settings.CORS_ORIGINS:
    _extra = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
    _default_origins.extend(_extra)

# En producción: solo https. En desarrollo: también http localhost.
if settings.ENVIRONMENT == "production":
    cors_origin_regex = r"https://[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.miinventariofacil\.com"
else:
    cors_origin_regex = r"https?://[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.miinventariofacil\.com|http://.*\.localhost(:\d+)?"

app.add_middleware(
    CORSMiddleware,
    # allow_origins=["*"], # ❌ ERROR: Wildcard + Credentials fails in browsers
    allow_origins=_default_origins,
    allow_origin_regex=cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# --- SESSION MIDDLEWARE (Required for SQLAdmin) ---
from starlette.middleware.sessions import SessionMiddleware
app.add_middleware(SessionMiddleware, secret_key=settings.SECRET_KEY)


# --- SAAS MULTI-TENANT MIDDLEWARE ---
from .middleware.tenant_middleware import TenantMiddleware
app.add_middleware(TenantMiddleware)


from .config import settings

@app.on_event("startup")
async def startup_event_async():
    print("\n" + "="*60)
    print(f"[INFO] FERRETERIA API INICIADA (Environment: {settings.ENVIRONMENT.upper()})")
    if settings.ENVIRONMENT == "staging":
        print("[WARNING] AGENTE ENTORNO STAGING DETECTADO - CONFIGURACIÓN DE QA ACTIVA")

    # EXTREME DIAGNOSTIC: Print all routes
    print("\n[ROUTES] Full hierarchy:")
    for route in sorted(app.routes, key=lambda x: getattr(x, 'path', '')):
        if hasattr(route, 'methods'):
            print(f"  {list(route.methods)} {route.path}")
    print("="*60 + "\n")

    # --- SCHEDULER: Auto-expiración de licencias ---
    from .database.db import SessionLocal
    start_scheduler(SessionLocal)


@app.on_event("shutdown")
async def shutdown_event():
    stop_scheduler()

# --- MIDDLEWARE DE LOGGING Y SEGURIDAD ---
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
import time
import traceback

class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        origin = request.headers.get("origin", "no-origin")
        print(f"👉 [REQ] {request.method} {request.url.path} | Origin: {origin}")
        try:
            response = await call_next(request)
            process_time = time.time() - start_time
            print(f"👈 [RES] {response.status_code} ({process_time:.4f}s)")

            # Force clear invalid auth cookie on 401 (e.g. after SECRET_KEY rotation)
            if response.status_code == 401 and request.cookies.get("access_token"):
                from .config import settings as app_settings
                response.set_cookie(
                    key="access_token",
                    value="",
                    max_age=0,
                    httponly=True,
                    secure=app_settings.SECURE_COOKIES,
                    samesite="lax",
                    path="/",
                    domain=app_settings.COOKIE_DOMAIN,
                )
                print("🧹 Cleared invalid auth cookie (force re-login)")

            return response
        except Exception as e:
            process_time = time.time() - start_time
            print(f"🔥 [CRASH] Request failed after {process_time:.4f}s: {e}")
            traceback.print_exc()
            raise e

app.add_middleware(LoggingMiddleware)

# --- GLOBAL EXCEPTION HANDLER ---
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error in %s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )

# --- SEGURIDAD HÍBRIDA (License Guard) ---
# TEMPORARILY DISABLED FOR DEBUGGING
# if not os.getenv("DOCKER_CONTAINER"):
#     # Modo Local (PC Cliente)
#     app.add_middleware(LicenseGuardMiddleware)
#     print("[INFO] MODO LOCAL: License Guard ACTIVADO")
# else:
#     # Modo SaaS (VPS)
#     print("[INFO] MODO SAAS: License Guard DESACTIVADO (Gestion Centralizada)")
print("[INFO] License Guard DESACTIVADO TEMPORALMENTE PARA DEBUG")



# --- ROUTER HIERARCHY (v60 - Nested Patterns) ---
v1_router = APIRouter(prefix="/api/v1")

v1_router.include_router(products_router, tags=["Inventario"])
v1_router.include_router(customers_router, tags=["Clientes"])
v1_router.include_router(whatsapp_router, tags=["WhatsApp"])
v1_router.include_router(onboarding_router, tags=["Onboarding"])
v1_router.include_router(public_catalog_router, tags=["Catálogo Público"])
v1_router.include_router(quotes_router, tags=["Presupuestos"])
v1_router.include_router(cash_router, tags=["Caja"])
v1_router.include_router(suppliers_router, tags=["Proveedores"])
v1_router.include_router(inventory_router, tags=["Inventario (Operaciones)"])
v1_router.include_router(returns_router, tags=["Devoluciones"])
v1_router.include_router(reports_router, tags=["Reportes"])
v1_router.include_router(purchases_router, tags=["Compras"])
v1_router.include_router(users_router, tags=["Usuarios"])
v1_router.include_router(config_router, tags=["Configuración"])
v1_router.include_router(auth_router, tags=["Autenticación"])
v1_router.include_router(categories_router, tags=["Categorías"])
v1_router.include_router(websocket_router, tags=["WebSocket Events"])
v1_router.include_router(audit_router, tags=["Auditoría"])
v1_router.include_router(system_router, tags=["Sistema y Licencias"])
v1_router.include_router(credits_router, tags=["Créditos y Cobranzas"])
v1_router.include_router(payment_methods_router, tags=["Métodos de Pago"])
v1_router.include_router(external_financing_router, tags=["Créditos Externos"])
v1_router.include_router(sync_router, tags=["Sincronización Híbrida"])
v1_router.include_router(warehouses_router, tags=["Almacenes"])
v1_router.include_router(transfers_router, tags=["Traslados"])
v1_router.include_router(services_router, tags=["Servicios Técnicos"])
v1_router.include_router(service_templates_router, tags=["Plantillas de Servicio"])
v1_router.include_router(commissions_router, tags=["Comisiones"])
v1_router.include_router(commission_config_router, tags=["Comisiones - Configuración"])
v1_router.include_router(rma_router, tags=["Garantías RMA"])
v1_router.include_router(price_lists_router, tags=["Listas de Precios"])
v1_router.include_router(employees_router, tags=["Barbería y Empleados"])
v1_router.include_router(cloud_router, tags=["Cloud Configuration"])
v1_router.include_router(chatbot_router, tags=["ChatBot WhatsApp"])
v1_router.include_router(warranties_router, tags=["Garantías"])
v1_router.include_router(layaways_router, tags=["Apartados"])
v1_router.include_router(pharmacy_router, tags=["Farmacia"])
from .routers.admin_tasks import router as admin_tasks_router # NEW: Admin Tasks
from .routers.desktop_licenses import router as desktop_licenses_router  # Desktop license management

# ...

v1_router.include_router(admin_router, tags=["Admin Panel"])  # NEW: Superuser admin endpoints
v1_router.include_router(admin_tasks_router, tags=["Admin Tasks"]) # NEW: Admin Tasks
v1_router.include_router(support_client_router, tags=["Soporte"])
v1_router.include_router(support_admin_router, tags=["Admin Soporte"])
v1_router.include_router(system_health_router, tags=["System Health"])
v1_router.include_router(desktop_licenses_router, tags=["Admin - Desktop Licenses"])  # Desktop licenses
from .routers.admin_flags import router as admin_flags_router
v1_router.include_router(admin_flags_router, tags=["Feature Flags"])


# Include Public Auth and Restaurant in v1 hierarchy too
from .routers import public_auth
from .routers import organizations
from .routers import inter_transfers, bloqueo as bloqueo_mod
from .routers import pricing as pricing_mod
v1_router.include_router(public_auth.router, tags=["Public Auth"])

from .routers.modules.restaurant import tables as restaurant_tables
from .routers.modules.restaurant import orders as restaurant_orders
from .routers.modules.restaurant import menu as restaurant_menu
from .routers.modules.restaurant import modifiers as restaurant_modifiers
from .routers.modules.restaurant import print as restaurant_print

v1_router.include_router(restaurant_tables.router, prefix="/restaurant", tags=["Restaurante"])
v1_router.include_router(restaurant_orders.router, prefix="/restaurant")
v1_router.include_router(restaurant_menu.router, prefix="/restaurant", tags=["Restaurante - Menú"])
v1_router.include_router(restaurant_modifiers.router, prefix="/restaurant")
v1_router.include_router(restaurant_print.router, prefix="/restaurant")

# Finally, include the master router into the app
app.include_router(v1_router)
app.include_router(organizations.router, prefix="/api/v1")
app.include_router(inter_transfers.router, prefix="/api/v1")
app.include_router(pricing_mod.router, prefix="/api/v1/config")
app.include_router(bloqueo_mod.router,     prefix="/api/v1")

# DEBUG ENDPOINT - Remove after debugging
@app.get("/api/v1/debug/routes", dependencies=[Depends(get_current_superuser)])
def list_routes():
    """List all registered routes for debugging"""
    routes = []
    for route in app.routes:
        if hasattr(route, 'methods') and hasattr(route, 'path'):
            routes.append({
                "path": route.path,
                "methods": list(route.methods),
                "name": route.name
            })
    return {"total": len(routes), "routes": routes}

# HEALTH CHECK - Para detección de conexión
@app.get("/api/v1/cache/stats")
def cache_stats_endpoint():
    """Estadísticas del caché Redis — solo superadmin"""
    from .cache import cache_stats
    return cache_stats()

@app.get("/api/v1/cache/flush")
def cache_flush_endpoint(tenant: str = None):
    """Vaciar caché de un tenant o todo"""
    from .cache import invalidate_tenant, invalidate_all
    if tenant:
        count = invalidate_tenant(tenant)
        return {"flushed": count, "tenant": tenant}
    count = invalidate_all()
    return {"flushed": count, "scope": "all"}

@app.get("/api/v1/health")
def health_check():

    """Simple health check endpoint for connectivity testing"""
    return {"status": "ok", "service": "ferreteria-api"}

# --- REPARACIÓN DIRECTA DE ESQUEMA (Bypass Alembic) ---
def repair_public_schema():
    """
    Reparación directa via SQL crudo. Ejecuta ANTES de Alembic para asegurar
    que el esquema público está en un estado mínimamente funcional.
    
    Esto soluciona el problema de que alembic_version fue borrada por una
    migración anterior, impidiendo que Alembic funcione.
    """
    from sqlalchemy import text
    
    with engine.connect() as conn:
        # 1. Asegurar que alembic_version existe
        result = conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'alembic_version'
            )
        """))
        alembic_table_exists = result.scalar()
        
        if not alembic_table_exists:
            print("[REPAIR] 🔧 Recreando tabla alembic_version...")
            conn.execute(text("""
                CREATE TABLE public.alembic_version (
                    version_num VARCHAR(32) NOT NULL,
                    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
                )
            """))
            # Stamp con la última revisión conocida para que Alembic no intente re-ejecutar todo
            conn.execute(text("""
                INSERT INTO public.alembic_version (version_num) VALUES ('e2f1a9b2d3c4')
            """))
            print("[REPAIR] ✅ alembic_version recreada y estampada con última revisión.")
        
        # 2. Añadir columnas faltantes a public.tenants
        columns_to_add = [
            ("business_type", "VARCHAR"),
            ("has_restaurant_module", "BOOLEAN DEFAULT FALSE"),
            ("has_laundry_module", "BOOLEAN DEFAULT FALSE"),
            ("has_hardware_module", "BOOLEAN DEFAULT FALSE"),
            ("has_services_module", "BOOLEAN DEFAULT FALSE"),
            ("has_barbershop_module", "BOOLEAN DEFAULT FALSE"),
            ("license_type", "VARCHAR(20) NOT NULL DEFAULT 'trial'"),
            ("trial_days", "INTEGER NOT NULL DEFAULT 2"),
            ("trial_ends_at", "TIMESTAMP"),
            ("license_blocked_reason", "VARCHAR(50)"),
        ]

        for col_name, col_type in columns_to_add:
            result = conn.execute(text(f"""
                SELECT EXISTS (
                    SELECT FROM information_schema.columns
                    WHERE table_schema = 'public'
                    AND table_name = 'tenants'
                    AND column_name = '{col_name}'
                )
            """))
            exists = result.scalar()

            if not exists:
                print(f"[REPAIR] 🔧 Añadiendo columna {col_name} a public.tenants...")
                conn.execute(text(f"ALTER TABLE public.tenants ADD COLUMN {col_name} {col_type}"))
                print(f"[REPAIR] ✅ Columna {col_name} añadida.")

        # 3. Añadir columnas faltantes a public.system_messages (announcement modal)
        sm_columns = [
            ("message_type", "VARCHAR(20) NOT NULL DEFAULT 'banner'"),
            ("version_tag",  "VARCHAR(20)"),
            ("target_tenant_schema", "VARCHAR(120)"),
            ("created_by_user_id", "INTEGER"),
        ]

        for col_name, col_type in sm_columns:
            result = conn.execute(text(f"""
                SELECT EXISTS (
                    SELECT FROM information_schema.columns
                    WHERE table_schema = 'public'
                    AND table_name   = 'system_messages'
                    AND column_name  = '{col_name}'
                )
            """))
            if not result.scalar():
                print(f"[REPAIR] 🔧 Añadiendo columna {col_name} a public.system_messages...")
                conn.execute(text(
                    f"ALTER TABLE public.system_messages ADD COLUMN {col_name} {col_type}"
                ))
                print(f"[REPAIR] ✅ Columna {col_name} añadida.")

        try:
            conn.execute(text("UPDATE public.system_messages SET created_at = COALESCE(starts_at, NOW()) WHERE created_at IS NULL"))
            conn.execute(text("ALTER TABLE public.system_messages ALTER COLUMN created_at SET DEFAULT NOW()"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_public_system_messages_target_tenant_schema ON public.system_messages(target_tenant_schema)"))
        except Exception as e:
            print(f"[REPAIR] Could not repair system_messages metadata: {e}")

        # 4. Reparar esquemas de inquilinos (Añadir is_menu_item a products)
        result = conn.execute(text("""
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast', 'public')
        """))
        tenant_schemas = [row[0] for row in result.fetchall()]
        
        for schema in tenant_schemas:
            try:
                # Comprobar si existe la columna is_menu_item
                res_col = conn.execute(text(f"""
                    SELECT EXISTS (
                        SELECT FROM information_schema.columns 
                        WHERE table_schema = '{schema}' 
                        AND table_name = 'products' 
                        AND column_name = 'is_menu_item'
                    )
                """))
                if not res_col.scalar():
                    print(f"[REPAIR] 🔧 Añadiendo is_menu_item al esquema {schema}...")
                    conn.execute(text(f'ALTER TABLE "{schema}".products ADD COLUMN is_menu_item BOOLEAN DEFAULT FALSE'))
                
                # Barbershop flag too
                res_barber = conn.execute(text(f"""
                    SELECT EXISTS (
                        SELECT FROM information_schema.columns 
                        WHERE table_schema = '{schema}' 
                        AND table_name = 'products' 
                        AND column_name = 'is_barbershop_service'
                    )
                """))
                if not res_barber.scalar():
                    conn.execute(text(f'ALTER TABLE "{schema}".products ADD COLUMN is_barbershop_service BOOLEAN DEFAULT FALSE'))
            except Exception as e:
                print(f"[REPAIR] ❌ Error reparando esquema {schema}: {e}")

        conn.commit()
        print("[REPAIR] ✅ Reparación de base de datos completada.")

# --- LOGICA DE INICIALIZACION ---
def run_migrations():
    """
    Ejecuta migraciones de Alembic.
    En Docker/VPS: Falla rápido si las migraciones no se aplican.
    En desarrollo: Muestra warning pero continúa (para debugging).
    """
    from alembic import command
    from alembic.config import Config
    
    IS_DOCKER = os.getenv('DOCKER_CONTAINER', 'false').lower() == 'true'
    
    try:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        alembic_ini_path = os.path.join(base_dir, "alembic.ini")
        script_location = os.path.join(base_dir, "alembic")

        if not os.path.exists(alembic_ini_path):
            alembic_ini_path = "alembic.ini"

        if not os.path.exists(alembic_ini_path):
            error_msg = f"alembic.ini no encontrado en: {alembic_ini_path}"
            print(f"[WARN] {error_msg}")
            
            if IS_DOCKER:
                raise FileNotFoundError(error_msg)
            else:
                print("[INFO] Modo desarrollo sin Alembic: usando create_all() como fallback")
                return

        alembic_cfg = Config(alembic_ini_path)
        # FORCE script location to absolute path found above
        alembic_cfg.set_main_option("script_location", script_location)
        
        print("[MIGRATION] 📦 Ejecutando 'alembic upgrade shared@head'...")
        command.upgrade(alembic_cfg, "shared@head")
        print("[MIGRATION] ✅ Migraciones aplicadas correctamente.")
        
    except Exception as e:
        print(f"[ERROR] ❌ FALLO CRÍTICO EN MIGRACIONES: {e}")
        print(f"[ERROR] Tipo de error: {type(e).__name__}")
        print("[ERROR] La aplicación NO puede iniciar sin migraciones exitosas.")
        
        # En Docker/VPS, DETENER la app si las migraciones fallan
        if IS_DOCKER:
            print("[ERROR] Modo Docker detectado - abortando inicio")
            raise RuntimeError("Migraciones fallidas en Docker") from e
        else:
            print("[WARN] ⚠️ Modo desarrollo: continuando sin migraciones (RIESGOSO)")
            print("[WARN] La base de datos puede estar en un estado inconsistente")

@app.on_event("startup")
def startup_event():
    # Use consolidated media dir from utils
    from .utils.media_utils import BASE_MEDIA_DIR
    
    # Ensure media structure exists
    os.makedirs(BASE_MEDIA_DIR, exist_ok=True)
    print(f"[INFO] Directorio Media verificado: {BASE_MEDIA_DIR}")
    
    # ===== PRE-ALEMBIC REPAIR: Fix schema directly via SQL =====
    print("[INFO] Verificando integridad del esquema público (Reparación directa)...")
    try:
        repair_public_schema()
        print("[INFO] ✅ Esquema público verificado/reparado.")
    except Exception as e:
        print(f"[WARN] Error en reparación directa de esquema: {e}")
    
    # Run Alembic migrations
    print("[INFO] Iniciando migraciones de Alembic (Public Schema)...")
    run_migrations()
    
    # NEW: Run Tenant Migrations automatically
    print("[INFO] Propagando cambios a esquemas de Tenants...")
    try:
        from .migrate_tenants import migrate_tenants
        migrate_tenants()
        print("[INFO] ✅ Migración de tenants completada.")
    except Exception as e:
        print(f"[ERROR] ⚠️ Error en migración de tenants: {e}")
    
    # NEW: Run Barbershop Module Migrations (adds is_commissionable, is_barbershop_service, etc.)
    print("[INFO] Propagando módulo de Barbería a esquemas de Tenants...")
    try:
        from .migrate_barbershop import migrate_barbershop
        migrate_barbershop(engine)
        print("[INFO] ✅ Migración de barbería completada.")
    except Exception as e:
        print(f"[ERROR] ⚠️ Error en migración de barbería: {e}")

    # NEW: Run Multi-Cash-Register Migrations
    print("[INFO] Propagando soporte de Multicajas...")
    try:
        from .migrate_multicaja import migrate_multicaja
        migrate_multicaja(engine)
        print("[INFO] ✅ Migración de multicajas completada.")
    except Exception as e:
        print(f"[ERROR] ⚠️ Error en migración de multicajas: {e}")

    # NEW: image_url_original (para soporte de "eliminar fondo")
    print("[INFO] Propagando columna image_url_original...")
    try:
        from .migrate_image_original import migrate_image_original
        migrate_image_original(engine)
        print("[INFO] ✅ Migración image_url_original completada.")
    except Exception as e:
        print(f"[ERROR] ⚠️ Error en migración image_url_original: {e}")

    # NEW: tablas para audit de cambios masivos de precios
    print("[INFO] Propagando tablas price_change_log...")
    try:
        from .migrate_price_change_log import migrate_price_change_log
        migrate_price_change_log(engine)
        print("[INFO] ✅ Migración price_change_log completada.")
    except Exception as e:
        print(f"[ERROR] ⚠️ Error en migración price_change_log: {e}")
    
    # FALLBACK: Create tables if they don't exist (for development/first run)
    # This ensures the app works even if migrations fail or DB is in inconsistent state
    # BUT we want Alembic to be the main source of truth
    try:
        from .database.db import Base
        # We only run this if tables are missing, but let's leave it as a safety net
        # checking only if 'users' table exists to avoid overhead
        from sqlalchemy import inspect
        inspector = inspect(engine)
        if not inspector.has_table("users"):
            print("[INFO] Tabla 'users' no detectada. Ejecutando create_all() por seguridad...")
            Base.metadata.create_all(bind=engine)
            print("[INFO] Tablas base creadas exitosamente via SQLAlchemy")
        else:
            print("[INFO] Schema verificado.")
    except Exception as e:
        print(f"[WARN] Nota al verificar schema: {e}")






    # Seed Data
    from .database.db import SessionLocal
    from .routers.auth import init_admin_user
    from .routers.config import init_exchange_rates, init_currencies
    from .routers.warehouses import init_warehouses # Import initialization
    db = SessionLocal()
    try:
        init_admin_user(db)
        # init_exchange_rates(db)  <-- Tenant specific, moved to tenant creation
        # init_currencies(db)      <-- Tenant specific
        # init_warehouses(db)      <-- Tenant specific

        # Initialize Payment Methods
        # Initialize Payment Methods with Better Names
        # print("[DEBUG] Verificando metodos de pago...", flush=True)
        # if db.query(models.PaymentMethod).count() == 0:
        #     print("[INFO] Inicializando metodos de pago por defecto...")
        #     defaults = [
        #         "Efectivo Divisa ($)", 
        #         "Efectivo Bolívares (Bs)", 
        #         "Punto de Venta (Bs)", 
        #         "Pago Móvil (Bs)", 
        #         "Zelle / Transferencia ($)",
        #         "Crédito",
        #         "Biopago (Bs)"
        #     ]
        #     for name in defaults:
        #         db.add(models.PaymentMethod(name=name, is_active=True, is_system=True))
        #     db.commit()
        #     print("[OK] Metodos de pago creados.")
        # else:
        #      # Migración rápida de nombres (Safe Update)
        #      try:
        #          # Map Old -> New
        #          replacements = {
        #              "Efectivo": "Efectivo Divisa ($)",
        #              "Punto de Venta": "Punto de Venta (Bs)",
        #              "Pago Movil": "Pago Móvil (Bs)",
        #              "Zelle": "Zelle / Transferencia ($)",
        #              "Transferencia": "Transferencia (Bs)"
        #          }
        #          
        #          for old_name, new_name in replacements.items():
        #              # Check if old exists and new doesn't
        #              old_method = db.query(models.PaymentMethod).filter(models.PaymentMethod.name == old_name).first()
        #              new_method_exists = db.query(models.PaymentMethod).filter(models.PaymentMethod.name == new_name).first()
        #              
        #              if old_method and not new_method_exists:
        #                  old_method.name = new_name
        #                  print(f"[MIGRATION] Renombrado '{old_name}' -> '{new_name}'")
        #                  
        #          db.commit()
        #      except Exception as e:
        #          print(f"[WARN] Error en migración de nombres de pago: {e}")
    except Exception as e:
        print(f"[WARN] Nota de Inicializacion: {e}")
    finally:
        db.close()

    # ── Modo Offline / Desktop ─────────────────────────────────────────────
    # Cuando SINGLE_TENANT=true, asegurar que el tenant 'default' tenga su
    # schema, tablas y datos base (métodos de pago, monedas, almacén, caja).
    # Idempotente: se puede ejecutar en cada arranque sin duplicar datos.
    if settings.SINGLE_TENANT:
        _ensure_single_tenant_seeded()


def _ensure_single_tenant_seeded():
    """
    Modo offline: verifica que el tenant 'default' esté completamente
    provisionado (schema + tablas + seed data). Se ejecuta en cada arranque.
    Idempotente — cada paso verifica si ya existe antes de crear.
    """
    from .config import settings as _s
    from .database.db import engine as _engine, SessionLocal as _SL, _validate_schema_name
    from .models.tenant import Tenant
    from .services.tenant_service import TenantService
    from sqlalchemy import text, inspect as sa_inspect

    schema = getattr(_s, "SINGLE_TENANT_SCHEMA", "default")
    print(f"[OFFLINE] Verificando tenant '{schema}'...")

    # 1. Migración: columna feature_flags (IF NOT EXISTS → seguro re-ejecutar)
    try:
        with _engine.connect() as conn:
            conn.execute(text(
                "ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS "
                "feature_flags JSONB NOT NULL DEFAULT '{}'"
            ))
            conn.commit()
    except Exception:
        pass  # tabla puede no existir aún en primera instalación

    # 2. Tenant row
    db = _SL()
    try:
        tenant = db.query(Tenant).filter(Tenant.schema_name == schema).first()
        if not tenant:
            print(f"[OFFLINE] Tenant row no existe — ejecutando setup completo...")
            db.close()
            TenantService.create_tenant(
                name="Mi Negocio",
                schema_name=schema,
                admin_email="admin@local.com",
                admin_password="admin123",
                plan_type="FERRETERIA",
            )
            _patch_lifetime(schema)
            print(f"[OFFLINE] ✅ Tenant '{schema}' creado con datos base.")
            return
        tenant_id = tenant.id
    finally:
        db.close()

    # 3. Schema PostgreSQL
    schema_exists = False
    try:
        with _engine.connect() as conn:
            row = conn.execute(
                text("SELECT 1 FROM information_schema.schemata WHERE schema_name = :s"),
                {"s": schema}
            ).fetchone()
            schema_exists = row is not None
    except Exception as e:
        print(f"[OFFLINE] ⚠️ Error verificando schema: {e}")

    if not schema_exists:
        print(f"[OFFLINE] Schema '{schema}' no existe — creando tablas...")
        try:
            from .database.db import Base
            _validate_schema_name(schema)
            with _engine.connect() as conn:
                with conn.begin():
                    conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema}"'))
                    conn.execute(text(f'SET search_path TO "{schema}"'))
                    Base.metadata.create_all(conn)
            print(f"[OFFLINE] ✅ Schema '{schema}' provisionado.")
        except Exception as e:
            print(f"[OFFLINE] ❌ Error creando schema: {e}")
            return

    # 4. Seeds (cada función ya verifica "skip if exists")
    try:
        # Admin user
        db = _SL()
        try:
            _validate_schema_name(schema)
            db.execute(text(f'SET search_path TO "{schema}", public'))
            from .models.models import User
            if not db.query(User).filter(User.username == "admin", User.tenant_id == tenant_id).first():
                TenantService.seed_tenant_admin(schema, "admin@local.com", "admin123", "Mi Negocio", tenant_id)
        finally:
            db.close()

        TenantService.seed_exchange_rates(schema)
        TenantService.seed_payment_methods(schema)
        TenantService.seed_currencies(schema)
        TenantService.seed_tenant_warehouse(schema)
        TenantService.seed_cash_register(schema)
        print(f"[OFFLINE] ✅ Datos base verificados para tenant '{schema}'.")
    except Exception as e:
        print(f"[OFFLINE] ⚠️ Error en seeding: {e}")

    _patch_lifetime(schema)


def _patch_lifetime(schema: str):
    from .database.db import SessionLocal as _SL
    from .models.tenant import Tenant
    db = _SL()
    try:
        t = db.query(Tenant).filter(Tenant.schema_name == schema).first()
        if t and t.license_type != "lifetime":
            t.license_type = "lifetime"
            t.is_active = True
            t.trial_ends_at = None
            db.commit()
    except Exception:
        pass
    finally:
        db.close()


# ============================================
# STATIC FILES - ORDER MATTERS!
# ============================================

# Mount NEW Multi-tenant Media folder
from .utils.media_utils import BASE_MEDIA_DIR
app.mount("/media", StaticFiles(directory=BASE_MEDIA_DIR), name="media")

print(f"[INFO] Directorio Media montado: {BASE_MEDIA_DIR}")
print("[INFO] Imagenes montadas como archivos estaticos")

# 2. THEN: Mount frontend static files
# Check for local frontend directory first (PWA mode), then Docker path
if os.path.exists("./frontend"):
    # Local development/distribution: Frontend in ./frontend
    frontend_dir = os.path.abspath("./frontend")
elif os.path.exists("/app/static"):
    # Docker: Frontend in /app/static
    frontend_dir = "/app/static"
else:
    frontend_dir = None

async def serve_index():
    if frontend_dir and os.path.exists(os.path.join(frontend_dir, "index.html")):
        return FileResponse(os.path.join(frontend_dir, "index.html"))
    return JSONResponse(status_code=404, content={"detail": "Frontend index.html not found"})

if frontend_dir and os.path.exists(frontend_dir):
    print(f"[INFO] FRONTEND ENCONTRADO en: {frontend_dir}")
    
    # 1. Montar Assets
    assets_path = os.path.join(frontend_dir, "assets")
    if os.path.exists(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")
    
    # 2. RUTA RAÍZ (Registrada explícitamente)
    app.add_api_route("/", serve_index, methods=["GET"], include_in_schema=False)

    # 3. Catch-All para React Router
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        # [SECURITY] ESCUDO DE API: Si la ruta empieza con 'api', devolver 404 JSON real
        if full_path.startswith("api"):
            return JSONResponse(status_code=404, content={"detail": "API endpoint not found"})
        
        # Intentar servir archivo estático si existe
        file_path = os.path.join(frontend_dir, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        
        # Fallback: Servir index.html para React Router
        return FileResponse(os.path.join(frontend_dir, "index.html"))
else:
    print("[WARN] FRONTEND NO ENCONTRADO. Solo API disponible.")
    @app.get("/")
    def root():
        return {"message": "Ferreteria API (Backend Only)"}

# ============================================
# SQLADMIN - Native Admin Panel
# ============================================
from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend
from starlette.requests import Request
from starlette.responses import RedirectResponse
# Re-importing relative modules to ensure context in this block
from .database.db import engine, SessionLocal
from .models.models import User
from .models.tenant import Tenant
from .security import verify_password
from .config import settings

class AdminAuth(AuthenticationBackend):
    async def login(self, request: Request) -> bool:
        form = await request.form()
        username = form.get("username")
        password = form.get("password")

        db = SessionLocal()
        try:
            # Check user (match by username OR email)
            user = db.query(User).filter(
                (User.username == username) | (User.email == username)
            ).first()
            
            if not user:
                return False
                
            if not verify_password(password, user.password_hash):
                return False
                
            # CRITICAL: Verify superuser
            if not user.is_superuser:
                return False

            request.session.update({"token": user.username})
            return True
        except Exception:
            return False
        finally:
            db.close()

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        token = request.session.get("token")
        if not token:
            return False
        return True

class UserAdmin(ModelView, model=User):
    column_list = [User.id, User.username, User.role, User.is_active, User.is_superuser]
    column_searchable_list = [User.username, User.email]
    icon = "fa-solid fa-user"
    name = "Usuario"
    name_plural = "Usuarios"

class TenantAdmin(ModelView, model=Tenant):
    column_list = [Tenant.id, Tenant.name, Tenant.schema_name, Tenant.is_active]
    column_searchable_list = [Tenant.name, Tenant.schema_name]
    icon = "fa-solid fa-building"
    name = "Empresa"
    name_plural = "Empresas"

# Initialize Admin with Authentication
authentication_backend = AdminAuth(secret_key=settings.SECRET_KEY)
admin = Admin(app, engine, authentication_backend=authentication_backend)
admin.add_view(UserAdmin)
admin.add_view(TenantAdmin)