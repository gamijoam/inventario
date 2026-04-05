from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Any, Optional
from enum import Enum
import os
import sys
import argparse
import re
import logging
from alembic import command
from alembic.config import Config

logger = logging.getLogger(__name__)

from ..database.db import get_db, engine, Base, _validate_schema_name
from ..dependencies import get_current_superuser
# Import ALL models to ensure they are registered in Base.metadata for reflection
from ..models import models
from ..models import tenant as tenant_model
from ..models import payment
from ..models import restaurant

from ..models.models import User, UserRole
from ..models.tenant import Tenant
from ..models.payment import TenantPayment
from ..schemas.tenant import TenantOut, TenantCreate, TenantUpdate
from ..schemas import payment as payment_schema
from .. import schemas
from datetime import datetime, timedelta
from ..security import get_password_hash, create_access_token
from ..config import settings
from ..utils.time_utils import get_venezuela_now
from ..utils.email_utils import send_welcome_email

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(get_current_superuser)]  # 🔒 SUPERUSER ONLY
)

@router.post("/tenants", response_model=TenantOut, status_code=status.HTTP_201_CREATED)
def create_tenant(
    tenant_in: TenantCreate,
    background_tasks: BackgroundTasks,
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
        trial_days = getattr(tenant_in, 'trial_days', 2) or 2
        new_tenant = Tenant(
            name=tenant_in.name,
            schema_name=schema,
            domain=tenant_in.domain,
            config=tenant_in.config,
            is_active=True,
            is_demo=tenant_in.is_demo,
            subscription_expires_at=tenant_in.subscription_expires_at,
            license_type="trial",
            trial_days=trial_days,
            trial_ends_at=datetime.utcnow() + timedelta(days=trial_days),
        )
        db.add(new_tenant)
        db.commit()
        db.refresh(new_tenant)
        
        # 4. Create Schema DDL
        print(f"🏗️ Creating schema: {schema}")
        _validate_schema_name(schema)
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
                _validate_schema_name(schema)
                conn.execute(text(f'SET search_path TO "{schema}"'))
                Base.metadata.create_all(conn)
                
        print(f"✅ Tablas creadas exitosamente en: {schema}")
        
        # 6. Create Admin User in the NEW Tenant Schema
        # Switch search_path to the new tenant to insert user
        _validate_schema_name(schema)
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

        # 7. Seed Initial Tenant Data (Currencies, Payment Methods, Warehouse, Cash Register)
        from ..utils.tenant_seeding import seed_tenant_data
        from ..services.tenant_service import TenantService
        from ..database.db import SessionLocal

        # Use a FRESH session for seeding to avoid any transaction/search_path conflicts
        # with the main request session (which might be reset by middleware or dependencies)
        seed_db = SessionLocal()
        try:
            seed_tenant_data(seed_db, schema)
        finally:
            seed_db.close()

        TenantService.seed_cash_register(schema)

        print(f"✅ Seeding completed for {schema}")

        # 8. Send welcome email in background (non-blocking)
        try:
            if tenant_in.is_demo:
                plan_label = f"Demo Gratuita {settings.LICENSE_TRIAL_DAYS_DEFAULT} días"
            elif tenant_in.subscription_expires_at:
                plan_label = f"Suscripción activa hasta {tenant_in.subscription_expires_at.strftime('%d/%m/%Y')}"
            else:
                plan_label = "Demo Gratuita"
            tenant_url = f"https://{new_tenant.schema_name}.miinventariofacil.com"
            background_tasks.add_task(
                send_welcome_email,
                email_to=tenant_in.admin_email,
                company_name=tenant_in.name,
                admin_password=tenant_in.admin_password,
                tenant_url=tenant_url,
                plan_label=plan_label,
                cc_emails=getattr(tenant_in, 'cc_emails', None) or [],
            )
        except Exception as email_err:
            logger.warning(f"⚠️ Could not schedule welcome email for {tenant_in.admin_email}: {email_err}")

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
                # Count users in public.users linked to this tenant
                sql = text('SELECT COUNT(*) FROM public.users WHERE tenant_id = :t_id')
                user_count = db.execute(sql, {"t_id": tenant.id}).scalar() or 0
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
        sql = text('SELECT COUNT(*) FROM public.users WHERE tenant_id = :t_id')
        user_count = db.execute(sql, {"t_id": tenant.id}).scalar() or 0
        
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
        # Query users from the public schema filtered by tenant_id
        sql = text('SELECT id, username, email, full_name, role, is_active FROM public.users WHERE tenant_id = :t_id')
        results = db.execute(sql, {"t_id": tenant.id}).fetchall()
        
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
        _validate_schema_name(schema)
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
            is_active=True,
            tenant_id=tenant_id
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
        except Exception:
            pass
        print(f"Error creating tenant user: {e}")
        raise HTTPException(500, f"Failed to create user: {str(e)}")

@router.patch("/tenants/{tenant_id}/users/{user_id}/email")
def update_tenant_user_email(
    tenant_id: int,
    user_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Update email of a user belonging to a specific tenant."""
    new_email = body.get("email", "").strip()
    if not new_email:
        raise HTTPException(400, "El email no puede estar vacío")

    user = db.query(User).filter(User.id == user_id, User.tenant_id == tenant_id).first()
    if not user:
        raise HTTPException(404, "Usuario no encontrado en este tenant")

    user.email = new_email
    db.commit()
    return {"id": user.id, "username": user.username, "email": user.email}


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

    # License fields
    if tenant_in.license_type is not None:
        tenant.license_type = tenant_in.license_type
    if tenant_in.trial_days is not None:
        tenant.trial_days = tenant_in.trial_days
    if tenant_in.trial_ends_at is not None:
        tenant.trial_ends_at = tenant_in.trial_ends_at
    # Allow explicitly setting license_blocked_reason to None (clear it)
    if "license_blocked_reason" in tenant_in.model_fields_set:
        tenant.license_blocked_reason = tenant_in.license_blocked_reason

    # Module Flags Updates
    if tenant_in.has_restaurant_module is not None:
        tenant.has_restaurant_module = tenant_in.has_restaurant_module
    if tenant_in.has_laundry_module is not None:
        tenant.has_laundry_module = tenant_in.has_laundry_module
    if tenant_in.has_hardware_module is not None:
        tenant.has_hardware_module = tenant_in.has_hardware_module
    if tenant_in.has_services_module is not None:
        tenant.has_services_module = tenant_in.has_services_module
    if tenant_in.has_barbershop_module is not None:
        tenant.has_barbershop_module = tenant_in.has_barbershop_module
    if tenant_in.has_pharmacy_module is not None:
        tenant.has_pharmacy_module = tenant_in.has_pharmacy_module

    db.commit()
    db.refresh(tenant)
    return tenant


@router.get("/feature-flags/registry")
def get_feature_flags_registry():
    """
    Devuelve el registro completo de feature flags conocidas.
    El panel admin usa esto para mostrar los toggles dinámicamente.
    """
    from ..feature_flags_registry import REGISTRY, CATEGORIES
    return {"registry": REGISTRY, "categories": CATEGORIES}


@router.patch("/tenants/{tenant_id}/feature-flags")
def update_tenant_feature_flags(
    tenant_id: int,
    flags: Dict[str, bool],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """
    Activa o desactiva feature flags individuales para un tenant.
    Body: {"nombre_flag": true/false, ...}
    Hace merge con los flags existentes (no reemplaza todo).
    """
    from ..feature_flags_registry import REGISTRY
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(404, "Tenant not found")

    unknown = [k for k in flags if k not in REGISTRY]
    if unknown:
        raise HTTPException(400, f"Feature flags desconocidas: {unknown}")

    current = dict(tenant.feature_flags or {})
    current.update(flags)
    tenant.feature_flags = current
    db.commit()
    db.refresh(tenant)
    return {"tenant_id": tenant_id, "feature_flags": tenant.feature_flags}


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
        # 1. DROP SCHEMA CASCADE primero — elimina todas las tablas del tenant
        #    y libera las FK que apuntan a public.users / public.tenants
        print(f"🔥 DROPPING SCHEMA: {schema_name}")
        db.execute(text(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE'))
        db.commit()

        # 2. Limpiar tablas del esquema PUBLIC que referencian este tenant
        # support_tickets está en public y tiene FK a tenants
        db.execute(
            text("DELETE FROM public.support_tickets WHERE tenant_id = :tid"),
            {"tid": tenant_id}
        )

        # 3. Eliminar usuarios del tenant (ya sin FK desde el schema eliminado)
        db.query(User).filter(User.tenant_id == tenant_id).delete()

        # 4. Eliminar pagos del tenant
        db.query(TenantPayment).filter(TenantPayment.tenant_id == tenant_id).delete()

        # 5. Eliminar el tenant
        db.delete(tenant)
        db.commit()

        return None  # 204 No Content

    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Failed to delete tenant: {str(e)}")

class LicenseAction(str, Enum):
    grant_trial = "grant_trial"
    extend_monthly = "extend_monthly"
    extend_annual = "extend_annual"
    grant_lifetime = "grant_lifetime"
    revoke = "revoke"
    reactivate = "reactivate"

class ManageLicenseRequest(BaseModel):
    action: LicenseAction
    days: Optional[int] = 30  # Solo para grant_trial

@router.post("/licenses/manage/{tenant_id}")
async def manage_tenant_license(
    tenant_id: int,
    body: ManageLicenseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    now = datetime.utcnow()

    if body.action == LicenseAction.grant_trial:
        tenant.license_type = "trial"
        tenant.trial_days = body.days or 30
        tenant.trial_ends_at = now + timedelta(days=body.days or 30)
        tenant.is_active = True
        tenant.license_blocked_reason = None
    elif body.action == LicenseAction.extend_monthly:
        tenant.license_type = "monthly"
        base = max(tenant.subscription_expires_at or now, now)
        tenant.subscription_expires_at = base + timedelta(days=30)
        tenant.is_active = True
        tenant.license_blocked_reason = None
    elif body.action == LicenseAction.extend_annual:
        tenant.license_type = "annual"
        base = max(tenant.subscription_expires_at or now, now)
        tenant.subscription_expires_at = base + timedelta(days=365)
        tenant.is_active = True
        tenant.license_blocked_reason = None
    elif body.action == LicenseAction.grant_lifetime:
        tenant.license_type = "lifetime"
        tenant.subscription_expires_at = None
        tenant.is_active = True
        tenant.license_blocked_reason = None
    elif body.action == LicenseAction.revoke:
        tenant.is_active = False
        tenant.license_blocked_reason = "manual"
    elif body.action == LicenseAction.reactivate:
        tenant.is_active = True
        tenant.license_blocked_reason = None

    db.commit()
    db.refresh(tenant)
    return {"ok": True, "tenant_id": tenant_id, "action": body.action, "license_type": tenant.license_type}


@router.get("/licenses/summary")
async def get_licenses_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
):
    """Lista todos los tenants con su estado de licencia."""
    tenants = db.query(Tenant).order_by(Tenant.created_at.desc()).all()
    now = datetime.utcnow()

    result = []
    for t in tenants:
        days_remaining = None
        if t.license_type == "trial" and t.trial_ends_at:
            days_remaining = max(0, (t.trial_ends_at - now).days)
        elif t.license_type in ("monthly", "annual") and t.subscription_expires_at:
            days_remaining = max(0, (t.subscription_expires_at - now).days)

        result.append({
            "id": t.id,
            "name": t.name,
            "schema_name": t.schema_name,
            "is_active": t.is_active,
            "license_type": t.license_type or "trial",
            "trial_days": t.trial_days,
            "trial_ends_at": t.trial_ends_at.isoformat() if t.trial_ends_at else None,
            "subscription_expires_at": t.subscription_expires_at.isoformat() if t.subscription_expires_at else None,
            "license_blocked_reason": t.license_blocked_reason,
            "days_remaining": days_remaining,
        })

    return result


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

@router.post("/tenants/{tenant_id}/impersonate")
def impersonate_tenant(
    tenant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """
    Generate an access token for the first admin user of the target tenant.
    Allows Super Admins to log in as that user (Impersonation).
    """
    # 1. Fetch Tenant
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(404, "Tenant not found")
        
    # 2. Fetch Tenant Admin User
    # We look for a user in the PUBLIC schema that is linked to this tenant_id
    # AND has role='admin' or 'owner'.
    # Note: Users created via seed/provisioning are in the public.users table but linked via tenant_id.
    
    target_user = db.query(User).filter(
        User.tenant_id == tenant_id,
        User.role == UserRole.ADMIN,
        User.is_active == True
    ).first()
    
    if not target_user:
        # Fallback: try finding any user for this tenant if no admin found (unlikely)
        target_user = db.query(User).filter(
            User.tenant_id == tenant_id,
            User.is_active == True
        ).first()
        
    if not target_user:
        raise HTTPException(404, "No active user found for this tenant to impersonate")
        
    # 3. Generate Short-Lived Token
    expiration = timedelta(minutes=15) # Short lived for security
    access_token = create_access_token(
        data={"sub": target_user.email, "role": target_user.role.value, "impersonated_by": current_user.username},
        expires_delta=expiration
    )
    
    # 4. Construct Redirect URL
    # If in dev (localhost), use localhost port logic or env var.
    # If in prod, use tenant domain or wildcard subdomain.
    
    # We'll rely on the frontend to construct the full URL if needed, 
    # OR return a fully qualified URL here based on settings.
    # For now, let's return the token and let the frontend handle the redirect logic
    # depending on whether it's a subdomain or custom domain.
    
    # Determine base DOMAIN for the tenant
    if tenant.domain:
        # Custom domain
        base_url = f"https://{tenant.domain}"
    else:
        # Subdomain approach
        # Assuming frontend is at app.miinventariofacil.com in prod
        # or localhost:5173 in dev.
        # This is tricky because backend doesn't always know frontend URL.
        # We will return the schema_name/domain info and let frontend decide.
        base_url = None 

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "target_user": target_user.username,
        "tenant_domain": tenant.domain,
        "tenant_schema": tenant.schema_name
    }

@router.get("/dashboard/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """
    Get aggregated statistics for the Admin Dashboard.
    Optimized to use SQL COUNT instead of fetching objects.
    """
    from sqlalchemy import func, extract
    from datetime import datetime, timedelta
    
    print(f"[DASHBOARD] Stats calculation started for user: {current_user.username}")
    
    # 1. Basic Counts
    total_tenants = db.query(func.count(Tenant.id)).scalar()
    active_tenants = db.query(func.count(Tenant.id)).filter(Tenant.is_active == True).scalar()
    total_users = db.query(func.count(User.id)).scalar()
    
    print(f"[DASHBOARD] Basic counts: Tenants={total_tenants}, Active={active_tenants}, Users={total_users}")

    # 2. New Tenants (Last 30 Days)
    thirty_days_ago = get_venezuela_now() - timedelta(days=30)
    new_tenants = db.query(func.count(Tenant.id)).filter(Tenant.created_at >= thirty_days_ago).scalar()
    
    # 3. Growth Data (Last 6 Months)
    six_months_ago = get_venezuela_now() - timedelta(days=180)
    recent_tenants_dates = db.query(Tenant.created_at).filter(Tenant.created_at >= six_months_ago).all()
    
    # Python Aggregation
    growth_map = {}
    spanish_months = {"Jan": "Ene", "Feb": "Feb", "Mar": "Mar", "Apr": "Abr", "May": "May", "Jun": "Jun", 
                      "Jul": "Jul", "Aug": "Ago", "Sep": "Sep", "Oct": "Oct", "Nov": "Nov", "Dec": "Dic"}
    
    # Initialize last 6 months in map
    for i in range(5, -1, -1):
        month_date = get_venezuela_now() - timedelta(days=30 * i)
        month_key = month_date.strftime("%b") # Jan, Feb..
        spanish_key = spanish_months.get(month_key, month_key)
        growth_map[spanish_key] = 0

    # Fill data
    for t_date in recent_tenants_dates:
        if t_date[0]:
            m_key = t_date[0].strftime("%b")
            s_key = spanish_months.get(m_key, m_key)
            if s_key in growth_map:
                growth_map[s_key] += 1
                
    # Convert to List
    growth_data = [{"month": k, "tenants": v} for k, v in growth_map.items()]
    print(f"[DASHBOARD] Growth data calculated: {len(growth_data)} months")

    return {
        "total_tenants": total_tenants,
        "active_tenants": active_tenants,
        "new_tenants_last_30_days": new_tenants,
        "total_users": total_users,
        "growth_data": growth_data
    }

# --- Tenant Activity Dashboard ---

@router.get("/dashboard/activity")
def get_tenant_activity(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """
    Get activity metrics for ALL tenants by querying each schema.
    Returns: last_sale, sales_count, revenue, products, customers, last_login.
    Supports date range filtering for sales/revenue metrics.
    """
    from datetime import datetime, timedelta
    from sqlalchemy import func

    now = get_venezuela_now()

    # Parse date filters (default: current month)
    if date_from:
        try:
            start_date = datetime.fromisoformat(date_from)
        except ValueError:
            start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    if date_to:
        try:
            end_date = datetime.fromisoformat(date_to)
        except ValueError:
            end_date = now
    else:
        end_date = now

    # Get all tenants
    tenants = db.query(Tenant).order_by(Tenant.name).all()
    activity_data = []

    for t in tenants:
        schema = t.schema_name
        try:
            _validate_schema_name(schema)
        except ValueError:
            continue

        metrics = {
            "tenant_id": t.id,
            "name": t.name,
            "schema_name": schema,
            "is_active": t.is_active,
            "is_demo": t.is_demo,
            "license_type": t.license_type,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "sales_count": 0,
            "revenue_usd": 0.0,
            "last_sale": None,
            "products_count": 0,
            "customers_count": 0,
            "last_login": None,
            "user_count": 0,
        }

        # User count — con rollback previo si la sesión está en error
        try:
            db.rollback()  # Asegurar sesión limpia antes de cada tenant
            metrics["user_count"] = db.query(func.count(User.id)).filter(
                User.tenant_id == t.id
            ).scalar() or 0
        except Exception as e:
            db.rollback()
            print(f"[ACTIVITY] Error user_count schema '{schema}': {e}")

        # Check if schema exists before querying
        try:
            schema_exists = db.execute(
                text("SELECT 1 FROM information_schema.schemata WHERE schema_name = :s"),
                {"s": schema}
            ).fetchone()
        except Exception:
            db.rollback()
            activity_data.append(metrics)
            continue

        if not schema_exists:
            activity_data.append(metrics)
            continue

        try:
            # Sales metrics (filtered by date range)
            row = db.execute(text(
                f'SELECT COUNT(*), COALESCE(SUM(total_amount), 0) '
                f'FROM "{schema}".sales '
                f'WHERE date >= :start AND date <= :end'
            ), {"start": start_date, "end": end_date}).fetchone()

            if row:
                metrics["sales_count"] = row[0] or 0
                metrics["revenue_usd"] = round(float(row[1] or 0), 2)

            # Last sale ever (not filtered)
            last_sale = db.execute(text(
                f'SELECT MAX(date) FROM "{schema}".sales'
            )).scalar()
            if last_sale:
                metrics["last_sale"] = last_sale.isoformat()

            # Product count
            metrics["products_count"] = db.execute(text(
                f'SELECT COUNT(*) FROM "{schema}".products WHERE is_active = true'
            )).scalar() or 0

            # Customer count
            metrics["customers_count"] = db.execute(text(
                f'SELECT COUNT(*) FROM "{schema}".customers'
            )).scalar() or 0

            # Last login from audit_logs
            last_login = db.execute(text(
                f"SELECT MAX(timestamp) FROM \"{schema}\".audit_logs WHERE action = 'LOGIN'"
            )).scalar()
            if last_login:
                metrics["last_login"] = last_login.isoformat()

        except Exception as e:
            # Schema may exist but tables may not — rollback para limpiar la transacción
            db.rollback()
            print(f"[ACTIVITY] Error querying schema '{schema}': {e}")
            try:
                db.rollback()
            except Exception:
                pass

        activity_data.append(metrics)

    # Summary stats
    total = len(activity_data)
    seven_days_ago = now - timedelta(days=7)
    thirty_days_ago = now - timedelta(days=30)

    active_count = 0
    inactive_count = 0
    low_count = 0
    abandoned_count = 0

    for item in activity_data:
        ls = item.get("last_sale")
        if ls:
            try:
                last = datetime.fromisoformat(ls)
                if last >= seven_days_ago:
                    active_count += 1
                    item["activity_status"] = "active"
                elif last >= thirty_days_ago:
                    low_count += 1
                    item["activity_status"] = "low"
                else:
                    inactive_count += 1
                    item["activity_status"] = "inactive"
            except (ValueError, TypeError):
                abandoned_count += 1
                item["activity_status"] = "abandoned"
        else:
            abandoned_count += 1
            item["activity_status"] = "abandoned"

    return {
        "summary": {
            "total": total,
            "active": active_count,
            "low_activity": low_count,
            "inactive": inactive_count,
            "abandoned": abandoned_count,
            "date_from": start_date.isoformat(),
            "date_to": end_date.isoformat(),
        },
        "tenants": activity_data
    }


# --- System Messages CRUD ---

from ..models.system_messages import SystemMessage
from ..schemas.system_messages import SystemMessageCreate, SystemMessageUpdate, SystemMessageResponse
from typing import List

@router.get("/messages", response_model=List[SystemMessageResponse])
def get_system_messages(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    messages = db.query(SystemMessage).order_by(SystemMessage.created_at.desc()).offset(skip).limit(limit).all()
    return messages

@router.post("/messages", response_model=SystemMessageResponse)
def create_system_message(
    message: SystemMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
    background_tasks: BackgroundTasks = None
):
    from ..services.websocket_manager import manager
    from ..websocket.events import WebSocketEvents
    from datetime import datetime

    db_message = SystemMessage(**message.model_dump())
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    
    # Broadcast in real-time
    try:
        # Convert to dict for serialization
        msg_data = {
            "id":           db_message.id,
            "title":        db_message.title,
            "content":      db_message.content,
            "level":        db_message.level,
            "message_type": db_message.message_type or "banner",
            "version_tag":  db_message.version_tag,
            "starts_at":    db_message.starts_at.isoformat() if db_message.starts_at else None,
            "expires_at":   db_message.expires_at.isoformat() if db_message.expires_at else None,
            "is_active":    db_message.is_active,
        }
        
        payload = {
            "type": WebSocketEvents.SYSTEM_NOTIFICATION,
            "data": msg_data,
            "timestamp": datetime.now().isoformat()
        }
        
        if background_tasks:
            background_tasks.add_task(manager.broadcast_all, payload)
        else:
            # Fallback for scripts/tests
            import asyncio
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    loop.create_task(manager.broadcast_all(payload))
                else:
                    loop.run_until_complete(manager.broadcast_all(payload))
            except Exception:
                pass
            
    except Exception as e:
        print(f"[WS] Failed to broadcast system message: {e}")

    return db_message

@router.put("/messages/{message_id}", response_model=SystemMessageResponse)
def update_system_message(
    message_id: int,
    message_update: SystemMessageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    db_message = db.query(SystemMessage).filter(SystemMessage.id == message_id).first()
    if not db_message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    update_data = message_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_message, key, value)
    
    db.commit()
    db.refresh(db_message)
    return db_message

@router.delete("/messages/{message_id}")
def delete_system_message(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    # Hard delete or Soft delete? Requirement says "Soft Delete con is_active" but usually DELETE is hard or toggles active.
    # I'll implement hard delete for cleanup, and update can handle soft delete via is_active.
    # Or, if user asked for soft delete specifically on DELETE verb:
    # "Soft Delete con is_active" -> OK, I'll set is_active=False.
    
    db_message = db.query(SystemMessage).filter(SystemMessage.id == message_id).first()
    if not db_message:
        raise HTTPException(status_code=404, detail="Message not found")
        
    # Soft delete logic
    db_message.is_active = False
    db.commit()
    return {"status": "success", "message": "System message deactivated"}
@router.post("/tenants/{tenant_id}/seed")
def seed_tenant_endpoint(
    tenant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """
    Inject demo data into a tenant's schema based on their active modules.
    """
    from ..services.seeder import seed_tenant_data
    
    try:
        result = seed_tenant_data(db, tenant_id)
        return result
    except ValueError as ve:
        raise HTTPException(404, str(ve))

# --- Backup Manager Endpoints ---

from ..services import backup_service
from fastapi.responses import FileResponse

@router.get("/backups", response_model=List[Dict[str, Any]])
def list_backups(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """
    List all available database backups.
    """
    try:
        return backup_service.list_backups()
    except Exception as e:
        raise HTTPException(500, f"Error listing backups: {str(e)}")

@router.post("/backups", status_code=status.HTTP_201_CREATED)
def create_backup(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """
    Trigger a new database backup.
    """
    # For now, we run it synchronously to report immediate success/failure 
    # since pg_dump on a small DB is fast. For larger DBs, this should be a background task.
    try:
        result = backup_service.create_backup()
        return result
    except Exception as e:
        raise HTTPException(500, f"Backup creation failed: {str(e)}")

@router.get("/backups/{filename}")
def download_backup(
    filename: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """
    Download a specific backup file.
    """
    try:
        filepath = backup_service.get_backup_path(filename)
        return FileResponse(
            path=filepath, 
            filename=filename, 
            media_type='application/gzip'
        )
    except FileNotFoundError:
        raise HTTPException(404, "Backup file not found")
    except ValueError:
        raise HTTPException(400, "Invalid filename")
    except Exception as e:
        raise HTTPException(500, f"Error downloading backup: {str(e)}")

@router.delete("/backups/{filename}", status_code=204)
def delete_backup(
    filename: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """
    Delete a backup file.
    """
    try:
        success = backup_service.delete_backup(filename)
        if not success:
            raise HTTPException(404, "Backup file not found")
        return None
    except ValueError:
        raise HTTPException(400, "Invalid filename")
    except Exception as e:
        raise HTTPException(500, f"Error deleting backup: {str(e)}")

