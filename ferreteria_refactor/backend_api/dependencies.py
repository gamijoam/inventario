from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from typing import List, Annotated

from .database.db import get_db
from .database.db import get_db
from .config import settings, Settings
from .models.models import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def get_current_user(token: Annotated[str, Depends(oauth2_scheme)], db: Session = Depends(get_db)):
    print(f"🕵️ SERVER PROBE: Checking Token: {token[:15]}...")
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            print("⛔ Auth Failed: Token payload missing 'sub'")
            raise credentials_exception
    except JWTError as e:
        print(f"⛔ JWT Validation Error: {e}")
        print(f"   - Expected Key: {settings.SECRET_KEY[:5]}...")
        print(f"   - Algorithm: {settings.ALGORITHM}")
        raise credentials_exception
        
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        print(f"⛔ Auth Failed: User '{username}' not found in DB.")
        raise credentials_exception
    
    print(f"✅ Auth Success: User '{username}' authenticated.")
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

# Cashier or Admin - POS operations, sales, returns
cashier_or_admin = has_role([UserRole.ADMIN, UserRole.CASHIER])

# Warehouse or Admin - inventory management, stock adjustments
warehouse_or_admin = has_role([UserRole.ADMIN, UserRole.WAREHOUSE])

# All authenticated users (any role)
any_authenticated = Depends(get_current_active_user)

def require_restaurant_module(settings: Settings = Depends(lambda: settings)):
    if not settings.MODULE_RESTAURANT_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Restaurant module is disabled"
        )
