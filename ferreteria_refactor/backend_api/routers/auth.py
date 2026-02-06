from datetime import timedelta
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from ..database.db import get_db
from ..models import models
from ..security import verify_password, create_access_token, get_password_hash
from ..config import settings
from .. import schemas

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
        secure=settings.SECURE_COOKIES, # True in production with HTTPS
        samesite="lax",     # Lax is usually sufficient for same-site subdomains
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,  # Expiry in seconds
        path="/",           # Cookie available for all paths
        domain=settings.COOKIE_DOMAIN, # Important for multi-tenant subdomains
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
        samesite="lax",
        secure=settings.SECURE_COOKIES,
        domain=settings.COOKIE_DOMAIN
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

@router.post("/forgot-password")
async def forgot_password(
    request: schemas.ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    """
    Step 1 of the recovery flow.
    Receives email, generates a 1-hour recovery token and sends reset link.
    """
    user = db.query(models.User).filter(models.User.email == request.email).first()
    if not user:
        # Return success even if user not found to prevent email enumeration
        print(f"🕵️ Recovery requested for non-existent email: {request.email}")
        return {"message": "Si el correo está registrado, recibirás un enlace de recuperación."}

    # Generate token with specific payload to differentiate from access tokens
    # Expire in 1 hour
    recovery_token = create_access_token(
        data={"sub": user.username, "type": "password_reset"},
        expires_delta=timedelta(hours=1)
    )

    from ..utils.email_utils import send_reset_password_email
    try:
        send_reset_password_email(user.email, recovery_token)
    except Exception as e:
         raise HTTPException(
            status_code=500,
            detail=f"Error al enviar el correo: {str(e)}"
        )

    return {"message": "Si el correo está registrado, recibirás un enlace de recuperación."}

@router.post("/reset-password")
async def reset_password(
    request: schemas.ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    """
    Step 2 of the recovery flow.
    Validates recovery token and updates user password.
    """
    from jose import jwt, JWTError
    
    try:
        payload = jwt.decode(request.token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if username is None or token_type != "password_reset":
             raise HTTPException(status_code=400, detail="Token de recuperación inválido o expirado")
             
    except JWTError:
        raise HTTPException(status_code=400, detail="Token de recuperación inválido o expirado")

    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Update password
    user.password_hash = get_password_hash(request.new_password)
    db.commit()
    
    print(f"🔐 Password successfully reset for user: {username}")
    return {"message": "Tu contraseña ha sido actualizada exitosamente."}


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
