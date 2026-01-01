from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime
from decimal import Decimal
from enum import Enum

# --- ENUMS ---
class TableStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    OCCUPIED = "OCCUPIED"
    RESERVED = "RESERVED"
    CLEANING = "CLEANING"

class OrderStatus(str, Enum):
    PENDING = "PENDING"
    PREPARING = "PREPARING"
    READY = "READY"
    DELIVERED = "DELIVERED"
    PAID = "PAID"
    CANCELLED = "CANCELLED"

class OrderItemStatus(str, Enum):
    PENDING = "PENDING"     # Recibido
    SENT = "SENT"           # Enviado a cocina/barra
    PREPARING = "PREPARING" # Cocinando
    READY = "READY"         # Listo para entregar
    SERVED = "SERVED"       # Entregado en mesa
    CANCELLED = "CANCELLED"

# --- SCHEMAS FOR TABLES ---
class RestaurantTableBase(BaseModel):
    name: str = Field(..., description="Nombre o número de la mesa", example="Mesa 1")
    zone: str = Field(..., description="Zona del restaurante", example="Terraza")
    capacity: int = Field(4, description="Capacidad de personas", ge=1)
    status: TableStatus = Field(TableStatus.AVAILABLE, description="Estado actual")
    is_active: bool = Field(True, description="Mesa habilitada")

class TableCreate(RestaurantTableBase):
    pass

class TableUpdate(BaseModel):
    name: Optional[str] = None
    zone: Optional[str] = None
    capacity: Optional[int] = None
    status: Optional[TableStatus] = None
    is_active: Optional[bool] = None

class TableRead(RestaurantTableBase):
    id: int
    current_order_id: Optional[int] = None # ID de la orden activa si está ocupada

    class Config:
        from_attributes = True

# --- SCHEMAS FOR ORDERS ---
class OrderItemCreate(BaseModel):
    product_id: int
    quantity: Decimal = Field(..., gt=0)
    notes: Optional[str] = None

class OrderItemRead(BaseModel):
    id: int
    product_id: int
    product_name: str # Para mostrar sin hacer join en frontend todo el tiempo
    quantity: Decimal
    status: OrderItemStatus
    notes: Optional[str] = None
    unit_price: Decimal
    subtotal: Decimal
    
    class Config:
        from_attributes = True

class OrderCreate(BaseModel):
    table_id: int
    waiter_id: Optional[int] = None # Opcional, puede asignarse automáticamente al usuario actual
    items: List[OrderItemCreate] = []

class OrderRead(BaseModel):
    id: int
    table_id: int
    waiter_id: Optional[int]
    status: OrderStatus
    total_amount: Decimal
    created_at: datetime
    items: List[OrderItemRead] = []

    class Config:
        from_attributes = True

# --- Move & Split Schemas ---
class OrderMove(BaseModel):
    target_table_id: int = Field(..., description="ID de la mesa destino")

class SplitItem(BaseModel):
    item_id: int
    quantity: Decimal = Field(..., gt=0, description="Cantidad a separar")

class OrderSplit(BaseModel):
    items_to_split: List[SplitItem]
