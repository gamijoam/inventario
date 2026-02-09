from pydantic import BaseModel, HttpUrl
from typing import Optional, Dict, Any
from datetime import datetime

class TenantBase(BaseModel):
    name: str
    schema_name: str
    domain: Optional[str] = None
    is_active: bool = True
    config: Optional[Dict[str, Any]] = {}

class TenantCreate(TenantBase):
    # Extra fields for initial admin creation (not in Tenant model)
    admin_email: str
    admin_password: str

class TenantUpdate(BaseModel):
    name: Optional[str] = None
    domain: Optional[str] = None
    is_active: Optional[bool] = None
    config: Optional[Dict[str, Any]] = None

class TenantOut(TenantBase):
    id: int
    created_at: datetime
    
    # Module Flags
    has_restaurant_module: bool = False
    has_laundry_module: bool = False
    has_hardware_module: bool = False
    has_services_module: bool = False

    # Optional computed fields
    user_count: Optional[int] = None
    
    class Config:
        from_attributes = True
