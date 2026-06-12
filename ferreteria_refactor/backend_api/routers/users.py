
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPBasic
from sqlalchemy.orm import Session
from pydantic import BaseModel
from .. import schemas
from ..database.db import get_db
from ..models import models
from typing import List
from datetime import timedelta
from ..security import verify_password, get_password_hash, create_access_token, pwd_context
from ..config import settings
from ..dependencies import get_current_active_user, limiter
from ..audit_utils import log_action


class PinVerifyRequest(BaseModel):
    pin: str


router = APIRouter(
    prefix="/users",
    tags=["users"]
)

security = HTTPBasic()

# Deleted local hash_password and verify_password in favor of imported ones

@router.post("/", response_model=schemas.UserRead)
@router.post("", response_model=schemas.UserRead, include_in_schema=False)
def create_user(
    user_data: schemas.UserCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Create a new user within the same tenant"""
    # Authorization: Only ADMINs can create users
    if current_user.role != models.UserRole.ADMIN and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los administradores pueden crear usuarios"
        )

    # Check if email exists within the same tenant (only if provided)
    if user_data.email:
        existing = db.query(models.User).filter(
            models.User.email == user_data.email,
            models.User.tenant_id == current_user.tenant_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe un usuario con ese correo en tu empresa")
    
    # Check if username exists within the tenant
    existing_username = db.query(models.User).filter(
        models.User.username == user_data.username,
        models.User.tenant_id == current_user.tenant_id
    ).first()
    if existing_username:
        raise HTTPException(status_code=400, detail="Ya existe un usuario con ese nombre en tu empresa")

    # Resolve tenant_id: Priority to user's fixed tenant, fallback to current context (for Superadmins)
    target_tenant_id = current_user.tenant_id
    if target_tenant_id is None:
        from ..tenant_context import get_tenant_schema
        from ..models.tenant import Tenant
        current_schema = get_tenant_schema()
        if current_schema != "public":
            tenant = db.query(Tenant).filter(Tenant.schema_name == current_schema).first()
            if tenant:
                target_tenant_id = tenant.id

    # Create user
    user = models.User(
        username=user_data.username,
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        role=user_data.role,
        full_name=user_data.full_name,
        commission_percentage=user_data.commission_percentage,
        tenant_id=target_tenant_id
    )
    db.add(user)
    db.flush()
    
    # Capture data safely
    response_data = {
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "full_name": user.full_name,
        "commission_percentage": user.commission_percentage,
        "is_active": user.is_active,
        "pin": user.pin,
        "preferences": user.preferences,
        "created_at": user.created_at
    }
    
    db.commit()
    log_action(db, user_id=current_user.id, action="CREATE", table_name="users", record_id=response_data["id"])
    return response_data

@router.get("/me", response_model=schemas.UserRead)
def get_current_user_profile(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """
    Get current authenticated user's profile.
    
    This endpoint uses the HttpOnly cookie (or Authorization header) to identify the user.
    Perfect for frontend to fetch user data after login without knowing the user ID.
    """
    tenant_id_str = str(current_user.tenant_id) if current_user.tenant_id else None
    
    # Resolving "public" or "schema" name if possible?
    # No, for hardware bridge we might need the schema name OR the ID.
    # The C# app likely needs the SCHEMA NAME if multi-tenant logic uses schemas?
    # Wait, the user said "tenant seria comercialasiatico". That sounds like a SCHEMA name.
    # current_user.tenant_id is an Int (Foreign Key). 
    # We need the SCHEMA NAME probably?
    # Let's check the User model to see what tenant_id refers to.
    
    # Assuming tenant_id in User model is FK to tenants table.
    # I should fetch the Tenant object to get the schema_name if that's what's needed.
    
    tenant_schema = None
    org_role = None
    is_org_owner = False
    try:
        from ..models.organization import Organization, OrganizationUser
        org = db.query(Organization).filter(Organization.owner_email == current_user.email).first()
        member = db.query(OrganizationUser).filter(OrganizationUser.user_email == current_user.email).first()
        org_role = member.role if member else None
        is_org_owner = bool(org or org_role == "owner")
    except Exception:
        org_role = None
        is_org_owner = False

    if current_user.tenant_id:
         # Lazy load or query? 
         # current_user.tenant is likely a relationship.
         if hasattr(current_user, 'tenant') and current_user.tenant:
             tenant_schema = current_user.tenant.schema_name
    
    return {
        "id": current_user.id,
        "username": current_user.username,
        "role": current_user.role,
        "full_name": current_user.full_name,
        "commission_percentage": current_user.commission_percentage,
        "is_active": current_user.is_active,
        "pin": current_user.pin,
        "preferences": current_user.preferences,
        "is_onboarding_completed": current_user.is_onboarding_completed,
        "created_at": current_user.created_at,
        "tenant_id": tenant_schema, # Return the SCHEMA NAME (e.g. comercialasiatico)
        "is_superuser": current_user.is_superuser,
        "org_role": org_role,
        "is_org_owner": is_org_owner
    }

@router.post("/me/onboarding-completed")
def complete_onboarding(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Mark onboarding tour as completed for the current user"""
    current_user.is_onboarding_completed = True
    db.commit()
    return {"status": "success", "is_onboarding_completed": True}

@router.get("/", response_model=List[schemas.UserRead])
@router.get("", response_model=List[schemas.UserRead], include_in_schema=False)
def get_all_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Get all users for the current tenant"""
    # Resolve target tenant_id (creator's or context for superadmins)
    target_tenant_id = current_user.tenant_id
    if target_tenant_id is None:
        from ..tenant_context import get_tenant_schema
        from ..models.tenant import Tenant
        current_schema = get_tenant_schema()
        if current_schema != "public":
            tenant = db.query(Tenant).filter(Tenant.schema_name == current_schema).first()
            if tenant: target_tenant_id = tenant.id

    # Filter by tenant_id to prevent data leakage
    return db.query(models.User).filter(models.User.tenant_id == target_tenant_id).all()

@router.get("/{user_id}", response_model=schemas.UserRead)
def get_user(
    user_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Get user by ID with tenant isolation"""
    # Resolve target tenant_id
    target_tenant_id = current_user.tenant_id
    if target_tenant_id is None:
        from ..tenant_context import get_tenant_schema
        from ..models.tenant import Tenant
        current_schema = get_tenant_schema()
        if current_schema != "public":
            tenant = db.query(Tenant).filter(Tenant.schema_name == current_schema).first()
            if tenant: target_tenant_id = tenant.id

    user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.tenant_id == target_tenant_id
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado en tu empresa")
    return user

@router.put("/{user_id}", response_model=schemas.UserRead)
def update_user(
    user_id: int, 
    user_data: schemas.UserUpdate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Update user with tenant isolation"""
    # Resolve target tenant_id
    target_tenant_id = current_user.tenant_id
    if target_tenant_id is None:
        from ..tenant_context import get_tenant_schema
        from ..models.tenant import Tenant
        current_schema = get_tenant_schema()
        if current_schema != "public":
            tenant = db.query(Tenant).filter(Tenant.schema_name == current_schema).first()
            if tenant: target_tenant_id = tenant.id

    user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.tenant_id == target_tenant_id
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado en tu empresa")
    
    # Authorization: Admins can update anyone in their tenant, others can only update themselves (limited)
    if current_user.role != models.UserRole.ADMIN and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="No tienes permisos para modificar este usuario")

    # Protección del dueño de organización — solo él mismo puede modificar su cuenta
    if current_user.id != user_id:
        try:
            from ..models.organization import Organization as _Org, OrganizationUser as _OrgUser
            _org = db.query(_Org).filter(
                _Org.owner_email == user.email
            ).first()
            if _org:
                raise HTTPException(
                    status_code=403,
                    detail="No puedes modificar la cuenta del dueño de la organización"
                )
        except HTTPException:
            raise
        except Exception:
            pass
    
    if user_data.password:
        user.password_hash = get_password_hash(user_data.password)
    if user_data.email is not None:
        # Validate uniqueness if email changed
        if user_data.email != user.email:
            existing = db.query(models.User).filter(
                models.User.email == user_data.email, 
                models.User.id != user_id
            ).first()
            if existing:
                raise HTTPException(status_code=400, detail="Ya existe un usuario con ese correo")
            user.email = user_data.email
    if user_data.role:
        user.role = user_data.role
    if user_data.full_name is not None:
        user.full_name = user_data.full_name
    if user_data.is_active is not None:
        user.is_active = user_data.is_active
    if user_data.commission_percentage is not None: # NEW
        user.commission_percentage = user_data.commission_percentage
    if user_data.preferences is not None: # NEW
        print(f"[DEBUG] Updating preferences for user {user_id}", flush=True)
        print(f"[DEBUG] Incoming payload: {user_data.preferences}", flush=True)
        
        # Helper to ensure we don't wipe existing keys if sending partial updates
        # For now, simplistic approach: Frontend sends full object or we merge shallowly
        current_prefs = dict(user.preferences) if user.preferences else {}
        print(f"[DEBUG] Current DB prefs: {current_prefs}", flush=True)

        if isinstance(user_data.preferences, dict):
            current_prefs.update(user_data.preferences)
            # FORCE RE-ASSIGNMENT with new ID to ensure SQLA detects change
            user.preferences = current_prefs.copy() 
            print(f"[DEBUG] Final prefs to save: {user.preferences}", flush=True)
            
            # Explicitly flag modified just in case
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(user, "preferences") 

    # Capture data safely before commit
    response_data = {
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "full_name": user.full_name,
        "commission_percentage": user.commission_percentage,
        "is_active": user.is_active,
        "pin": user.pin,
        "preferences": user.preferences,
        "created_at": user.created_at
    }

    db.commit()
    log_action(db, user_id=current_user.id, action="UPDATE", table_name="users", record_id=user_id)
    # db.refresh(user)
    return response_data

@router.delete("/{user_id}")
def delete_user(
    user_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Deactivate user (soft delete) with tenant isolation"""
    # Authorization: Only admins can deactivate users
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo los administradores pueden desactivar usuarios")
        
    # Resolve target tenant_id
    target_tenant_id = current_user.tenant_id
    if target_tenant_id is None:
        from ..tenant_context import get_tenant_schema
        from ..models.tenant import Tenant
        current_schema = get_tenant_schema()
        if current_schema != "public":
            tenant = db.query(Tenant).filter(Tenant.schema_name == current_schema).first()
            if tenant: target_tenant_id = tenant.id

    user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.tenant_id == target_tenant_id
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado en tu empresa")
    
    # Prevent self-deactivation of the last admin
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="No puedes desactivar tu propia cuenta")
    
    user.is_active = False
    db.commit()
    log_action(db, user_id=current_user.id, action="DELETE", table_name="users", record_id=user_id)
    return {"message": "User deactivated successfully"}

@router.post("/login")
@limiter.limit("10/minute")
def login(request: Request, credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    """Authenticate user"""
    user = db.query(models.User).filter(models.User.username == credentials.username).first()
    
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contrasena incorrectos"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="La cuenta de usuario esta inactiva"
        )
    
    return {
        "id": user.id,
        "username": user.username,
        "role": user.role.value if hasattr(user.role, 'value') else user.role,
        "full_name": user.full_name,
        "message": "Login successful"
    }

@router.post("/pin-login")
@limiter.limit("5/minute")
def pin_login(request: Request, payload: dict, db: Session = Depends(get_db)):
    """
    Login rápido con PIN.
    Payload: { "pin": "0000" }
    """
    pin = payload.get("pin")
    if not pin:
        raise HTTPException(status_code=400, detail="El PIN es obligatorio")

    # Buscar usuarios activos y verificar PIN con bcrypt
    active_users = db.query(models.User).filter(
        models.User.is_active == True,
        models.User.pin.isnot(None)
    ).all()
    users = [u for u in active_users if u.pin and pwd_context.verify(pin, u.pin)]

    if not users:
        raise HTTPException(status_code=401, detail="PIN invalido")

    # Prioridad: ADMIN > CASHIER > WAITER > KITCHEN
    # Definimos un score manual si hay colisión
    role_priority = {
        models.UserRole.ADMIN: 10,
        models.UserRole.CASHIER: 8,
        models.UserRole.WAITER: 5,
        models.UserRole.KITCHEN: 2
    }

    # Ordenar usuarios por prioridad
    selected_user = sorted(users, key=lambda u: role_priority.get(u.role, 0), reverse=True)[0]

    # Generar Token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": selected_user.username, "role": selected_user.role.value if hasattr(selected_user.role, 'value') else selected_user.role},
        expires_delta=access_token_expires
    )

    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": {
            "id": selected_user.id,
            "username": selected_user.username,
            "role": selected_user.role.value if hasattr(selected_user.role, 'value') else selected_user.role,
            "full_name": selected_user.full_name
        }
    }

@router.post("/verify-pin/{user_id}")
@limiter.limit("10/minute")
def verify_pin(request: Request, user_id: int, body: PinVerifyRequest, db: Session = Depends(get_db)):
    """Verify user PIN for authorization (e.g., discounts). PIN must be sent in the JSON body."""
    user = db.query(models.User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if user.pin and pwd_context.verify(body.pin, user.pin):
        return {"verified": True, "role": user.role.value if hasattr(user.role, 'value') else user.role}
    else:
        return {"verified": False}

@router.put("/{user_id}/pin")
def update_pin(user_id: int, pin_data: dict, db: Session = Depends(get_db)):
    """Update user PIN for security operations"""
    user = db.query(models.User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Validate PIN (should be 4-6 digits)
    pin = pin_data.get("pin", "")
    if not pin.isdigit() or len(pin) < 4 or len(pin) > 6:
        raise HTTPException(
            status_code=400, 
            detail="El PIN debe tener entre 4 y 6 digitos"
        )
    
    # Update PIN (store as bcrypt hash)
    user.pin = get_password_hash(pin)
    db.commit()

    return {
        "id": user.id,
        "username": user.username,
        "message": "PIN updated successfully"
    }

@router.put("/me/pin")
def update_own_pin(pin_data: dict, db: Session = Depends(get_db), current_user = Depends(get_current_active_user)):
    """
    Actualizar PIN del usuario logueado.
    Payload: { "pin": "0000" }
    """
    pin = pin_data.get("pin", "")
    if not pin.isdigit() or len(pin) < 4 or len(pin) > 6:
        raise HTTPException(status_code=400, detail="El PIN debe tener entre 4 y 6 digitos")
    
    current_user.pin = get_password_hash(pin)
    db.commit()

    return {"status": "success", "message": "PIN updated successfully"}
