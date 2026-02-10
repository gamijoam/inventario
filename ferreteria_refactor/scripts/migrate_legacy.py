import os
import sys
import logging
import subprocess
from sqlalchemy import create_engine, text

# --- CONFIGURACIÓN ---
LEGACY_DB_URL = os.getenv("LEGACY_DB_URL", "postgresql://postgres:GaboMac12@db_qa:5432/legacy_db")
NEW_DB_URL = os.getenv("NEW_DB_URL", "postgresql://postgres:GaboMac12@db_qa:5432/invensoft_qa")

TARGET_TENANT_NAME = "Ferreteria Migrada"
TARGET_SCHEMA = "schema_ferreteria_legacy"
TARGET_DOMAIN = "ferreteria.qa.miinventariofacil.com"

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def main():
    logger.info("🚀 INICIANDO MIGRACIÓN (FRESH START)...")
    
    try:
        legacy_engine = create_engine(LEGACY_DB_URL)
        new_engine = create_engine(NEW_DB_URL)
    except Exception as e:
        logger.error(f"❌ Error conexión: {e}")
        return

    # 1. PREPARAR BASE DE DATOS (PUBLIC)
    logger.info("⚙️ Aplicando estructura base (Public)...")
    try:
        # Esto crea users, tenants, etc. en public
        subprocess.run("alembic upgrade head", shell=True, check=True)
    except subprocess.CalledProcessError:
        logger.error("❌ Falló Alembic Public. Revisa el paso 3.")
        return

    # 2. CREAR TENANT
    with new_engine.connect() as conn:
        conn.execute(text("COMMIT"))
        exists = conn.execute(text("SELECT id FROM public.tenants WHERE schema_name = :s"), {"s": TARGET_SCHEMA}).fetchone()
        
        if not exists:
            logger.info(f"✨ Registrando Tenant '{TARGET_TENANT_NAME}'...")
            conn.execute(text("""
                INSERT INTO public.tenants (name, schema_name, domain, is_active, created_at, is_demo)
                VALUES (:n, :s, :d, true, NOW(), false)
            """), {"n": TARGET_TENANT_NAME, "s": TARGET_SCHEMA, "d": TARGET_DOMAIN})
            conn.execute(text("COMMIT"))
        
        tenant_id = conn.execute(text("SELECT id FROM public.tenants WHERE schema_name = :s"), {"s": TARGET_SCHEMA}).scalar()
        
        # Crear Schema Físico
        conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {TARGET_SCHEMA}"))
        conn.execute(text("COMMIT"))

    # 3. APLICAR ESTRUCTURA AL TENANT (Products, Sales...)
    logger.info("⚙️ Aplicando estructura al Tenant...")
    # Como es una migración limpia, upgrade heads funcionará perfecto
    cmd = f"alembic -x tenant={TARGET_SCHEMA} upgrade heads"
    try:
        subprocess.run(cmd, shell=True, check=True)
    except subprocess.CalledProcessError:
        logger.error("❌ Falló Alembic Tenant.")
        return

    # 4. MIGRAR DATOS
    logger.info("📦 Migrando Datos (Usuarios y Productos)...")
    with legacy_engine.connect() as l_conn, new_engine.connect() as n_conn:
        n_conn.execute(text("COMMIT"))
        
        # Usuarios
        users = l_conn.execute(text("SELECT * FROM public.users")).fetchall()
        for u in users:
            try:
                u_data = u._mapping if hasattr(u, '_mapping') else u
                username = u_data.get('username', 'user')
                email = u_data.get('email') or f"{username.replace(' ', '').lower()}@migracion.local"
                
                n_conn.execute(text("""
                    INSERT INTO public.users (username, email, hashed_password, full_name, is_active, is_superuser, tenant_id, created_at)
                    VALUES (:u, :e, :p, :n, true, false, :tid, NOW())
                    ON CONFLICT (email) DO NOTHING
                """), {
                    "u": username, "e": email, "p": u_data.get('hashed_password', 'xxx'), 
                    "n": u_data.get('full_name', 'Migrado'), "tid": tenant_id
                })
            except Exception: pass
        n_conn.execute(text("COMMIT"))

        # Productos
        try:
            products = l_conn.execute(text("SELECT * FROM public.products")).fetchall()
            count = 0
            for p in products:
                try:
                    p_data = p._mapping if hasattr(p, '_mapping') else p
                    n_conn.execute(text(f"""
                        INSERT INTO {TARGET_SCHEMA}.products (name, description, price, stock, sku, created_at)
                        VALUES (:name, :desc, :price, :stock, :sku, NOW())
                        ON CONFLICT (sku) DO NOTHING
                    """), {
                        "name": p_data['name'], "desc": p_data.get('description', ''),
                        "price": p_data.get('price', 0), "stock": p_data.get('stock', 0),
                        "sku": p_data.get('sku') or p_data.get('barcode') or f"GEN-{count}"
                    })
                    count += 1
                except Exception: n_conn.rollback()
            n_conn.execute(text("COMMIT"))
            logger.info(f"✅ {count} Productos migrados exitosamente.")
        except Exception as e:
            logger.warning(f"⚠️ Error leyendo productos: {e}")

    logger.info("🏁 FINALIZADO.")

if __name__ == "__main__":
    main()