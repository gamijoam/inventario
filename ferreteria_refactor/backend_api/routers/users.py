
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBasic
from sqlalchemy.orm import Session
from .. import schemas
from ..database.db import get_db
from ..models import models
from typing import List
from datetime import timedelta
from ..security import verify_password, get_password_hash, create_access_token
from ..config import settings
from ..dependencies import get_current_active_user


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
            detail="Only administrators can create new users"
        )

    # Check if email exists globally (only if provided)
    if user_data.email:
        existing = db.query(models.User).filter(models.User.email == user_data.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="User with this email already exists")
    
    # Check if username exists within the tenant
    existing_username = db.query(models.User).filter(
        models.User.username == user_data.username,
        models.User.tenant_id == current_user.tenant_id
    ).first()
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already exists in your company")

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
        "created_at": current_user.created_at
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
        raise HTTPException(status_code=404, detail="User not found in your company")
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
        raise HTTPException(status_code=404, detail="User not found in your company")
    
    # Authorization: Admins can update anyone in their tenant, others can only update themselves (limited)
    if current_user.role != models.UserRole.ADMIN and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    if user_data.password:
        user.password_hash = get_password_hash(user_data.password)
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
        raise HTTPException(status_code=403, detail="Only administrators can deactivate users")
        
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
        raise HTTPException(status_code=404, detail="User not found in your company")
    
    # Prevent self-deactivation of the last admin
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
    
    user.is_active = False
    db.commit()
    return {"message": "User deactivated successfully"}

@router.post("/login")
def login(credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    """Authenticate user"""
    user = db.query(models.User).filter(models.User.username == credentials.username).first()
    
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    
    return {
        "id": user.id,
        "username": user.username,
        "role": user.role.value if hasattr(user.role, 'value') else user.role,
        "full_name": user.full_name,
        "message": "Login successful"
    }

@router.post("/pin-login")
def pin_login(payload: dict, db: Session = Depends(get_db)):
    """
    Login rápido con PIN.
    Payload: { "pin": "0000" }
    """
    pin = payload.get("pin")
    if not pin:
        raise HTTPException(status_code=400, detail="PIN is required")

    # Buscar usuarios con ese PIN (y activos)
    users = db.query(models.User).filter(
        models.User.pin == pin,
        models.User.is_active == True
    ).all()

    if not users:
        raise HTTPException(status_code=401, detail="Invalid PIN")

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
def verify_pin(user_id: int, pin: str, db: Session = Depends(get_db)):
    """Verify user PIN for authorization (e.g., discounts)"""
    user = db.query(models.User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.pin == pin:
        return {"verified": True, "role": user.role.value if hasattr(user.role, 'value') else user.role}
    else:
        return {"verified": False}

@router.put("/{user_id}/pin")
def update_pin(user_id: int, pin_data: dict, db: Session = Depends(get_db)):
    """Update user PIN for security operations"""
    user = db.query(models.User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Validate PIN (should be 4-6 digits)
    pin = pin_data.get("pin", "")
    if not pin.isdigit() or len(pin) < 4 or len(pin) > 6:
        raise HTTPException(
            status_code=400, 
            detail="PIN must be 4-6 digits"
        )
    
    # Update PIN
    user.pin = pin
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
        raise HTTPException(status_code=400, detail="PIN must be 4-6 digits")
    
    current_user.pin = pin
    db.commit()
    
    return {"status": "success", "message": "PIN updated successfully"}
