# -*- coding: utf-8 -*-
"""Alembic environment configuration with UTF-8 enforcement"""
import sys
import os

# Force UTF-8 encoding for all file operations
# DISABLED: This causes deadlock when running from subprocess.run()
# if sys.version_info >= (3, 7):
#     # Python 3.7+ uses UTF-8 by default, but let's be explicit
#     import io
#     sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
#     sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# Add the project root directory to the python path
# sys.path.append(os.getcwd()) # This is unreliable if CWD changes

# Robust path resolution
file_path = os.path.abspath(__file__) # .../ferreteria_refactor/alembic/env.py
alembic_dir = os.path.dirname(file_path) # .../ferreteria_refactor/alembic
project_root = os.path.dirname(alembic_dir) # .../ferreteria_refactor

if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Import the models and settings
from backend_api.models.models import Base
from backend_api.config import settings
from backend_api.database.db import DATABASE_URL as REAL_DATABASE_URL

# ⚠️ CRÍTICO: Importar TODOS los modelos para que Alembic los detecte
# Sin estas importaciones, Alembic NO generará migraciones para Restaurant
from backend_api.models.restaurant import (
    RestaurantTable,
    RestaurantOrder,
    RestaurantOrderItem,
    RestaurantRecipe,
    RestaurantMenuSection,
    RestaurantMenuItem
)

# Modelo de prueba para validar actualizaciones incrementales
from backend_api.models.prueba import PruebaActualizacion
from backend_api.models.prueba_vps import PruebaVPS
from backend_api.models.notas import NotasRapidas
from backend_api.models.tenant import Tenant # Register Tenant model
from sqlalchemy import text # For SET search_path

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Overwrite the sqlalchemy.url in the config object
config.set_main_option("sqlalchemy.url", REAL_DATABASE_URL)

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    # Lógica para Docker: Leer URL del entorno
    import os
    
    # Obtenemos la URL del .env (inyectada por Docker Compose)
    db_url = os.getenv("DATABASE_URL")
    
    config_section = config.get_section(config.config_ini_section)
    
    if db_url:
        # Si existe la variable (estamos en Docker o Prod), sobrescribimos la URL del .ini
        safe_url = db_url.split('@')[1] if '@' in db_url else db_url
        print(f"🔌 [ALEMBIC] Usando conexión de base de datos desde entorno: {safe_url}") 
        config_section["sqlalchemy.url"] = db_url
        
    connectable = engine_from_config(
        config_section,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args={'client_encoding': 'utf8'}
    )

    with connectable.connect() as connection:
        # --- MULTI-TENANT LOGIC ---
        # Read -x tenant=schema_name argument
        x_args = context.get_x_argument(as_dictionary=True)
        tenant_schema = x_args.get("tenant")
        
        if tenant_schema:
            print(f"🔍 [ALEMBIC] Configuring for TENANT schema: {tenant_schema}")
            
            # --- ISOLATION FIX ---
            # We use a DIFFERENT version table name for tenants to avoid conflict with public schema
            # This ensures Alembic doesn't accidentally read version from public.alembic_version
            version_table = "alembic_version_tenant"
            
            # Set search path to tenant schema (and public for shared types if any)
            connection.execute(text(f'SET search_path TO "{tenant_schema}", public'))
            target_schema = tenant_schema
            
            print(f"✅ [ALEMBIC] Using ISOLATED version table: {version_table} in {tenant_schema}")

        else:
            print("🌍 [ALEMBIC] Running migrations for PUBLIC schema")
            version_table = "alembic_version" # Default for public
            target_schema = "public"          # Explicitly set for public schema
            # Ensure search path includes public
            connection.execute(text("SET search_path TO public"))

        context.configure(
            connection=connection, 
            target_metadata=target_metadata,
            render_as_batch=True,
            version_table_schema=target_schema, # Stores table in the correct schema
            version_table=version_table # USE THE ISOLATED NAME
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
