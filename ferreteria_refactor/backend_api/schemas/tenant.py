from pydantic import BaseModel, HttpUrl, field_validator, ConfigDict
from typing import Optional, Dict, Any, List
from datetime import datetime

class TenantBase(BaseModel):
    name: str
    schema_name: str
    domain: Optional[str] = None
    is_active: bool = True
    config: Optional[Dict[str, Any]] = {}
    
    # Subscription Fields
    is_demo: bool = True
    subscription_expires_at: Optional[datetime] = None

class TenantCreate(TenantBase):
    # Extra fields for initial admin creation (not in Tenant model)
    admin_email: str
    admin_password: str
    cc_emails: Optional[List[str]] = []  # Correos adicionales que recibirán el email de bienvenida

    @field_validator('domain')
    @classmethod
    def empty_string_to_none(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.strip() == "":
            return None
        return v

class TenantUpdate(BaseModel):
    name: Optional[str] = None
    domain: Optional[str] = None
    is_active: Optional[bool] = None
    config: Optional[Dict[str, Any]] = None
    # Update Subscription
    is_demo: Optional[bool] = None
    subscription_expires_at: Optional[datetime] = None

    # License fields
    license_type: Optional[str] = None
    trial_days: Optional[int] = None
    trial_ends_at: Optional[datetime] = None
    license_blocked_reason: Optional[str] = None

    # Module Flags
    has_restaurant_module: Optional[bool] = None
    has_laundry_module: Optional[bool] = None
    has_hardware_module: Optional[bool] = None
    has_services_module: Optional[bool] = None
    has_barbershop_module: Optional[bool] = None
    has_pharmacy_module: Optional[bool] = None

    @field_validator('domain')
    @classmethod
    def empty_string_to_none(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.strip() == "":
            return None
        return v

class TenantOut(TenantBase):
    id: int
    created_at: Optional[datetime] = None

    # License fields
    license_type: str = "trial"
    trial_days: int = 2
    trial_ends_at: Optional[datetime] = None
    license_blocked_reason: Optional[str] = None

    # Module Flags
    has_restaurant_module: bool = False
    has_laundry_module: bool = False
    has_hardware_module: bool = False
    has_services_module: bool = False
    has_barbershop_module: bool = False
    has_pharmacy_module: bool = False

    # Optional computed fields
    user_count: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)
