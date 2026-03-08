from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, EmailStr, validator
from typing import Optional
from enum import Enum
import re
import logging
import traceback
from ..services.tenant_service import TenantService

logger = logging.getLogger(__name__)

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
    business_type: Optional[str] = None  # Flexible string from the new list
    
    # Backward compatibility: handle plan_type if sent
    plan_type: Optional[str] = None
    
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
        
        # Logical Mapping: Priority for business_type, then plan_type, then default to FERRETERIA
        if request.business_type:
            final_plan = request.business_type  # already a plain str
        elif request.plan_type:
            final_plan = request.plan_type      # already a plain str
        else:
            final_plan = "FERRETERIA"
        
        result = TenantService.create_tenant(
            name=request.company_name,
            schema_name=schema_name,
            admin_email=request.email,
            admin_password=request.password,
            plan_type=final_plan
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
        logger.error(f"❌ Validation Error during registration: {ve}")
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"❌ FATAL ERROR IN REGISTRO: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error interno al crear la empresa: {str(e)}")
