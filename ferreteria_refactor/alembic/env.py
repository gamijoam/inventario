# -*- coding: utf-8 -*-
"""
Simplified Alembic Environment - Single Folder Strategy
Intelligently filters tables based on target schema (public vs tenant)
"""
import sys
import os
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool, text
from alembic import context

# Robust path resolution
file_path = os.path.abspath(__file__)
alembic_dir = os.path.dirname(file_path)
project_root = os.path.dirname(alembic_dir)

if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Import models and settings
from backend_api.models.models import Base
from backend_api.config import settings
from backend_api.database.db import DATABASE_URL as REAL_DATABASE_URL

# Import ALL models to ensure detection
from backend_api.models.restaurant import (
    RestaurantTable, RestaurantOrder, RestaurantOrderItem,
    RestaurantRecipe, RestaurantMenuSection, RestaurantMenuItem
)
from backend_api.models.prueba import PruebaActualizacion
from backend_api.models.prueba_vps import PruebaVPS
from backend_api.models.notas import NotasRapidas
from backend_api.models.tenant import Tenant
from backend_api.models.payment import TenantPayment
from backend_api.models.system_messages import SystemMessage
from backend_api.models.support import SupportTicket
from backend_api.models.admin_task import AdminTask

# Alembic Config
config = context.config
config.set_main_option("sqlalchemy.url", REAL_DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# ============================================================================
# SHARED TABLES (Must live in public schema)
# ============================================================================
SHARED_TABLES = {
    "users",
    "tenants", 
    "tenant_payments",
    "system_messages",
    "support_tickets",
    "admin_tasks",
    "alembic_version"  # Version tracking
}

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
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
    """Run migrations in 'online' mode with intelligent schema filtering."""
    
    # Get database URL from environment (Docker/VPS compatibility)
    db_url = os.getenv("DATABASE_URL")
    config_section = config.get_section(config.config_ini_section)
    
    if db_url:
        safe_url = db_url.split('@')[1] if '@' in db_url else db_url
        print(f"[ALEMBIC] Using DB from environment: {safe_url}")
        config_section["sqlalchemy.url"] = db_url
        
    connectable = engine_from_config(
        config_section,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args={'client_encoding': 'utf8'}
    )

    with connectable.connect() as connection:
        # ====================================================================
        # SCHEMA DETECTION: Determine if we're running on public or tenant
        # ====================================================================
        # Priority 1: Check -x tenant=schema argument (from admin script)
        x_args = context.get_x_argument(as_dictionary=True)
        tenant_arg = x_args.get("tenant")
        
        if tenant_arg:
            target_schema = tenant_arg
        else:
            # Priority 2: Check Environment Variable (from Docker/CI)
            target_schema = os.getenv("ALEMBIC_SCHEMA", "public")
        
        print(f"\n{'='*60}")
        print(f"[ALEMBIC] Target Schema: {target_schema}")
        print(f"{'='*60}\n")
        
        # Set search_path based on target
        if target_schema == "public":
            connection.execute(text("SET search_path TO public"))
            version_table = "alembic_version"
        else:
            # Tenant schema: prioritize tenant, fallback to public for shared tables
            connection.execute(text(f'SET search_path TO "{target_schema}", public'))
            version_table = "alembic_version"
        
        # ====================================================================
        # INTELLIGENT FILTERING: include_object hook
        # ====================================================================
        def include_object(object, name, type_, reflected, compare_to):
            """
            Filter tables based on target schema:
            - public: Only include SHARED_TABLES
            - tenant: Exclude SHARED_TABLES (they're inherited from public)
            """
            if type_ != "table":
                return True
            
            is_shared_table = name in SHARED_TABLES
            
            if target_schema == "public":
                # Running on public: ONLY include shared tables
                if is_shared_table:
                    print(f"  ✓ Including shared table: {name}")
                    return True
                else:
                    print(f"  ✗ Skipping tenant table in public: {name}")
                    return False
            else:
                # Running on tenant: EXCLUDE shared tables (avoid duplication)
                if is_shared_table:
                    print(f"  ✗ Skipping shared table in tenant: {name}")
                    return False
                else:
                    print(f"  ✓ Including tenant table: {name}")
                    return True
        
        # ====================================================================
        # CONFIGURE CONTEXT
        # ====================================================================
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,
            version_table=version_table,
            version_table_schema=target_schema if target_schema != "public" else None, # Use None for public to avoid explicit prefixing
            include_object=include_object,
            compare_type=True,
            compare_server_default=True
        )

        with context.begin_transaction():
            context.run_migrations()
        
        print(f"\n{'='*60}")
        print(f"[ALEMBIC] Migration completed for: {target_schema}")
        print(f"{'='*60}\n")
        
        # CRITICAL: Commit the transaction started by SET search_path
        connection.commit()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
