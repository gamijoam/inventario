from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
import os
import sys

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
from .routers.sync import router as sync_router
from .routers.sync_local import router as sync_local_router
from .routers.cloud import router as cloud_router
from .routers.credits import router as credits_router
from .routers.services import router as services_router
from .routers.commissions import router as commissions_router
from .routers.rma import router as rma_router
from .routers.price_lists import router as price_lists_router
from .routers.warehouses import router as warehouses_router
from .routers.transfers import router as transfers_router
from .routers.admin import router as admin_router  # NEW: Admin panel
from .audit_utils import log_action
from .models.models import UserRole
from .routers.hardware_bridge import router as hardware_bridge_router  # WebSocket router
from .middleware.license_guard import LicenseGuardMiddleware

app = FastAPI(
    title="Ferretería Enterprise API",
    description="API profesional para la gestión integral de ferretería.",
    version="2.2.0",
)

# --- CONFIGURACIÓN DE CORS DINÁMICA (v36 - CORS FIX) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://miinventariofacil.com", 
        "https://api.miinventariofacil.com",
        "https://qa.miinventariofacil.com",
        "https://api-qa.miinventariofacil.com",
        "https://admin.qa.miinventariofacil.com", # Admin Panel
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174", # Admin Panel Local
        "http://localhost:8000",
        # Local multi-tenant development
        "http://prueba9.localhost:5173",
        "http://prueba9.localhost:8000",
        "http://demo.localhost:5173",
        "http://demo.localhost:8000",
        "http://admin.localhost:5173",
        "http://admin.localhost:8000",
    ],
    allow_origin_regex=r"https://.*\.miinventariofacil\.com|http://.*\.localhost:(5173|8000)", # Permite subdominios de producción y localhost
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["x-tenant-id", "Content-Type", "Authorization", "Accept", "Origin", "X-Requested-With"],
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
    print(f"🔥 [GLOBAL HANDLER] Error in {request.url.path}: {exc}")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal Server Error: {str(exc)}", "type": type(exc).__name__},
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
v1_router.include_router(hardware_bridge_router, tags=["Hardware Bridge"])
v1_router.include_router(sync_router, tags=["Sincronización Híbrida"])
v1_router.include_router(sync_local_router, tags=["Sincronización Local"])
v1_router.include_router(warehouses_router, tags=["Almacenes"])
v1_router.include_router(transfers_router, tags=["Traslados"])
v1_router.include_router(services_router, tags=["Servicios Técnicos"])
v1_router.include_router(commissions_router, tags=["Comisiones"])
v1_router.include_router(rma_router, tags=["Garantías RMA"])
v1_router.include_router(price_lists_router, tags=["Listas de Precios"])
v1_router.include_router(cloud_router, tags=["Cloud Configuration"])
v1_router.include_router(admin_router, tags=["Admin Panel"])  # NEW: Superuser admin endpoints


# Include Public Auth and Restaurant in v1 hierarchy too
from .routers import public_auth
v1_router.include_router(public_auth.router, tags=["Public Auth"])

from .routers.modules.restaurant import tables as restaurant_tables
from .routers.modules.restaurant import orders as restaurant_orders
from .routers.modules.restaurant import menu as restaurant_menu

v1_router.include_router(restaurant_tables.router, prefix="/restaurant", tags=["Restaurante"])
v1_router.include_router(restaurant_orders.router, prefix="/restaurant")
v1_router.include_router(restaurant_menu.router, prefix="/restaurant", tags=["Restaurante - Menú"])

# Finally, include the master router into the app
app.include_router(v1_router)

# DEBUG ENDPOINT - Remove after debugging
@app.get("/api/v1/debug/routes")
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
@app.get("/api/v1/health")
def health_check():
    """Simple health check endpoint for connectivity testing"""
    return {"status": "ok", "service": "ferreteria-api"}

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
        if getattr(sys, 'frozen', False):
             # FROZEN: alembic.ini is in the root of the bundle (sys._MEIPASS)
             base_dir_frozen = sys._MEIPASS
             alembic_ini_path = os.path.join(base_dir_frozen, "alembic.ini")
             script_location = os.path.join(base_dir_frozen, "alembic")
             print(f"[MIGRATION] Buscando alembic.ini congelado en: {alembic_ini_path}")
        else:
             # DEV
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
        
        print("[MIGRATION] 📦 Ejecutando 'alembic upgrade head'...")
        command.upgrade(alembic_cfg, "head")
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
    
    # Run Alembic migrations
    print("[INFO] Iniciando migraciones de Alembic...")
    run_migrations()
    
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
        init_exchange_rates(db)
        init_currencies(db) # Seed default currencies (USD, BS, etc.)
        init_warehouses(db) # Safe idempotent initialization

        # Initialize Payment Methods
        # Initialize Payment Methods with Better Names
        print("[DEBUG] Verificando metodos de pago...", flush=True)
        if db.query(models.PaymentMethod).count() == 0:
            print("[INFO] Inicializando metodos de pago por defecto...")
            defaults = [
                "Efectivo Divisa ($)", 
                "Efectivo Bolívares (Bs)", 
                "Punto de Venta (Bs)", 
                "Pago Móvil (Bs)", 
                "Zelle / Transferencia ($)",
                "Crédito",
                "Biopago (Bs)"
            ]
            for name in defaults:
                db.add(models.PaymentMethod(name=name, is_active=True, is_system=True))
            db.commit()
            print("[OK] Metodos de pago creados.")
        else:
             # Migración rápida de nombres (Safe Update)
             try:
                 # Map Old -> New
                 replacements = {
                     "Efectivo": "Efectivo Divisa ($)",
                     "Punto de Venta": "Punto de Venta (Bs)",
                     "Pago Movil": "Pago Móvil (Bs)",
                     "Zelle": "Zelle / Transferencia ($)",
                     "Transferencia": "Transferencia (Bs)"
                 }
                 
                 for old_name, new_name in replacements.items():
                     # Check if old exists and new doesn't
                     old_method = db.query(models.PaymentMethod).filter(models.PaymentMethod.name == old_name).first()
                     new_method_exists = db.query(models.PaymentMethod).filter(models.PaymentMethod.name == new_name).first()
                     
                     if old_method and not new_method_exists:
                         old_method.name = new_name
                         print(f"[MIGRATION] Renombrado '{old_name}' -> '{new_name}'")
                         
                 db.commit()
             except Exception as e:
                 print(f"[WARN] Error en migración de nombres de pago: {e}")
    except Exception as e:
        print(f"[WARN] Nota de Inicializacion: {e}")
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
if getattr(sys, 'frozen', False):
    # FROZEN (PyInstaller): Frontend next to executable
    frontend_dir = os.path.join(os.path.dirname(sys.executable), "frontend")
elif os.path.exists("./frontend"):
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