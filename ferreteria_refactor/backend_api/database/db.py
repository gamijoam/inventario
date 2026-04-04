import re
from sqlalchemy import create_engine, text, event
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
from ..config import settings
from ..tenant_context import get_tenant_schema

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
    "pool_size": 80,
    "max_overflow": 50,
    "pool_timeout": 30,
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

def get_db():
    db = SessionLocal()
    try:
        # Multi-Tenant Logic
        schema = get_tenant_schema()

        if schema and schema != "public":
            try:
                _validate_schema_name(schema)
                # Verificar que el schema existe antes de hacer SET search_path
                # Si no existe, usar public silenciosamente (tenant inválido/bloqueado)
                schema_exists = db.execute(
                    text("SELECT 1 FROM information_schema.schemata WHERE schema_name = :s"),
                    {"s": schema}
                ).scalar()
                if schema_exists:
                    db.execute(text(f'SET search_path TO "{schema}", public'))
                else:
                    import logging
                    logging.getLogger(__name__).warning(
                        f"[get_db] Schema '{schema}' no existe en BD — usando public"
                    )
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
        # 🔒 SECURITY: Reset al public antes de devolver al pool
        try:
            db.rollback()  # Limpiar cualquier transacción abortada primero
            db.execute(text('SET search_path TO "$user", public'))
            db.commit()
        except Exception as reset_err:
            import logging
            logging.getLogger(__name__).error(f"Failed to reset search_path: {reset_err}")
            try:
                db.rollback()
            except Exception:
                pass
        finally:
            db.close()
