from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy import text
from sqlalchemy.orm import Session
from typing import List, Annotated, Optional

from .database.db import get_db, _validate_schema_name
from .config import settings, Settings
from .models.models import User, UserRole

# OAuth2 scheme for Swagger UI and legacy header-based auth
# FIXED: tokenUrl must include the full path with prefix
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token", auto_error=False)

def extract_token_hybrid(
    request: Request,
    token_from_header: Optional[str] = Depends(oauth2_scheme)
) -> str:
    """
    HYBRID Token Extraction Strategy (Security Enhancement).
    
    Priority Order:
    1. HttpOnly Cookie (SECURE - XSS protected)
    2. Authorization Header (LEGACY - for backward compatibility)
    
    This allows gradual migration from localStorage to cookies.
    """
    # PRIORITY 1: Try to get token from HttpOnly cookie (SECURE)
    token_from_cookie = request.cookies.get("access_token")
    
    if token_from_cookie:
        print("🔐 Token source: HttpOnly Cookie (SECURE)")
        return token_from_cookie
    
    # PRIORITY 2: Fallback to Authorization header (LEGACY)
    if token_from_header:
        print("⚠️  Token source: Authorization Header (LEGACY - consider migrating to cookies)")
        return token_from_header
    
    # No token found in either location
    print("⛔ No authentication token found (checked cookie + header)")
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )

def get_current_user(
    token: Annotated[str, Depends(extract_token_hybrid)], 
    db: Session = Depends(get_db)
):
    """
    Validate JWT token and return current user.
    
    Now supports HYBRID authentication (cookie + header).
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        
        if email is None:
            print("⛔ Auth Failed: Token payload missing 'sub'")
            raise credentials_exception
    except JWTError as e:
        print(f"⛔ JWT Validation Error: {e}")
        raise credentials_exception
        
    # FETCH USER (Globally Unique by Email)
    user = db.query(User).filter(User.email == email).first()
        
    if user is None:
        print(f"⛔ Auth Failed: User with email '{email}' not found in DB.")
        raise credentials_exception

    # TENANT VALIDATION: Ensure user belongs to the current context
    from .tenant_context import get_tenant_schema
    from .models.tenant import Tenant
    
    current_schema = get_tenant_schema()
    
    if current_schema != "public":
        # We are in a tenant schema, fetch tenant record to get ID
        tenant = db.query(Tenant).filter(Tenant.schema_name == current_schema).first()
        if tenant:
            if user.tenant_id != tenant.id and not user.is_superuser:
                print(f"⛔ Tenant Mismatch: User {email} does not belong to tenant '{current_schema}'")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not have access to this company"
                )
    else:
        # We are in public context, usually only for Superadmins
        if user.tenant_id is not None and not user.is_superuser:
            # Auto-resolve: the user belongs to a tenant but X-Tenant-ID was not sent
            # (e.g. dev mode on localhost without localStorage, or mobile without stored tenant)
            # Instead of blocking, switch the DB session to their correct schema.
            from .models.tenant import Tenant
            tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
            if tenant:
                print(f"🔄 Auto-resolving tenant context for '{email}': switching to '{tenant.schema_name}'")
                from .tenant_context import set_tenant_schema
                set_tenant_schema(tenant.schema_name)
                _validate_schema_name(tenant.schema_name)
                db.execute(text(f'SET search_path TO "{tenant.schema_name}", public'))
            else:
                print(f"⛔ Context Mismatch: Tenant user {email} has no valid tenant record")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Please login via your company URL"
                )

    print(f"✅ Auth Success: User '{email}' authenticated for context '{current_schema}'.")
    return user

def get_current_active_user(current_user: Annotated[User, Depends(get_current_user)]):
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

class RoleChecker:
    def __init__(self, allowed_roles: List[UserRole]):
        self.allowed_roles = allowed_roles

    def __call__(self, user: Annotated[User, Depends(get_current_active_user)]):
        print(f"🕵️ RoleChecker: User '{user.username}' (Role: {user.role}) vs Allowed: {self.allowed_roles}")
        if user.role not in self.allowed_roles:
            print(f"⛔ RoleChecker: Access DENIED. User role {user.role} not in {self.allowed_roles}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="Operation not permitted"
            )
        return user

def has_role(allowed_roles: List[UserRole]):
    return RoleChecker(allowed_roles)

# ========================================
# RBAC Convenience Aliases
# ========================================
# Use these as dependencies in your routes for quick role checking

# Admin only - full access
admin_only = has_role([UserRole.ADMIN])
require_admin_role = admin_only # Alias for compatibility

# Cashier or Admin - POS operations, sales, returns
cashier_or_admin = has_role([UserRole.ADMIN, UserRole.CASHIER])

# Warehouse or Admin - inventory management, stock adjustments
warehouse_or_admin = has_role([UserRole.ADMIN, UserRole.WAREHOUSE])

# All authenticated users (any role)
any_authenticated = Depends(get_current_active_user)

def require_restaurant_module(db: Session = Depends(get_db)):
    from .tenant_context import get_tenant_schema
    from .models.tenant import Tenant
    
    current_schema = get_tenant_schema()
    if current_schema == "public":
        return # Allow in public/development
        
    tenant = db.query(Tenant).filter(Tenant.schema_name == current_schema).first()
    if not tenant or not tenant.has_restaurant_module:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Restaurant module is disabled for this tenant"
        )

def require_laundry_module(db: Session = Depends(get_db)):
    from .tenant_context import get_tenant_schema
    from .models.tenant import Tenant
    
    current_schema = get_tenant_schema()
    if current_schema == "public":
        return
        
    tenant = db.query(Tenant).filter(Tenant.schema_name == current_schema).first()
    if not tenant or not tenant.has_laundry_module:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Laundry module is disabled for this tenant"
        )

def require_services_module(db: Session = Depends(get_db)):
    from .tenant_context import get_tenant_schema
    from .models.tenant import Tenant
    
    current_schema = get_tenant_schema()
    if current_schema == "public":
        return
        
    tenant = db.query(Tenant).filter(Tenant.schema_name == current_schema).first()
    if not tenant or not tenant.has_services_module:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Services module is disabled for this tenant"
        )

# ========================================
# SUPERUSER DEPENDENCY (Admin Panel)
# ========================================

def get_current_superuser(
    current_user: Annotated[User, Depends(get_current_active_user)]
) -> User:
    """
    Verify that the current user has superuser privileges.
    
    Use this dependency for admin panel endpoints that should only be
    accessible to superusers (e.g., tenant management, system configuration).
    
    Raises:
        HTTPException: 403 if user is not a superuser
    
    Returns:
        User: The authenticated superuser
    """
    if not current_user.is_superuser:
        print(f"⛔ Superuser Access DENIED: User '{current_user.username}' is not a superuser")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superuser privileges required"
        )
    
    print(f"✅ Superuser Access GRANTED: User '{current_user.username}'")
    return current_user
