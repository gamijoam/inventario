import re
import logging
from sqlalchemy import create_engine, text, event
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
from ..config import settings
from ..tenant_context import get_tenant_schema

logger = logging.getLogger(__name__)

_SAFE_SCHEMA_RE = re.compile(r'^[a-zA-Z0-9_-]+$')

def _validate_schema_name(schema: str) -> None:
    """Raise ValueError if schema contains any character outside [a-zA-Z0-9_-].

    PostgreSQL SET search_path does not support bind parameters, so we
    must whitelist the identifier before embedding it in SQL.  An invalid
    name indicates either a misconfigured tenant or an injection attempt.
    Hyphens are allowed since tenant schema names may contain them
    (e.g. 'lavado-automoto-y-accesorios-el-progresito') and are safe
    when the schema name is quoted with double quotes in SET search_path.
    """
    if not _SAFE_SCHEMA_RE.match(schema):
        raise ValueError(
            f"Invalid schema name '{schema}': only alphanumeric characters, "
            "underscores, and hyphens are allowed."
        )

# Database Configuration
DATABASE_URL = settings.DATABASE_URL

# PostgreSQL connection arguments
connect_args = {"client_encoding": "utf8"}
pool_config = {
    "pool_size": 20,        # Reducido: 20 conexiones base (era 80)
    "max_overflow": 10,     # Reducido: max 30 total (era 130)
    "pool_timeout": 30,
    "pool_recycle": 1800,   # Reciclar conexiones cada 30min evita conexiones zombie
    "pool_pre_ping": True,  # Verificar conexión antes de usar (evita errores de BD caída)
    "pool_recycle": 1800,
    "pool_pre_ping": True
}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    **pool_config
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, expire_on_commit=False)

Base = declarative_base()


# ===========================================================================
# 🔒 SEARCH_PATH PERSISTENCE FIX — connection-level event listener
# ===========================================================================
# Problem: PostgreSQL SET search_path is session-level, but db.commit()
# inside request handlers can cause SQLAlchemy to reconnect. The new
# connection doesn't have search_path set, so queries fail looking for
# tables in the public schema.
#
# Solution: Re-apply search_path on EVERY connection checkout from the pool.
# ===========================================================================

_schema_cache: dict = {}

def _apply_search_path(dbapi_conn, connection_record, connection_proxy=None):
    """Apply the correct search_path on every connection checkout."""
    schema = get_tenant_schema()
    if not schema or schema == "public":
        return  # Default search_path is fine

    if not _SAFE_SCHEMA_RE.match(schema):
        logger.warning(f"[search_path] Rejected unsafe schema: {schema}")
        return

    # Check schema existence (cached to reduce DB queries)
    if schema not in _schema_cache:
        cursor = dbapi_conn.cursor()
        try:
            cursor.execute(
                "SELECT 1 FROM information_schema.schemata WHERE schema_name = %s",
                (schema,)
            )
            exists = cursor.fetchone() is not None
            _schema_cache[schema] = exists
            if not exists:
                logger.warning(f"[search_path] Schema '{schema}' not found in DB")
        finally:
            cursor.close()
        if not _schema_cache[schema]:
            return

    try:
        cursor = dbapi_conn.cursor()
        cursor.execute(f'SET search_path TO "{schema}", public')
        cursor.close()
    except Exception as e:
        logger.error(f"[search_path] Failed to SET search_path to '{schema}': {e}")


# Register the event listener on the engine
event.listen(engine, "checkout", _apply_search_path)


def get_db():
    db = SessionLocal()
    try:
        # Multi-Tenant Logic (secondary — the checkout event listener above
        # is the primary mechanism that guarantees search_path persistence)
        schema = get_tenant_schema()

        if schema and schema != "public":
            try:
                _validate_schema_name(schema)
                # The checkout event listener already handles this, but we
                # keep the explicit SET here for the first connection in
                # case the pool hasn't fired the checkout event yet.
                db.execute(text(f'SET search_path TO "{schema}", public'))
            except ValueError as e:
                print(f"❌ Unsafe schema name rejected: {e}")
                db.rollback()
                raise RuntimeError(str(e)) from e
            except Exception as e:
                print(f"❌ Error switching to schema '{schema}': {e}")
                db.rollback()
                raise RuntimeError(f"Could not switch to tenant schema '{schema}': {str(e)}")

        yield db
    finally:
        # 🔒 SECURITY: Reset search_path before returning connection to pool
        try:
            db.rollback()  # Clear any aborted transaction first
            db.execute(text('SET search_path TO "$user", public'))
            db.commit()
        except Exception as reset_err:
            logging.getLogger(__name__).error(f"Failed to reset search_path: {reset_err}")
            try:
                db.rollback()
            except Exception:
                pass
        finally:
            db.close()
