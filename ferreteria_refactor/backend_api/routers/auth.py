from datetime import timedelta
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from ..database.db import get_db
from ..models import models
from ..security import verify_password, create_access_token, get_password_hash
from ..config import settings

router = APIRouter(prefix="/auth", tags=["authentication"])

@router.post("/token")
async def login_for_access_token(
    response: Response,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Session = Depends(get_db)
):
    """
    Login endpoint with HYBRID authentication support.
    
    Returns JWT token in JSON (legacy support) AND sets HttpOnly cookie (secure).
    Clients can use either method for authentication.
    """
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
    except Exception as e:
        # If hash is invalid/unknown (e.g. from old system), treat as auth failure
        print(f"❌ AUTH ERROR: verify_password failed: {e}")
        import traceback
        traceback.print_exc()
        
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
    
    # 🔐 SECURITY ENHANCEMENT: Set HttpOnly Cookie
    # This prevents XSS attacks by making the token inaccessible to JavaScript
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,      # CRITICAL: JavaScript cannot read this cookie
        secure=False,       # CRITICAL: False for localhost HTTP (change to True in production with HTTPS)
        samesite="lax",     # CRITICAL: Lax allows cookies between localhost:5173 and localhost:8000
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,  # Expiry in seconds
        path="/",           # Cookie available for all paths
    )
    
    print(f"✅ Login successful for user '{user.username}' - Cookie set (HttpOnly)")
    
    # BACKWARD COMPATIBILITY: Also return token in JSON for legacy clients
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/logout")
async def logout(response: Response):
    """
    Logout endpoint - clears the HttpOnly cookie.
    
    For clients using Authorization headers, they should simply discard the token.
    For clients using cookies, this endpoint clears the cookie server-side.
    """
    response.delete_cookie(
        key="access_token",
        path="/",
        httponly=True,
        samesite="lax"
    )
    
    print("🚪 User logged out - Cookie cleared")
    return {"message": "Successfully logged out"}

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
            is_active=True,
            pin="0000" # Default PIN
        )
        db.add(new_admin)
        db.commit()
        print("[OK] Admin user created with default password 'admin123' and PIN '0000'")
    else:
        # Ensure PIN exists for existing admin
        if not admin.pin:
             print("[INFO] Setting default PIN '0000' for existing admin.")
             admin.pin = "0000"
             db.commit()
        print("[OK] Admin user verified")
