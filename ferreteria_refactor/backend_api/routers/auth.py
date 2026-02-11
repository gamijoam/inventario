from datetime import timedelta
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from ..database.db import get_db
from ..models import models
from ..models.tenant import Tenant
from ..security import verify_password, create_access_token, get_password_hash
from ..config import settings
from .. import schemas

router = APIRouter(prefix="/auth", tags=["authentication"])

# DEBUG ENDPOINT
@router.post("/debug_login")
async def debug_login(request: Request, db: Session = Depends(get_db)):
    # ... existing debug_login content will be preserved due to context selection ...
    """
    Debug endpoint to diagnose login issues.
    Inspects raw body, headers, and performs manual user lookup.
    """
    print("🔍 [DEBUG] /auth/debug_login CALLED")
    
    # 1. Analyze Headers
    content_type = request.headers.get("content-type", "")
    print(f"   Headers Content-Type: {content_type}")
    
    # 2. Analyze Body
    try:
        form_data = await request.form()
        print(f"   Form Data Received: {form_data}")
        
        username_input = form_data.get("username")
        password_input = form_data.get("password")
        
        if not username_input or not password_input:
            # Try JSON if form failed
            try:
                json_body = await request.json()
                print(f"   JSON Body Received: {json_body}")
                username_input = json_body.get("username") or json_body.get("email")
                password_input = json_body.get("password")
            except:
                pass
                
    except Exception as e:
        return {"status": "error", "step": "body_parsing", "detail": str(e)}

    result = {
        "received_username": username_input,
        "password_received": "YES" if password_input else "NO",
        "content_type": content_type
    }

    if not username_input:
        return {**result, "status": "failed", "reason": "No username or email provided"}

    # 3. DB Lookup
    print(f"   Searching DB for: '{username_input}'")
    user = db.query(models.User).filter(
        (models.User.username == username_input) | (models.User.email == username_input)
    ).first()
    
    if not user:
        print("   ❌ User NOT FOUND in DB")
        return {**result, "status": "failed", "reason": "User not found in database"}
    
    print(f"   ✅ User FOUND: ID={user.id}, Role={user.role}, Active={user.is_active}")
    result["user_found"] = True
    result["user_id"] = user.id
    result["is_active"] = user.is_active
    
    # 4. Password Check
    is_valid = verify_password(password_input, user.password_hash)
    print(f"   Password Check: {'✅ VALID' if is_valid else '❌ INVALID'}")
    
    result["password_valid"] = is_valid
    
    if is_valid:
        return {**result, "status": "success", "token_would_be_generated": True}
    else:
        return {**result, "status": "failed", "reason": "Invalid password"}

# EMERGENCY ENDPOINT
@router.get("/fix_password_emergency")
def fix_password_emergency(email: str = "rodriguezisaac876@gmail.com", db: Session = Depends(get_db)):
    """
    Emergency Password Reset.
    Bypasses encoding issues by running inside python env.
    """
    try:
        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            return {"status": "error", "detail": f"User {email} not found"}
        
        new_hash = get_password_hash("admin123")
        user.password_hash = new_hash
        user.is_active = True
        user.is_superuser = True
        db.commit()
        
        print(f"✅ EMERGENCY RESET: Password for {email} -> admin123")
        return {"status": "success", "message": f"Password for {email} reset to 'admin123'", "username": user.username}
    except Exception as e:
        print(f"❌ EMERGENCY RESET FAILED: {e}")
        return {"status": "error", "detail": str(e)}


@router.post("/token")
async def login_for_access_token(
    request: Request,
    response: Response,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Session = Depends(get_db)
):
    """
    Login endpoint with HYBRID authentication support.
    
    Returns JWT token in JSON (legacy support) AND sets HttpOnly cookie (secure).
    Clients can use either method for authentication.
    """
    # 1. Resolve Tenant
    # Priority: X-Tenant-ID -> Subdomain Parsing
    # We must match the logic used by TenantMiddleware to ensure consistency
    
    # Always extract host first, as it is needed for system domain checks later
    host = request.headers.get("host", "").split(":")[0] # Remove port
    print(f"🔐 [AUTH] Login attempt from host: {host}")
    
    current_tenant_id = None
    tenant_slug = None
    
    # PRIORITY 1: Explicit Header (e.g. from axios interceptor)
    if "x-tenant-id" in request.headers:
        candidate = request.headers.get("x-tenant-id")
        # Reuse same regex/validation if possible, or just trust simple alphanumeric
        import re
        if re.match(r'^[a-z0-9_-]+$', candidate):
             tenant_slug = candidate
             print(f"🔐 [AUTH] Tenant resolved via Header: {tenant_slug}")

    # PRIORITY 2: Subdomain Parsing (Fallback)
    if not tenant_slug:
        # Host is already defined above
        
        parts = host.split('.')
        if "localhost" in host:
             if len(parts) == 2 and parts[0] not in ["www", "api", "app", "dashboard", "admin"]:
                 tenant_slug = parts[0]
        else:
            # Production logic (simplified)
             reserved = ["www", "api", "app", "dashboard", "admin", "saas", "backoffice"]
             if len(parts) >= 3 and parts[0] not in reserved and not parts[0].startswith("admin-") and not parts[0].startswith("api-"):
                 tenant_slug = parts[0]
             
    # Custom Domain Check? User mentioned miferreteria3.com
    # If the host is NOT one of our system domains, treat it as a custom domain
    system_domains = ["localhost", "miinventariofacil.com"]
    is_system_domain = any(sys_d in host for sys_d in system_domains)
    
    tenant_query = db.query(Tenant)
    
    if tenant_slug:
        print(f"   Detected Tenant Slug: {tenant_slug}")
        tenant = tenant_query.filter(Tenant.schema_name == tenant_slug).first()
        if tenant: 
            current_tenant_id = tenant.id
            print(f"   ✅ Context: Tenant '{tenant.name}' (ID: {tenant.id})")
    elif not is_system_domain:
         # Try finding by domain
         print(f"   Checking custom domain: {host}")
         tenant = tenant_query.filter(Tenant.domain == host).first()
         if tenant:
             current_tenant_id = tenant.id
             print(f"   ✅ Context: Tenant '{tenant.name}' (ID: {tenant.id}) via Custom Domain")
             
    # 2. User Lookup with Tenant Isolation
    # GLOBAL ADMIN (admin.localhost) -> Can login anywhere or just admin? 
    # Let's say Global Admin can login anywhere for now, but regular users must match.
    
    query = db.query(models.User).filter(
        (models.User.username == form_data.username) | (models.User.email == form_data.username)
    )
    
    user = query.first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    # 3. Enforce Isolation
    if current_tenant_id:
        # We are in a TENANT context
        if user.tenant_id != current_tenant_id:
            # Reject everyone who is NOT part of this tenant
            # This INCLUDES Public Admins (tenant_id=None) to prevent confusion
            print(f"⛔ Auth Block: User {user.username} (Tenant {user.tenant_id}) blocked from Tenant {current_tenant_id}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
    else:
        # We are in PUBLIC context (Admin Panel / Landing)
        if user.tenant_id is not None:
             # Reject Tenant Users trying to login to Public Admin
             print(f"⛔ Auth Block: Tenant User {user.username} tried public login")
             raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
             
        # Allow Public Users (Superadmin)
        print(f"✅ Public User {user.username} logging in to PUBLIC context")
        
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
            email="admin@system.local", # Required field
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
