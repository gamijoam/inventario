
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
def create_user(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    """Create a new user"""
    # Check if username already exists
    existing = db.query(models.User).filter(models.User.username == user_data.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Create user
    user = models.User(
        username=user_data.username,
        password_hash=get_password_hash(user_data.password),
        role=user_data.role,
        full_name=user_data.full_name
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.get("/", response_model=List[schemas.UserRead])
@router.get("", response_model=List[schemas.UserRead], include_in_schema=False)
def get_all_users(db: Session = Depends(get_db)):
    """Get all users"""
    return db.query(models.User).all()

@router.get("/{user_id}", response_model=schemas.UserRead)
def get_user(user_id: int, db: Session = Depends(get_db)):
    """Get user by ID"""
    user = db.query(models.User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.put("/{user_id}", response_model=schemas.UserRead)
def update_user(user_id: int, user_data: schemas.UserUpdate, db: Session = Depends(get_db)):
    """Update user"""
    user = db.query(models.User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user_data.password:
        user.password_hash = get_password_hash(user_data.password)
    if user_data.role:
        user.role = user_data.role
    if user_data.full_name is not None:
        user.full_name = user_data.full_name
    if user_data.is_active is not None:
        user.is_active = user_data.is_active
    
    db.commit()
    db.refresh(user)
    return user

@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    """Deactivate user (soft delete)"""
    user = db.query(models.User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    db.refresh(user)
    
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
