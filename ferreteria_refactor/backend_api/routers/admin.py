from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Any
import os
import sys
import argparse
import re
from alembic import command
from alembic.config import Config

from ..database.db import get_db, engine, Base
from ..dependencies import get_current_superuser
# Import ALL models to ensure they are registered in Base.metadata for reflection
from ..models import models
from ..models import tenant as tenant_model
from ..models import payment
from ..models import restaurant
from ..models import notas

from ..models.models import User, UserRole
from ..models.tenant import Tenant
from ..models.payment import TenantPayment
from ..schemas.tenant import TenantOut, TenantCreate, TenantUpdate
from ..schemas import payment as payment_schema
from .. import schemas
from ..security import get_password_hash
from ..config import settings

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(get_current_superuser)]  # 🔒 SUPERUSER ONLY
)

@router.post("/tenants", response_model=TenantOut, status_code=status.HTTP_201_CREATED)
def create_tenant(
    tenant_in: TenantCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """
    Create a new Tenant (Company).
    
    1. Validates schema name.
    2. Creates Tenant record in public.tenants.
    3. Creates PostgreSQL SCHEMA.
    4. PROVISION TABLES (Schema Reflection) - No Alembic dependecy.
    5. Creates initial Admin User in the new schema.
    """
    # 1. Validate Schema Name (Security)
    schema = tenant_in.schema_name.lower().strip()
    if not re.match(r'^[a-z0-9_]+$', schema) or schema == "public" or schema.startswith("pg_"):
        raise HTTPException(400, "Invalid schema name. Use lowercase alphanumeric and underscores.")

    # 2. Check duplicates
    if db.query(Tenant).filter(Tenant.schema_name == schema).first():
        raise HTTPException(400, f"Schema '{schema}' already exists.")
    
    if tenant_in.domain and db.query(Tenant).filter(Tenant.domain == tenant_in.domain).first():
        raise HTTPException(400, f"Domain '{tenant_in.domain}' is already taken.")
        
    try:
        # 3. Create Tenant Record
        new_tenant = Tenant(
            name=tenant_in.name,
            schema_name=schema,
            domain=tenant_in.domain,
            config=tenant_in.config,
            is_active=True,
            is_demo=tenant_in.is_demo,
            subscription_expires_at=tenant_in.subscription_expires_at
        )
        db.add(new_tenant)
        db.commit()
        db.refresh(new_tenant)
        
        # 4. Create Schema DDL
        print(f"🏗️ Creating schema: {schema}")
        db.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema}"'))
        db.commit() 
        
        # 5. Schema Reflection (Create Tables)
        print(f"🏗️ Provisión de tablas via Schema Reflection en {schema}...")
        
        # Use a separate connection to avoid messing with current session transaction
        with engine.connect() as conn:
            with conn.begin(): # Start transaction
                # Force search_path to the new schema
                # This ensures that "schema-less" tables (Product, Sale) are created IN THIS SCHEMA
                # Tables with explicit schema="public" (User, Tenant) will be ignored by create_all because they exist.
                conn.execute(text(f'SET search_path TO "{schema}"'))
                Base.metadata.create_all(conn)
                
        print(f"✅ Tablas creadas exitosamente en: {schema}")
        
        # 6. Create Admin User in the NEW Tenant Schema
        # Switch search_path to the new tenant to insert user
        db.execute(text(f'SET search_path TO "{schema}", public'))
        
        admin_user = User(
            username="admin", # Default admin username
            email=tenant_in.admin_email,
            password_hash=get_password_hash(tenant_in.admin_password),
            role=UserRole.ADMIN,
            full_name=f"Admin {tenant_in.name}",
            is_active=True,
            is_superuser=False,
            tenant_id=new_tenant.id # 🔒 Link user to this tenant 
        )
        db.add(admin_user)
        db.commit()

        # 7. Seed Initial Tenant Data (Currencies, Payment Methods, Warehouse)
        from ..utils.tenant_seeding import seed_tenant_data
        
        # 7. Seed Initial Tenant Data (Currencies, Payment Methods, Warehouse)
        from ..utils.tenant_seeding import seed_tenant_data
        from ..database.db import SessionLocal
        
        # Use a FRESH session for seeding to avoid any transaction/search_path conflicts
        # with the main request session (which might be reset by middleware or dependencies)
        seed_db = SessionLocal()
        try:
            seed_tenant_data(seed_db, schema)
        finally:
            seed_db.close()
            
        print(f"✅ Seeding completed for {schema}")
        
        return new_tenant
        
    except Exception as e:
        db.rollback()
        # In a real production system, you might want to 'DROP SCHEMA' if migration failed 
        print(f"🔥 Error creating tenant: {e}")
        raise HTTPException(500, f"Failed to create tenant: {str(e)}")

@router.get("/tenants", response_model=Dict[str, Any])
def list_tenants(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """
    Get list of all tenants (companies/schemas) in the system.
    """
    try:
        tenants = db.query(Tenant).order_by(Tenant.created_at.desc()).all()
        
        tenant_list = []
        for tenant in tenants:
            user_count = 0
            try:
                # Count users in specific schema
                sql = text(f'SELECT COUNT(*) FROM "{tenant.schema_name}".users')
                user_count = db.execute(sql).scalar() or 0
            except Exception:
                pass
            
            # Map to TenantOut manually to include runtime computed fields
            t_out = TenantOut.model_validate(tenant)
            t_out.user_count = user_count
            tenant_list.append(t_out)
        
        return {
            "total": len(tenant_list),
            "tenants": tenant_list
        }
    except Exception as e:
        raise HTTPException(500, f"Error listing tenants: {str(e)}")

@router.get("/tenants/{tenant_id}", response_model=TenantOut)
def get_tenant_details(
    tenant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(404, "Tenant not found")
        
    try:
        sql = text(f'SELECT COUNT(*) FROM "{tenant.schema_name}".users')
        user_count = db.execute(sql).scalar() or 0
        
        t_out = TenantOut.model_validate(tenant)
        t_out.user_count = user_count
        return t_out
    except Exception as e:
        # Fallback if validation fails or schema issues
        return tenant

@router.get("/tenants/{tenant_id}/users")
def get_tenant_users(
    tenant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """
    List all users belonging to a specific Tenant.
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(404, "Tenant not found")
        
    try:
        # Query users from the tenant's schema
        # We manually map columns because we are querying a different schema than the default session might expect
        # or we can use raw SQL for simplicity in this admin context.
        sql = text(f'SELECT id, username, email, full_name, role, is_active FROM "{tenant.schema_name}".users')
        results = db.execute(sql).fetchall()
        
        users = []
        for row in results:
            users.append({
                "id": row.id,
                "username": row.username,
                "email": row.email,
                "full_name": row.full_name,
                "role": row.role,
                "is_active": row.is_active
            })
            
        return users
        
    except Exception as e:
        print(f"Error fetching tenant users: {e}")
        raise HTTPException(500, f"Error fetching users: {str(e)}")

@router.post("/tenants/{tenant_id}/users", status_code=status.HTTP_201_CREATED)
def create_tenant_user(
    tenant_id: int,
    user_in: schemas.UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """
    Create a new User inside a specific Tenant.
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(404, "Tenant not found")
        
    schema = tenant.schema_name
    
    try:
        # Switch to Tenant Schema
        db.execute(text(f'SET search_path TO "{schema}", public'))
        
        # Check if username exists IN THAT SCHEMA
        existing = db.query(User).filter(User.username == user_in.username).first()
        if existing:
            # Revert search path before raising
            db.execute(text("SET search_path TO public"))
            raise HTTPException(400, "Username already exists in this tenant")
            
        # Create User
        new_user = User(
            username=user_in.username,
            password_hash=get_password_hash(user_in.password),
            email=user_in.email,
            full_name=user_in.full_name,
            role=user_in.role.upper(), # Ensure ENUM compat
            is_active=True
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        # Reset search path
        db.execute(text("SET search_path TO public"))
        
        return {
            "id": new_user.id,
            "username": new_user.username,
            "email": new_user.email,
            "role": new_user.role,
            "is_active": new_user.is_active
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        db.rollback()
        # Ensure search path is reset even on error
        try:
            db.execute(text("SET search_path TO public"))
        except:
            pass
        print(f"Error creating tenant user: {e}")
        raise HTTPException(500, f"Failed to create user: {str(e)}")

@router.patch("/tenants/{tenant_id}/status", response_model=TenantOut)
def toggle_tenant_status(
    tenant_id: int,
    status_update: TenantUpdate, # reusing Update schema but only reading is_active
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """
    Suspend or Activate a Tenant.
    Payload: {"is_active": false}
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(404, "Tenant not found")
        
    if status_update.is_active is not None:
        tenant.is_active = status_update.is_active
        db.commit()
        db.refresh(tenant)
        
    return tenant

@router.patch("/tenants/{tenant_id}", response_model=TenantOut)
def update_tenant(
    tenant_id: int,
    tenant_in: TenantUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """
    Update generic Tenant fields (Name, Domain, Config).
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(404, "Tenant not found")
        
    if tenant_in.name is not None:
        tenant.name = tenant_in.name
        
    if tenant_in.domain is not None:
        # Check uniqueness if domain changed
        if tenant_in.domain != tenant.domain:
            existing = db.query(Tenant).filter(Tenant.domain == tenant_in.domain).first()
            if existing:
                raise HTTPException(400, "Domain already associated with another tenant")
            tenant.domain = tenant_in.domain
            
    if tenant_in.config is not None:
        # Merging config could be better but simplified replaced here
        tenant.config = tenant_in.config

    if tenant_in.is_active is not None:
        tenant.is_active = tenant_in.is_active

    if tenant_in.is_demo is not None:
        tenant.is_demo = tenant_in.is_demo

    if tenant_in.subscription_expires_at is not None:
        tenant.subscription_expires_at = tenant_in.subscription_expires_at

    db.commit()
    db.refresh(tenant)
    return tenant

@router.delete("/tenants/{tenant_id}", status_code=204)
def delete_tenant(
    tenant_id: int,
    confirm: bool = False, # Query param for safety
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """
    ⚠️ DESTRUCTIVE: Delete Tenant and DROP entire SCHEMA.
    Must pass ?confirm=true
    """
    if not confirm:
        raise HTTPException(400, "Must explicitly confirm deletion with ?confirm=true")
        
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(404, "Tenant not found")
        
    schema_name = tenant.schema_name
    
    try:
        # 1. CASCADE DELETE: Remove dependent records from PUBLIC schema first
        # Users linked to this tenant
        db.query(User).filter(User.tenant_id == tenant_id).delete()
        
        # Payments linked to this tenant (if any in public, usually they are)
        db.query(TenantPayment).filter(TenantPayment.tenant_id == tenant_id).delete()
        
        # Delete Tenant Record
        db.delete(tenant)
        db.commit()
        
        # 2. DROP SCHEMA CASCADE
        print(f"🔥 DROPPING SCHEMA: {schema_name}")
        db.execute(text(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE'))
        db.commit()
        
        return None # 204 No Content
        
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Failed to delete tenant: {str(e)}")

@router.get("/tenants/{tenant_id}/payments", response_model=List[schemas.payment.PaymentOut])
def list_tenant_payments(
    tenant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """
    List history of payments for a tenant
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(404, "Tenant not found")
        
    payments = db.query(TenantPayment).filter(TenantPayment.tenant_id == tenant_id).order_by(TenantPayment.created_at.desc()).all()
    return payments

@router.post("/payments", response_model=schemas.payment.PaymentOut, status_code=status.HTTP_201_CREATED)
def create_payment(
    payment_in: schemas.payment.PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """
    Register a manual payment.
    Use this to record payments made via Zelle, Cash, etc.
    """
    tenant = db.query(Tenant).filter(Tenant.id == payment_in.tenant_id).first()
    if not tenant:
        raise HTTPException(404, "Tenant not found")
        
    new_payment = TenantPayment(
        tenant_id=payment_in.tenant_id,
        amount=payment_in.amount,
        currency=payment_in.currency,
        payment_method=payment_in.payment_method,
        reference=payment_in.reference,
        status=payment_in.status,
        notes=payment_in.notes
    )
    db.add(new_payment)
    db.commit()
    db.refresh(new_payment)
    
    return new_payment

@router.get("/stats")
def get_system_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    try:
        total_tenants = db.query(Tenant).count()
        active_tenants = db.query(Tenant).filter(Tenant.is_active == True).count()
        
        return {
            "total_tenants": total_tenants,
            "active_tenants": active_tenants,
            "inactive_tenants": total_tenants - active_tenants,
            "tenants_by_plan": {} 
        }
        
    except Exception as e:
        raise HTTPException(500, f"Error calculating stats: {str(e)}")
