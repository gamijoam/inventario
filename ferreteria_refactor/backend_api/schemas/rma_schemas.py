from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime, date
from enum import Enum
from decimal import Decimal

# Helper Enum
class ItemCondition(str, Enum):
    GOOD = "GOOD"
    DAMAGED = "DAMAGED"

class RMAAction(str, Enum):
    REFUND = "REFUND"
    STORE_CREDIT = "STORE_CREDIT"
    REPLACEMENT = "REPLACEMENT"

class RMACheckResponse(BaseModel):
    valid: bool
    message: str
    sale_date: Optional[datetime] = None
    customer_name: Optional[str] = None
    product_name: Optional[str] = None
    days_elapsed: Optional[int] = None
    warranty_status: str # ACTIVE, EXPIRED, NOT_FOUND
    original_price: Optional[Decimal] = None
    
class RMAProcessRequest(BaseModel):
    imei: str
    reason: str
    condition: ItemCondition # GOOD (Resalable) or DAMAGED (Defective)
    action: RMAAction
    notes: Optional[str] = None

class RMAProcessResponse(BaseModel):
    status: str
    refund_amount: Decimal
    new_stock_status: str
    commission_reversed: bool
