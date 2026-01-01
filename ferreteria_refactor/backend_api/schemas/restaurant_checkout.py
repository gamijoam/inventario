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
