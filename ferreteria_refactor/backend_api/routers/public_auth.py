from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, EmailStr, validator
from typing import Optional
from enum import Enum
import re
from ..services.tenant_service import TenantService

router = APIRouter(
    prefix="/public",
    tags=["public-auth"]
)

class PlanType(str, Enum):
    FERRETERIA = "FERRETERIA"
    RESTAURANT = "RESTAURANT"
    LAUNDRY = "LAUNDRY"
    SERVICES = "SERVICES"

class RegisterRequest(BaseModel):
    company_name: str
    email: EmailStr
    password: str
    plan_type: PlanType = PlanType.FERRETERIA
    
    @validator('company_name')
    def name_must_be_valid(cls, v):
        if len(v) < 3:
            raise ValueError('Company name must be at least 3 characters')
        return v
    
    @validator('password')
    def password_complexity(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters')
        return v

@router.post("/register")
async def register_tenant(request: RegisterRequest):
    """
    Public endpoint to register a new tenant.
    Creates schema, user, and configures modules based on plan.
    """
    try:
        # 1. Generate Schema Name
        schema_name = TenantService.slugify_schema_name(request.company_name)
        
        # 2. Call Service (Synchronous for now to ensure capability, 
        # ideally this should be a background task if migration takes long)
        # But user needs to know if it failed.
        
        result = TenantService.create_tenant(
            name=request.company_name,
            schema_name=schema_name,
            admin_email=request.email,
            admin_password=request.password,
            plan_type=request.plan_type.value
        )
        
        return {
            "status": "success",
            "message": "Empresa creada exitosamente",
            "tenant_id": result["tenant_id"],
            "redirect_url": "/login", # Frontend handles this
            "temp_credentials": { # Optional: Show user or email them
                 "username": "admin",
                 "note": "Use 'admin' as username for now."
            }
        }
        
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        print(f"Register Error: {e}")
        raise HTTPException(status_code=500, detail="Error interno al crear la empresa. Contacte soporte.")
