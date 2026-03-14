from pydantic import BaseModel, ConfigDict, constr, confloat
from typing import Optional, List
from decimal import Decimal
from datetime import datetime

class EmployeeBase(BaseModel):
    name: constr(min_length=1, max_length=100)
    document_id: Optional[str] = None
    phone: Optional[str] = None
    status: str = "ACTIVE"
    base_commission_percentage: Decimal = Decimal('50.00')

class EmployeeCreate(EmployeeBase):
    pass

class EmployeeUpdate(BaseModel):
    name: Optional[constr(min_length=1, max_length=100)] = None
    document_id: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None
    base_commission_percentage: Optional[Decimal] = None

class EmployeeResponse(EmployeeBase):
    id: int
    tenant_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class CommissionResponse(BaseModel):
    id: int
    user_id: int
    user_name: Optional[str] = None
    sale_detail_id: Optional[int] = None
    source_type: Optional[str] = None
    amount: Decimal
    percentage_applied: Optional[Decimal] = None
    status: str
    created_at: datetime
    paid_at: Optional[datetime] = None
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class CommissionPayoutRequest(BaseModel):
    employee_id: int
    commission_ids: List[int]
    payment_method: str = "Efectivo"
    reference: Optional[str] = None
    notes: Optional[str] = None

class CommissionPayoutResponse(BaseModel):
    success: bool
    paid_count: int
    total_paid: Decimal
    movement_id: int
    message: str
