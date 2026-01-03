from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
import os
import sys

# --- DIAGNÓSTICO DE INICIO ---
# --- DIAGNÓSTICO DE INICIO ---
print("[INFO] Verificando entorno Python...", flush=True)
try:
    import aiofiles
    print("[OK] aiofiles esta instalado y disponible.", flush=True)
except ImportError as e:
    print(f"[ERROR] ERROR CRITICO: aiofiles NO esta instalado: {e}", flush=True)

from .models import models
from .database.db import engine
from .routers import (
    auth, products, users, reports, customers, suppliers, 
    purchases, cash, config, quotes, warehouses, transfers, 
    inventory, returns, categories, websocket, audit, system, 
    payment_methods, sync, sync_local, cloud, credits
)
from .audit_utils import log_action
from .models.models import UserRole
from .routers.hardware_bridge import router as hardware_bridge_router  # WebSocket router
from .middleware.license_guard import LicenseGuardMiddleware

app = FastAPI(
    title="Ferretería Enterprise API",
    description="API profesional para la gestión integral de ferretería.",
    version="2.2.0",
)

from .config import settings




@app.on_event("startup")
async def startup_event_async():
    print("\n" + "="*60)
    print("[INFO] FERRETERIA API INICIADA (Modo Docker SaaS v2)")
    print("="*60 + "\n")

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://127.0.0.1:5173",  # Alternative localhost
        "https://demo.invensoft.lat",  # Production domain
        "https://invensoft.lat",  # Production domain (www)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- ROUTERS API (Prioridad Alta) ---
app.include_router(products, prefix="/api/v1", tags=["Inventario"])
app.include_router(customers, prefix="/api/v1", tags=["Clientes"])
app.include_router(quotes, prefix="/api/v1", tags=["Presupuestos"])
app.include_router(cash, prefix="/api/v1", tags=["Caja"])
app.include_router(suppliers, prefix="/api/v1", tags=["Proveedores"])
app.include_router(inventory, prefix="/api/v1", tags=["Inventario (Operaciones)"])
app.include_router(returns, prefix="/api/v1", tags=["Devoluciones"])
app.include_router(reports, prefix="/api/v1", tags=["Reportes"])
app.include_router(purchases, prefix="/api/v1", tags=["Compras"])
app.include_router(users, prefix="/api/v1", tags=["Usuarios"])
app.include_router(config, prefix="/api/v1", tags=["Configuración"])
app.include_router(auth, prefix="/api/v1", tags=["Autenticación"])
app.include_router(categories, prefix="/api/v1", tags=["Categorías"])
app.include_router(websocket, prefix="/api/v1", tags=["WebSocket Events"])
app.include_router(audit, prefix="/api/v1", tags=["Auditoría"])
app.include_router(system, prefix="/api/v1", tags=["Sistema y Licencias"])
app.include_router(credits.router, prefix="/api/v1", tags=["Créditos y Cobranzas"])
app.include_router(payment_methods.router, prefix="/api/v1", tags=["Métodos de Pago"])
app.include_router(hardware_bridge_router, prefix="/api/v1", tags=["Hardware Bridge"])
app.include_router(sync.router, prefix="/api/v1", tags=["Sincronización Híbrida"]) # VPS Side
app.include_router(sync_local.router, prefix="/api/v1", tags=["Sincronización Local"]) # Client Side
app.include_router(warehouses.router, prefix="/api/v1", tags=["Almacenes"])
app.include_router(transfers.router, prefix="/api/v1", tags=["Traslados"]) # New Transfer Router # New line for warehouses
app.include_router(cloud.router, prefix="/api/v1", tags=["Cloud Configuration"]) # Cloud testing

from .routers.modules.restaurant import tables as restaurant_tables
from .routers.modules.restaurant import orders as restaurant_orders
from .routers.modules.restaurant import menu as restaurant_menu

app.include_router(restaurant_tables.router, prefix="/api/v1/restaurant", tags=["Restaurante"])
app.include_router(restaurant_orders.router, prefix="/api/v1/restaurant")
app.include_router(restaurant_menu.router, prefix="/api/v1/restaurant", tags=["Restaurante - Menú"])

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
    from alembic import command
    from alembic.config import Config
    try:
        if getattr(sys, 'frozen', False):
             # FROZEN: alembic.ini is in the root of the bundle (sys._MEIPASS)
             base_dir_frozen = sys._MEIPASS
             alembic_ini_path = os.path.join(base_dir_frozen, "alembic.ini")
             script_location = os.path.join(base_dir_frozen, "alembic")
             # Override config to confirm script location
             print(f"[MIGRATION] Buscando alembic.ini congelado en: {alembic_ini_path}")
        else:
             # DEV
             base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
             alembic_ini_path = os.path.join(base_dir, "alembic.ini")
             script_location = os.path.join(base_dir, "alembic")
             
             if not os.path.exists(alembic_ini_path):
                 alembic_ini_path = "alembic.ini"

        if os.path.exists(alembic_ini_path):
            alembic_cfg = Config(alembic_ini_path)
            # FORCE script location to absolute path found above
            alembic_cfg.set_main_option("script_location", script_location)
            command.upgrade(alembic_cfg, "head")
            print("[OK] Migraciones aplicadas correctamente.")
    except Exception as e:
        print(f"[WARN] Nota sobre migraciones: {e}")

@app.on_event("startup")
def startup_event():
    # Create images directory - environment aware
    IS_DOCKER = os.getenv('DOCKER_CONTAINER', 'false').lower() == 'true'
    
    if getattr(sys, 'frozen', False):
        # FROZEN (PyInstaller): Use executable directory for data persistence
        base_dir = os.path.dirname(sys.executable)
        images_dir = os.path.join(base_dir, "data", "images", "products")
    elif IS_DOCKER:
        images_dir = "/app/data/images/products"
    else:
        # Local development
        base_dir = os.path.dirname(os.path.abspath(__file__))
        images_dir = os.path.join(base_dir, "data", "images", "products")
    
    os.makedirs(images_dir, exist_ok=True)
    print(f"[INFO] Directorio de imagenes creado: {images_dir}")
    
    # Run Alembic migrations - this is the PRIMARY way to create/update schema
    print("[INFO] Iniciando migraciones de Alembic...")
    run_migrations()
    
    # FALLBACK: Create tables if they don't exist (for development/first run)
    # This ensures the app works even if migrations fail or DB is in inconsistent state
    # BUT we want Alembic to be the main source of truth
    # try:
    #     from .database.db import Base
    #     # We only run this if tables are missing, but let's leave it as a safety net
    #     # checking only if 'users' table exists to avoid overhead
    #     from sqlalchemy import inspect
    #     inspector = inspect(engine)
    #     if not inspector.has_table("users"):
    #         print("[INFO] Tabla 'users' no detectada. Ejecutando create_all() por seguridad...")
    #         Base.metadata.create_all(bind=engine)
    #         print("[INFO] Tablas base creadas exitosamente via SQLAlchemy")
    #     else:
    #         print("[INFO] Schema verificado.")
    # except Exception as e:
    #     print(f"[WARN] Nota al verificar schema: {e}")





    # Seed Data
    from .database.db import SessionLocal
    from .routers.auth import init_admin_user
    from .routers.config import init_exchange_rates
    db = SessionLocal()
    try:
        init_admin_user(db)
        init_exchange_rates(db)

        # Initialize Payment Methods
        # Initialize Payment Methods with Better Names
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

# 1. FIRST: Mount product images (must be before frontend catch-all)
# 1. FIRST: Mount product images (must be before frontend catch-all)
IS_DOCKER = os.getenv('DOCKER_CONTAINER', 'false').lower() == 'true'

if getattr(sys, 'frozen', False):
    # FROZEN (PyInstaller): Use executable directory
    base_dir = os.path.dirname(sys.executable)
    images_dir = os.path.join(base_dir, "data", "images", "products")
elif IS_DOCKER:
    images_dir = "/app/data/images/products"
else:
    # Local development
    base_dir = os.path.dirname(os.path.abspath(__file__))
    images_dir = os.path.join(base_dir, "data", "images", "products")

# Create directory if it doesn't exist
os.makedirs(images_dir, exist_ok=True)
print(f"[INFO] Directorio de imagenes: {images_dir}")

# Mount the directory
app.mount("/images/products", StaticFiles(directory=images_dir), name="product_images")
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