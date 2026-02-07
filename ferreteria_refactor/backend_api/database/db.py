from sqlalchemy import create_engine, text, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from ..config import settings
from ..tenant_context import get_tenant_schema

# PostgreSQL-only configuration
DATABASE_URL = settings.DATABASE_URL

# PostgreSQL connection arguments
connect_args = {"client_encoding": "latin1"}
pool_config = {
    "pool_size": 20,
    "max_overflow": 10,
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
        # Multi-Tenant Logic
        schema = get_tenant_schema()
        if schema and schema != "public":
            # Inject Schema Search Path
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
            db.execute(text("SET search_path TO public"))
        except:
            pass
        db.close()
