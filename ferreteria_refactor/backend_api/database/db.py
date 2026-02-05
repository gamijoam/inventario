from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from ..config import settings

# Hybrid Database Support
# If DB_TYPE is 'sqlite' or DATABASE_URL contains 'sqlite', we adapt.
import os
import sqlite3
from decimal import Decimal

# Register adapter for Decimal -> float in SQLite to avoid "Error binding parameter: type 'decimal.Decimal' is not supported"
sqlite3.register_adapter(Decimal, lambda x: float(x))
sqlite3.register_converter("DECIMAL", lambda x: Decimal(x))

# Force PostgreSQL to speak UTF-8 and English (to avoid Windows Spanish locale issues)
os.environ["PGCLIENTENCODING"] = "utf-8"
os.environ["LC_MESSAGES"] = "C"

DB_TYPE = os.getenv("DB_TYPE", "postgres")
DATABASE_URL = settings.DATABASE_URL

if DB_TYPE == "sqlite" or "sqlite" in str(DATABASE_URL):
    # Desktop App Mode
    # Desktop App Mode
    if DB_TYPE == "sqlite":
        import sys
        db_name = os.getenv("SQLITE_DB_NAME", "ferreteria.db")
        
        if getattr(sys, 'frozen', False):
            # FROZEN: Use executable directory
            base_path = os.path.dirname(sys.executable)
            db_path = os.path.join(base_path, db_name)
            DATABASE_URL = f"sqlite:///{db_path}"
            # Asegurar que el directorio existe (aunque sea root)
            os.makedirs(base_path, exist_ok=True)
            print(f"[DB] Modo Congelado detectado. Usando BD en: {db_path}")
        else:
            # DEV MODE:
            # Resolve relative to this file to ensure consistency regardless of CWD.
            # This file is in .../ferreteria_refactor/backend_api/database/db.py
            # We want to access the DB in the project root: .../ferreteria/ferreteria.db
            
            # current_dir = .../backend_api/database
            current_dir = os.path.dirname(os.path.abspath(__file__))
            
            # Up 3 levels to reach 'ferreteria' (root)
            # 1. backend_api
            # 2. ferreteria_refactor
            # 3. ferreteria (ROOT)
            project_root = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))
            
            db_path = os.path.join(project_root, db_name)
            DATABASE_URL = f"sqlite:///{db_path}"
            print(f"[DB] Modo Desarrollo. Usando BD absoluta: {db_path}")
        
    connect_args = {"check_same_thread": False, "timeout": 30}
    pool_config = {} # SQLite doesn't use the same pool config as Postgres
else:
    # VPS/Docker Mode (Postgres)
    # CRITICAL: Use 'latin1' to match Windows Spanish PostgreSQL error messages
    # This prevents UnicodeDecodeError when Auth fails
    connect_args = {"client_encoding": "latin1"}
    pool_config = {
        "pool_size": 20,        # Mantener 20 conexiones listas
        "max_overflow": 10,     # Permitir 10 extra en picos
        "pool_timeout": 30,     # Esperar 30s antes de dar error
        "pool_recycle": 1800,   # Reciclar conexiones cada 30 min
        "pool_pre_ping": True   # Verificar conexión antes de usarla
    }

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    **pool_config
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, expire_on_commit=False)

Base = declarative_base()

from sqlalchemy import text, event
from ..tenant_context import get_tenant_schema

# 🔒 SECURITY: Reset search_path on connection checkout
# This ensures that whenever a connection is pulled from the pool,
# it starts in a clean 'public' state, preventing data leakage.
@event.listens_for(engine, "checkout")
def receive_checkout(dbapi_connection, connection_record, connection_proxy):
    cursor = dbapi_connection.cursor()
    try:
        cursor.execute("SET search_path TO public")
    except Exception as e:
        print(f"❌ Error resetting search_path on checkout: {e}")
    finally:
        cursor.close()

def get_db():
    db = SessionLocal()
    try:
        # Multi-Tenant Logic (Only for Postgres/Production)
        if DB_TYPE == "postgres" or "postgres" in str(DATABASE_URL):
            schema = get_tenant_schema()
            if schema and schema != "public":
                # Inject Schema Search Path
                # "schema, public" means: try schema first, fallback to public
                try:
                    db.execute(text(f'SET search_path TO "{schema}", public'))
                except Exception as e:
                    print(f"❌ Error setting schema '{schema}': {e}")
                    db.rollback()
                    raise RuntimeError(f"Could not switch to tenant schema: {schema}")
        
        yield db
    finally:
        # 🔒 SECURITY: Explicitly reset to public before returning to pool
        try:
            if DB_TYPE == "postgres" or "postgres" in str(DATABASE_URL):
                db.execute(text("SET search_path TO public"))
        except:
            pass
        db.close()
