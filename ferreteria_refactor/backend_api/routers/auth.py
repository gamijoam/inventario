from datetime import timedelta
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from ..database.db import get_db
from ..models import models
from ..models.tenant import Tenant
from ..security import verify_password, create_access_token, get_password_hash, pwd_context
from ..config import settings
from .. import schemas
from ..dependencies import limiter

router = APIRouter(prefix="/auth", tags=["authentication"])

@router.post("/discovery", response_model=schemas.DiscoveryResponse)
@limiter.limit("20/minute")
async def discover_tenant(
    request: Request,
    payload: schemas.DiscoveryRequest,
    db: Session = Depends(get_db)
):
    """
    Discovery endpoint to find a tenant by user email.
    """
    email = payload.email.strip().lower()
    
    # 1. Look for user by email
    user = db.query(models.User).filter(models.User.email == email).first()
    
    # 🔐 SECURITY CHECK: Never discover global superadmins (tenant_id=None) via email.
    # Tenant admins with is_superuser=True but a tenant_id assigned are allowed.
    if not user or not user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No encontramos ninguna cuenta asociada a este correo electrónico."
        )
    
    # 2. Get associated tenant
    tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
    if not tenant:
         raise HTTPException(404, "Empresa no encontrada para este usuario.")
    
    # 3. Build Redirect URL
    # Format: https://{slug}.{app_domain}/#/login
    redirect_url = f"{settings.PROTOCOL}://{tenant.schema_name}.{settings.APP_DOMAIN}/#/login"
    
    return {
        "redirect_url": redirect_url,
        "tenant_id": tenant.schema_name,
        "tenant_name": tenant.name
    }

# 🆕 IMPERSONATION TOKEN EXCHANGE
@router.post("/exchange-token")
@limiter.limit("10/minute")
async def exchange_token(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    """
    Exchanges a valid Access Token (via body or query) for a HttpOnly Session Cookie.
    Used for Impersonation flow.
    """
    try:
        body = await request.json()
        token = body.get("access_token")
    except:
        token = request.query_params.get("token")
        
    if not token:
        raise HTTPException(400, "Token required")
        
    # Validate Token
    from jose import jwt, JWTError
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
             raise HTTPException(401, "Invalid token")
    except JWTError:
        raise HTTPException(401, "Invalid token")
        
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
         raise HTTPException(401, "User not found")
         
    # Set Cookie
    # Reuse access_token or create new? Reuse is fine if expiry is enough.
    # But creating new is cleaner to reset expiry if needed.
    # Let's simple reuse the provided token or re-issue with standard time.
    # Re-issuing checks active status implicitly.
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    new_access_token = create_access_token(
        data={"sub": user.email, "role": user.role.value, "impersonated": True},
        expires_delta=access_token_expires
    )
    
    response.set_cookie(
        key="access_token",
        value=new_access_token,
        httponly=True,
        secure=settings.SECURE_COOKIES,
        samesite="lax", # Lax is better for redirect flows than Strict
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
        domain=None if settings.ENVIRONMENT == "development" else settings.COOKIE_DOMAIN,
    )
    
    return {"status": "success", "user": user.username}


@router.post("/token")
@limiter.limit("10/minute")
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
    # Matching logic in TenantMiddleware
    host = request.headers.get("x-forwarded-host", request.headers.get("host", "")).split(":")[0]
    tenant_slug = None
    
    # PRIORITY 1: Explicit Header
    if "x-tenant-id" in request.headers:
        tenant_slug = request.headers.get("x-tenant-id")
    
    # PRIORITY 2: Subdomain Parsing
    if not tenant_slug:
        # Prevent IP addresses (e.g. 127.0.0.1) from being parsed as subdomains
        if host.replace('.', '').isnumeric():
            tenant_slug = None
        else:
            parts = host.split('.')
            if "localhost" in host:
                if len(parts) == 2 and parts[0] not in ["www", "api", "app", "dashboard", "admin"]:
                    tenant_slug = parts[0]
            else:
                reserved = ["www", "api", "app", "dashboard", "admin", "saas", "backoffice"]
                if len(parts) >= 3 and parts[0] not in reserved:
                    tenant_slug = parts[0]

    current_tenant_id = None
    if tenant_slug and tenant_slug != "public":
        tenant = db.query(Tenant).filter(Tenant.schema_name == tenant_slug).first()
        if tenant:
            # ❌ BLOQUEO: Empresa suspendida/desactivada
            if not tenant.is_active:
                print(f"🔒 [AUTH] Blocked: Tenant '{tenant.schema_name}' is INACTIVE")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Esta empresa está suspendida. Contacta a soporte para renovar tu suscripción."
                )
            current_tenant_id = tenant.id
            print(f"🔐 [AUTH] Context: Tenant '{tenant.name}' (ID: {tenant.id})")
        else:
            print(f"⚠️ [AUTH] Tenant slug '{tenant_slug}' not found, falling back to public")

    # 2. User Lookup (Tenant-Aware)
    # We first try to find the user in the specific tenant context
    # This prevents picking the Global Admin when a Tenant Admin uses the same username "admin"
    user_query = db.query(models.User).filter(
        (models.User.username == form_data.username) | (models.User.email == form_data.username)
    )
    
    if current_tenant_id:
        # Try finding the user belonging to THIS tenant first
        user = user_query.filter(models.User.tenant_id == current_tenant_id).first()
        
        # If not found, fallback to Global Superuser (who can access any tenant)
        if not user:
            user = user_query.filter(models.User.tenant_id.is_(None)).filter(models.User.is_superuser.is_(True)).first()
    else:
        # We are in public/system context, only find global users
        user = user_query.filter(models.User.tenant_id.is_(None)).first()
    
    if not user:
        print(f"⛔ Auth Block: User '{form_data.username}' not found in context '{tenant_slug}'")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    # 3. Enforce Isolation
    if current_tenant_id:
        # TENANT CONTEXT: Only users belonging to this tenant OR superusers can login
        if user.tenant_id != current_tenant_id and not user.is_superuser:
            print(f"⛔ Auth Block: User {user.username} (Tenant {user.tenant_id}) blocked from Tenant {current_tenant_id}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
    else:
        # PUBLIC/ADMIN CONTEXT: Only users with NO tenant_id (Superadmins) can login
        if user.tenant_id is not None:
             print(f"⛔ Auth Block: Tenant User {user.username} tried public login")
             raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Superuser verification for public context
        if not user.is_superuser and user.role != models.UserRole.ADMIN:
             print(f"⛔ Auth Block: User {user.username} (Role: {user.role}) tried public login without Superuser/Admin rights")
             raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
    try:
        if not verify_password(form_data.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales incorrectas",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except HTTPException:
        raise  # Re-lanzar HTTPException tal cual (contraseña incorrecta)
    except Exception as e:
        # Solo llega aquí si el hash está corrupto o en formato desconocido
        print(f"❌ AUTH ERROR: verify_password failed: {e}")
        import traceback
        traceback.print_exc()

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Error de autenticación. Contacta al administrador.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # Use EMAIL as the unique identifier (sub) since it's globally unique
    # This prevents ambiguity between users with same username in different tenants
    token_data = {
        "sub": user.email, 
        "role": user.role.value
    }
    
    access_token = create_access_token(
        data=token_data,
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

    # Resolve tenant slug so the frontend can store selected_tenant in localStorage
    tenant_slug = None
    if user.tenant_id and not user.is_superuser:
        tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
        if tenant:
            tenant_slug = tenant.schema_name

    # BACKWARD COMPATIBILITY: Also return token in JSON for legacy clients
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "tenant_slug": tenant_slug  # Frontend should store this as selected_tenant in localStorage
    }

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
@limiter.limit("10/minute")
async def validate_pin(request: Request, pin_data: dict, db: Session = Depends(get_db)):
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
    if pwd_context.verify(pin, user.pin):
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
@limiter.limit("5/hour")
async def forgot_password(
    request: Request,
    payload: schemas.ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    """
    Step 1 of the recovery flow.
    Receives email, generates a 1-hour recovery token and sends reset link.
    """
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user:
        # Return success even if user not found to prevent email enumeration
        print(f"🕵️ Recovery requested for non-existent email: {payload.email}")
        return {"message": "Si el correo está registrado, recibirás un enlace de recuperación."}

    # Obtener el subdominio del tenant desde el request para construir el link correcto
    tenant_schema = getattr(request.state, "tenant_schema", None)

    # Incluir tenant_schema en el token para que reset-password sepa a qué tenant pertenece
    recovery_token = create_access_token(
        data={"sub": user.email, "type": "password_reset", "tenant": tenant_schema},
        expires_delta=timedelta(hours=1)
    )

    # Construir el link con el dominio exacto del tenant
    if tenant_schema:
        reset_link_base = f"{settings.PROTOCOL}://{tenant_schema}.{settings.APP_DOMAIN}"
    else:
        reset_link_base = settings.FRONTEND_URL

    from ..utils.email_utils import send_reset_password_email
    try:
        send_reset_password_email(user.email, recovery_token, reset_link_base)
    except Exception as e:
         raise HTTPException(
            status_code=500,
            detail=f"Error al enviar el correo: {str(e)}"
        )

    return {"message": "Si el correo está registrado, recibirás un enlace de recuperación."}

@router.post("/reset-password")
@limiter.limit("5/minute")
async def reset_password(
    request: Request,
    body: schemas.ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    """
    Step 2 of the recovery flow.
    Validates recovery token and updates user password.
    """
    from jose import jwt, JWTError

    try:
        token_payload = jwt.decode(body.token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = token_payload.get("sub")
        token_type: str = token_payload.get("type")

        if email is None or token_type != "password_reset":
             raise HTTPException(status_code=400, detail="Token de recuperación inválido o expirado")

    except JWTError:
        raise HTTPException(status_code=400, detail="Token de recuperación inválido o expirado")

    tenant_schema = token_payload.get("tenant")

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Update password
    user.password_hash = get_password_hash(body.new_password)
    db.commit()

    # Construir URL de login del tenant para que el frontend redirija correctamente
    if tenant_schema:
        login_url = f"{settings.PROTOCOL}://{tenant_schema}.{settings.APP_DOMAIN}/#/login"
    else:
        login_url = f"{settings.FRONTEND_URL}/#/login"

    print(f"🔐 Password successfully reset for user: {email} (tenant: {tenant_schema})")
    return {"message": "Tu contraseña ha sido actualizada exitosamente.", "login_url": login_url}


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
            is_superuser=True, # 🔑 ALWAYS SUPERUSER
            pin=get_password_hash("0000") # Default PIN (hashed)
        )
        db.add(new_admin)
        db.commit()
        print("[OK] Admin user created with default password 'admin123' and PIN '0000'")
    else:
        # Ensure PIN exists for existing admin
        if not admin.pin:
             print("[INFO] Setting default PIN '0000' for existing admin.")
             admin.pin = get_password_hash("0000")
             db.commit()
        print("[OK] Admin user verified")
