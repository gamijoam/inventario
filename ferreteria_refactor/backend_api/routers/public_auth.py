from fastapi import APIRouter, HTTPException, BackgroundTasks, Request
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from enum import Enum
import re
import logging
import traceback
from ..services.tenant_service import TenantService
from ..dependencies import limiter
from ..utils.email_utils import send_welcome_email

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
    
    @field_validator('company_name')
    @classmethod
    def name_must_be_valid(cls, v):
        if len(v) < 3:
            raise ValueError('Company name must be at least 3 characters')
        return v

    @field_validator('password')
    @classmethod
    def password_complexity(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters')
        return v

@router.post("/register")
@limiter.limit("10/hour")
async def register_tenant(request: Request, payload: RegisterRequest, background_tasks: BackgroundTasks):
    """
    Public endpoint to register a new tenant.
    Creates schema, user, and configures modules based on plan.
    """
    try:
        # 1. Generate Schema Name
        schema_name = TenantService.slugify_schema_name(payload.company_name)

        # 2. Call Service (Synchronous for now to ensure capability,
        # ideally this should be a background task if migration takes long)
        # But user needs to know if it failed.

        # Logical Mapping: Priority for business_type, then plan_type, then default to FERRETERIA
        if payload.business_type:
            final_plan = payload.business_type  # already a plain str
        elif payload.plan_type:
            final_plan = payload.plan_type      # already a plain str
        else:
            final_plan = "FERRETERIA"

        result = TenantService.create_tenant(
            name=payload.company_name,
            schema_name=schema_name,
            admin_email=payload.email,
            admin_password=payload.password,
            plan_type=final_plan
        )

        # Send welcome email in background (non-blocking)
        try:
            tenant_url = f"https://{schema_name}.miinventariofacil.com"
            background_tasks.add_task(
                send_welcome_email,
                email_to=payload.email,
                company_name=payload.company_name,
                admin_password=payload.password,
                tenant_url=tenant_url,
                plan_label="Demo Gratuita",
            )
        except Exception as email_err:
            logger.warning(f"⚠️ Could not schedule welcome email for {payload.email}: {email_err}")

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
