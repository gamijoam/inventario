from pydantic import BaseModel
from typing import Optional, Any, Dict
from enum import Enum

class PrintType(str, Enum):
    KITCHEN_COMMAND = "KITCHEN_COMMAND"
    PRE_CHECK = "PRE_CHECK"
    INVOICE = "INVOICE"
    GENERIC_RECEIPT = "GENERIC_RECEIPT"

class PrintJobRequest(BaseModel):
    order_id: int
    print_type: PrintType
    printer_target: Optional[str] = None # e.g., "COCINA", "CAJA"
    payload: Optional[Dict[str, Any]] = None # Additional context for the template
