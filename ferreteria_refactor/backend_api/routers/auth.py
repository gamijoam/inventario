from datetime import timedelta
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from ..database.db import get_db
from ..models import models
from ..security import verify_password, create_access_token, get_password_hash
from ..config import settings

router = APIRouter(prefix="/auth", tags=["authentication"])

@router.post("/token")
async def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user:
        # Generic error for security
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    try:
        if not verify_password(form_data.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except Exception:
        # If hash is invalid/unknown (e.g. from old system), treat as auth failure
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password (Security Update Required)",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role.value}, # Role in claims
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/validate-pin")
def validate_pin(pin_data: dict, db: Session = Depends(get_db)):
    """Validate user PIN for sensitive operations (void sales, discounts, etc.)"""
    user_id = pin_data.get("user_id")
    pin = pin_data.get("pin", "")
    
    if not user_id:
        raise HTTPException(
            status_code=400,
            detail="user_id is required"
        )
    
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User is inactive")
    
    # Check if user has a PIN set
    if not user.pin:
        raise HTTPException(
            status_code=400,
            detail="User does not have a PIN set. Please contact administrator."
        )
    
    # Validate PIN
    if user.pin == pin:
        return {
            "valid": True,
            "user_id": user.id,
            "username": user.username,
            "role": user.role.value if hasattr(user.role, 'value') else user.role,
            "message": "PIN validated successfully"
        }
    else:
        return {
            "valid": False,
            "message": "Invalid PIN"
        }

def init_admin_user(db: Session):
    """Check if any user exists, if not create admin."""
    admin = db.query(models.User).filter(models.User.username == "admin").first()
    
    if not admin:
        print("Creating default admin user...")
        p_hash = get_password_hash("admin123")
        new_admin = models.User(
            username="admin",
            password_hash=p_hash,
            role=models.UserRole.ADMIN,
            full_name="Administrador Sistema",
            is_active=True
        )
        db.add(new_admin)
        db.commit()
        print("[OK] Admin user created with default password 'admin123'")
    else:
        print("[OK] Admin user already exists, skipping initialization")
