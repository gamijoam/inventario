"""
migrate_image_original.py
-------------------------
Migración idempotente que agrega la columna `image_url_original` a la tabla
`products` de cada schema de tenant. Esta columna almacena la URL de la imagen
ORIGINAL del producto (antes del proceso de "eliminar fondo"), permitiendo
restaurar el fondo si el usuario lo desea.

Se ejecuta automáticamente en startup (main.py) y es IDEMPOTENTE.

Pattern: alineado con migrate_multicaja.py / migrate_barbershop.py.
"""
import os
import sys
from sqlalchemy import text, inspect


def migrate_image_original(db_engine=None):
    if not db_engine:
        from .database.db import engine as default_engine
        db_engine = default_engine

    inspector = inspect(db_engine)
    all_schemas = inspector.get_schema_names()

    tenant_schemas = [s for s in all_schemas if s not in ['information_schema']]
    tenant_schemas = [s for s in tenant_schemas if not s.startswith('pg_')]

    print(f"\n🖼️  ImageOriginal Migration — Schemas: {tenant_schemas}")

    with db_engine.begin() as conn:
        for schema in tenant_schemas:
            try:
                # ¿Existe la tabla products en este schema?
                has_products = conn.execute(text(
                    "SELECT EXISTS ("
                    "  SELECT 1 FROM information_schema.tables "
                    "  WHERE table_schema = :s AND table_name = 'products'"
                    ")"
                ), {"s": schema}).scalar()

                if not has_products:
                    continue

                # ALTER idempotente
                conn.execute(text(
                    f'ALTER TABLE "{schema}".products '
                    f'ADD COLUMN IF NOT EXISTS image_url_original VARCHAR(500)'
                ))
                print(f"   ✅ {schema}.products.image_url_original OK")
            except Exception as e:
                print(f"   ⚠️  {schema}: {e}")

    print("🎉 ImageOriginal Migration Completed!")
