from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from decimal import Decimal

class PaymentBase(BaseModel):
    amount: Decimal
    currency: str
    payment_method: str
    reference: Optional[str] = None
    status: str = "completed"
    notes: Optional[str] = None

class PaymentCreate(PaymentBase):
    tenant_id: int

class PaymentOut(PaymentBase):
    id: int
    tenant_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
