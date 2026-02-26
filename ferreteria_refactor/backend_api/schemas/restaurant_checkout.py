from pydantic import BaseModel
from typing import List, Optional

class PaymentCreate(BaseModel):
    amount: float
    currency: str
    payment_method: str
    exchange_rate: Optional[float] = 1.0

class RestaurantCheckout(BaseModel):
    payment_method: str
    currency: str
    client_id: Optional[int] = None
    payments: List[PaymentCreate] = [] # Supports multi-payment
    card_auth_code: Optional[str] = None # Optional reference
    
    # NEW: Core Sync Fields
    total_amount_bs: Optional[float] = 0.0
    change_amount: Optional[float] = 0.0
    change_currency: Optional[str] = "VES"
    exchange_rate: Optional[float] = 1.0
