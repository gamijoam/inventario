"""
desktop_backend/main.py

FastAPI app del backend de escritorio.

IMPORTANTE: Las variables de entorno para backend_api se deben fijar
ANTES de importar cualquier módulo de backend_api, porque SQLAlchemy
crea el engine al momento de import.

Para arrancar:
    cd ferreteria_refactor/
    python -m desktop_backend.run

O con uvicorn directamente (después de fijar las env vars):
    uvicorn desktop_backend.main:app --host 127.0.0.1 --port 8000
"""
import os
import sys
import time
import traceback
from pathlib import Path

# Forzar UTF-8 en Windows para evitar UnicodeEncodeError con emojis
os.environ.setdefault("PYTHONUTF8", "1")
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# ─────────────────────────────────────────────────────────────────────────────
# PASO 1: Configurar variables de entorno ANTES de importar backend_api
# ─────────────────────────────────────────────────────────────────────────────
from .config import (
    DESKTOP_DATABASE_URL,
    DESKTOP_SCHEMA,
    DESKTOP_DATA_DIR,
    get_or_create_secret_key,
)

os.environ.setdefault("DATABASE_URL",                  DESKTOP_DATABASE_URL)
os.environ.setdefault("ENVIRONMENT",                   "desktop")
os.environ.setdefault("SECRET_KEY",                    get_or_create_secret_key())
os.environ.setdefault("SECURE_COOKIES",                "false")
os.environ.setdefault("COOKIE_DOMAIN",                 "")
os.environ.setdefault("MEDIA_ROOT",                    str(DESKTOP_DATA_DIR / "media"))
os.environ.setdefault("TIMEZONE",                      "America/Caracas")
os.environ.setdefault("ENABLE_LOCAL_SYNC",             "false")
# Todos los módulos habilitados en desktop
os.environ.setdefault("MODULE_RESTAURANT_ENABLED",     "true")
os.environ.setdefault("MODULE_SERVICES_ENABLED",       "true")
os.environ.setdefault("MODULE_LAUNDRY_ENABLED",        "true")
# SMTP deshabilitado por defecto en desktop
os.environ.setdefault("SMTP_HOST",                     "")

# ─────────────────────────────────────────────────────────────────────────────
# PASO 2: Asegurar que ferreteria_refactor/ está en sys.path
# ─────────────────────────────────────────────────────────────────────────────
_FERRETERIA_DIR = str(Path(__file__).parent.parent)
if _FERRETERIA_DIR not in sys.path:
    sys.path.insert(0, _FERRETERIA_DIR)

# ─────────────────────────────────────────────────────────────────────────────
# PASO 3: Importar FastAPI y módulos de backend_api
# ─────────────────────────────────────────────────────────────────────────────
from fastapi import FastAPI, APIRouter, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.sessions import SessionMiddleware
from pydantic import BaseModel as PydanticBaseModel

# Routers del backend existente (sin modificar)
from backend_api.routers.products       import router as products_router
from backend_api.routers.customers      import router as customers_router
from backend_api.routers.quotes         import router as quotes_router
from backend_api.routers.cash           import router as cash_router
from backend_api.routers.suppliers      import router as suppliers_router
from backend_api.routers.inventory      import router as inventory_router
from backend_api.routers.returns        import router as returns_router
from backend_api.routers.reports        import router as reports_router
from backend_api.routers.purchases      import router as purchases_router
from backend_api.routers.users          import router as users_router
from backend_api.routers.config         import router as config_router
from backend_api.routers.auth           import router as auth_router
from backend_api.routers.categories     import router as categories_router
from backend_api.routers.websocket      import router as websocket_router
from backend_api.routers.audit          import router as audit_router
from backend_api.routers.system         import router as system_router
from backend_api.routers.payment_methods import router as payment_methods_router
from backend_api.routers.credits        import router as credits_router
from backend_api.routers.services       import router as services_router
from backend_api.routers.commissions    import router as commissions_router
from backend_api.routers.rma            import router as rma_router
from backend_api.routers.price_lists    import router as price_lists_router
from backend_api.routers.employees      import router as employees_router
from backend_api.routers.warehouses     import router as warehouses_router
from backend_api.routers.transfers      import router as transfers_router
from backend_api.routers.warranties     import router as warranties_router
from backend_api.routers.support_client import router as support_client_router
from backend_api.routers.modules.restaurant import tables as restaurant_tables
from backend_api.routers.modules.restaurant import orders as restaurant_orders
from backend_api.routers.modules.restaurant import menu   as restaurant_menu
from backend_api.config import settings

# Middleware y startup propios del desktop
from .middleware import DesktopTenantMiddleware
from .startup   import initialize_desktop
from . import startup as _startup

# ─────────────────────────────────────────────────────────────────────────────
# PASO 4: Crear la app FastAPI
# ─────────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Invensoft Desktop API",
    description="Backend local para Invensoft Desktop.",
    version="1.0.0",
)

# ── CORS: solo origenes locales (Tauri + dev) ─────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "tauri://localhost",
        "http://tauri.localhost",
        "http://localhost:5173",   # Vite dev
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# ── Session middleware (necesario para cookies de auth) ───────────────────────
app.add_middleware(SessionMiddleware, secret_key=os.environ["SECRET_KEY"])

# ── Tenant fijo: siempre 'desktop_local' ─────────────────────────────────────
# NOTA: Este middleware va ANTES del LoggingMiddleware para que el schema
# esté disponible desde el inicio del ciclo de la request.
app.add_middleware(DesktopTenantMiddleware)

# ── Logging básico ────────────────────────────────────────────────────────────
class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.time()
        print(f"→ {request.method} {request.url.path}", flush=True)
        try:
            response = await call_next(request)
            print(f"← {response.status_code} ({time.time()-start:.3f}s)", flush=True)
            return response
        except Exception as e:
            print(f"🔥 CRASH {request.url.path}: {e}", flush=True)
            traceback.print_exc()
            raise

app.add_middleware(LoggingMiddleware)

# ── Global exception handler ──────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "type": type(exc).__name__},
    )

# ─────────────────────────────────────────────────────────────────────────────
# PASO 5: Startup event — inicializar DB local
# ─────────────────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    await initialize_desktop()

# ─────────────────────────────────────────────────────────────────────────────
# PASO 6: Registrar todos los routers
# ─────────────────────────────────────────────────────────────────────────────
v1 = APIRouter(prefix="/api/v1")

v1.include_router(auth_router,           tags=["Auth"])
v1.include_router(products_router,       tags=["Productos"])
v1.include_router(categories_router,     tags=["Categorías"])
v1.include_router(customers_router,      tags=["Clientes"])
v1.include_router(quotes_router,         tags=["Presupuestos"])
v1.include_router(cash_router,           tags=["Caja"])
v1.include_router(suppliers_router,      tags=["Proveedores"])
v1.include_router(inventory_router,      tags=["Inventario"])
v1.include_router(returns_router,        tags=["Devoluciones"])
v1.include_router(reports_router,        tags=["Reportes"])
v1.include_router(purchases_router,      tags=["Compras"])
v1.include_router(users_router,          tags=["Usuarios"])
v1.include_router(config_router,         tags=["Configuración"])
v1.include_router(websocket_router,      tags=["WebSocket"])
v1.include_router(audit_router,          tags=["Auditoría"])
v1.include_router(system_router,         tags=["Sistema"])
v1.include_router(payment_methods_router, tags=["Métodos de Pago"])
v1.include_router(credits_router,        tags=["Créditos"])
v1.include_router(services_router,       tags=["Servicios Técnicos"])
v1.include_router(commissions_router,    tags=["Comisiones"])
v1.include_router(rma_router,            tags=["Garantías RMA"])
v1.include_router(price_lists_router,    tags=["Listas de Precios"])
v1.include_router(employees_router,      tags=["Empleados"])
v1.include_router(warehouses_router,     tags=["Almacenes"])
v1.include_router(transfers_router,      tags=["Traslados"])
v1.include_router(warranties_router,     tags=["Garantías"])
v1.include_router(support_client_router, tags=["Soporte"])

# Módulo restaurante
v1.include_router(restaurant_tables.router, prefix="/restaurant", tags=["Restaurante"])
v1.include_router(restaurant_orders.router, prefix="/restaurant", tags=["Restaurante"])
v1.include_router(restaurant_menu.router,   prefix="/restaurant", tags=["Restaurante"])

app.include_router(v1)

# ─────────────────────────────────────────────────────────────────────────────
# Endpoints propios del desktop
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/api/v1/health")
def health_check():
    return {
        "status": "ok",
        "service": "invensoft-desktop",
        "schema": DESKTOP_SCHEMA,
        "first_run": _startup.IS_FIRST_RUN,
    }


@app.get("/api/v1/desktop/info")
def desktop_info():
    """Info del entorno desktop — para que el frontend sepa que está en modo local."""
    return {
        "mode": "desktop",
        "schema": DESKTOP_SCHEMA,
        "first_run": _startup.IS_FIRST_RUN,
        "version": "1.0.0",
    }


class FirstAdminRequest(PydanticBaseModel):
    full_name: str
    username: str
    password: str


@app.post("/api/v1/desktop/setup/admin")
def create_first_admin(data: FirstAdminRequest):
    """
    Crea el primer usuario administrador en el primer arranque.
    Solo funciona si no hay ningún usuario en desktop_local.
    """
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import sessionmaker
    from passlib.context import CryptContext
    from backend_api.models.models import User, UserRole
    from backend_api.utils.time_utils import get_venezuela_now

    if not _startup.IS_FIRST_RUN:
        raise HTTPException(status_code=403, detail="El setup ya fue completado")

    engine = create_engine(
        DESKTOP_DATABASE_URL,
        connect_args={"client_encoding": "utf8"},
        pool_pre_ping=True,
    )
    Session = sessionmaker(bind=engine)
    db = Session()

    try:
        # Doble chequeo: verificar que no existan usuarios
        db.execute(text(f'SET search_path TO "{DESKTOP_SCHEMA}", public'))
        existing = db.query(User).count()
        if existing > 0:
            raise HTTPException(status_code=403, detail="Ya existen usuarios en el sistema")

        # Obtener tenant_id
        tenant_row = db.execute(
            text("SELECT id FROM public.tenants WHERE schema_name = :s"),
            {"s": DESKTOP_SCHEMA}
        ).fetchone()
        tenant_id = tenant_row[0] if tenant_row else None

        # Crear admin (email auto-generado: no se usa para nada en desktop)
        pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
        admin = User(
            username=data.username,
            password_hash=pwd_ctx.hash(data.password),
            email=f"{data.username}@desktop.local",
            role=UserRole.ADMIN,
            full_name=data.full_name,
            is_active=True,
            tenant_id=tenant_id,
            created_at=get_venezuela_now(),
        )
        db.add(admin)
        db.commit()

        # Marcar que ya no es primer arranque
        _startup.IS_FIRST_RUN = False

        return {"status": "ok", "message": "Administrador creado exitosamente", "username": data.username}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al crear administrador: {str(e)}")
    finally:
        db.close()
        engine.dispose()
