from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List, Any
from datetime import datetime
from enum import Enum

# Using strings for Enums to avoid serialization issues
class WarrantyType(str, Enum):
    DAYS = "DAYS"
    MONTHS = "MONTHS"
    YEARS = "YEARS"
    LIFETIME = "LIFETIME"

class ClaimStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    COMPLETED = "COMPLETED"

class ResolutionType(str, Enum):
    REFUND = "REFUND"
    REPLACE = "REPLACE"
    REPAIR = "REPAIR"
    CREDIT = "CREDIT"

# =======================
# WARRANTY POLICY SCEMAS
# =======================

class WarrantyPolicyBase(BaseModel):
    name: str = Field(..., description="Nombre de la política", json_schema_extra={"example": "Garantía Limitada 30 Días"})
    type: WarrantyType = Field(..., description="Tipo de duración")
    duration: Optional[int] = Field(None, description="Duración en la unidad seleccionada. Null para Lifetime.")
    description: Optional[str] = Field(None, description="Descripción detallada y condiciones")
    is_default: bool = Field(False, description="Si es la política por defecto")
    is_active: bool = Field(True, description="Si la política está activa")

class WarrantyPolicyCreate(WarrantyPolicyBase):
    pass

class WarrantyPolicyRead(WarrantyPolicyBase):
    id: int
    tenant_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

# =======================
# WARRANTY CLAIM SCHEMAS
# =======================

class WarrantyClaimBase(BaseModel):
    sale_item_id: int = Field(..., description="ID del detalle de venta (SaleDetail)")
    customer_id: int = Field(..., description="ID del cliente que reclama")
    reason: str = Field(..., description="Razón del reclamo según el cliente")
    
class WarrantyClaimCreate(WarrantyClaimBase):
    pass

class WarrantyClaimUpdate(BaseModel):
    status: Optional[ClaimStatus] = None
    diagnosis: Optional[str] = None
    resolution_type: Optional[ResolutionType] = None
    resolution_notes: Optional[str] = None

class WarrantyClaimRead(WarrantyClaimBase):
    id: int
    tenant_id: int
    status: ClaimStatus
    policy_snapshot: Optional[Any] = None
    diagnosis: Optional[str] = None
    resolution_type: Optional[ResolutionType] = None
    resolution_notes: Optional[str] = None
    claimed_at: datetime
    resolved_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
