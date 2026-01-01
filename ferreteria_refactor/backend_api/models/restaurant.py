from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Numeric, Text, DateTime, Enum
from sqlalchemy.orm import relationship
from ..database.db import Base
from ..utils.time_utils import get_venezuela_now
import datetime
# from .models import User  <-- Circular import avoided by using string "User" in relationship
# from .models import Product <-- Circular import avoided by using string "Product" in relationship

# Re-using Enums defined in schemas is tricky due to circular imports or code duplication if not careful.
# For simplicity in SQLAlchemy, we often define Enums again or use strings, but let's try to import if possible, 
# or simpler: redefine standard Enums here for DB mapping.
import enum

class TableStatusDB(enum.Enum):
    AVAILABLE = "AVAILABLE"
    OCCUPIED = "OCCUPIED"
    RESERVED = "RESERVED"
    CLEANING = "CLEANING"

class OrderStatusDB(enum.Enum):
    PENDING = "PENDING"
    PREPARING = "PREPARING"
    READY = "READY"
    DELIVERED = "DELIVERED"
    PAID = "PAID"
    CANCELLED = "CANCELLED"

class OrderItemStatusDB(enum.Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    PREPARING = "PREPARING" # Added for KDS
    READY = "READY"
    SERVED = "SERVED"
    CANCELLED = "CANCELLED"

class RestaurantTable(Base):
    __tablename__ = "restaurant_tables"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False) # "Mesa 1", "Barra 3"
    zone = Column(String, nullable=False, index=True) # "Terraza", "Salón Principal"
    capacity = Column(Integer, default=4)
    status = Column(Enum(TableStatusDB), default=TableStatusDB.AVAILABLE)
    is_active = Column(Boolean, default=True)
    
    # Relationship to active order could be tricky, usually handled by query finding "status != PAID" order for this table
    # But we can add a helper relationship if needed.
    orders = relationship("RestaurantOrder", back_populates="table")

    def __repr__(self):
        return f"<RestaurantTable(name='{self.name}', zone='{self.zone}', status='{self.status}')>"

class RestaurantOrder(Base):
    __tablename__ = "restaurant_orders"

    id = Column(Integer, primary_key=True, index=True)
    table_id = Column(Integer, ForeignKey("restaurant_tables.id"), nullable=False)
    waiter_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Who opened/attends the table
    
    status = Column(Enum(OrderStatusDB), default=OrderStatusDB.PENDING)
    total_amount = Column(Numeric(12, 2), default=0.00)
    created_at = Column(DateTime, default=get_venezuela_now)
    updated_at = Column(DateTime, default=get_venezuela_now, onupdate=datetime.datetime.now)
    
    # Link to main Sale table if we want to integrate with final checkout?
    # For now, let's keep it separate until "Closing" the table which generates a Sale.
    # Link to main Sale table
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=True)

    table = relationship("RestaurantTable", back_populates="orders")
    waiter = relationship("User")
    items = relationship("RestaurantOrderItem", back_populates="order", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<RestaurantOrder(id={self.id}, table={self.table_id}, status='{self.status}')>"

class RestaurantOrderItem(Base):
    __tablename__ = "restaurant_order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("restaurant_orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    
    quantity = Column(Numeric(12, 3), nullable=False)
    notes = Column(Text, nullable=True) # "Sin cebolla", "Bien cocido"
    status = Column(Enum(OrderItemStatusDB), default=OrderItemStatusDB.PENDING)
    
    unit_price = Column(Numeric(12, 2), nullable=False) # Snapshot price
    subtotal = Column(Numeric(12, 2), nullable=False)

    order = relationship("RestaurantOrder", back_populates="items")
    product = relationship("Product")

    @property
    def product_name(self):
        return self.product.name if self.product else "Unknown Product"

    def __repr__(self):
        return f"<RestaurantOrderItem(order={self.order_id}, product={self.product_id}, status='{self.status}')>"
