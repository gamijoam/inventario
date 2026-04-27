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


class SelectionTypeDB(enum.Enum):
    SINGLE = "SINGLE"
    MULTIPLE = "MULTIPLE"

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
        try:
            state = object.__getattribute__(self, '__dict__')
        except AttributeError:
            return f"<RestaurantTable (detached)>"
        return f"<RestaurantTable(name={state.get('name')}, zone={state.get('zone')}, status={state.get('status')})>"

class RestaurantOrder(Base):
    __tablename__ = "restaurant_orders"

    id = Column(Integer, primary_key=True, index=True)
    table_id = Column(Integer, ForeignKey("restaurant_tables.id"), nullable=True) # Nullable for Takeout
    waiter_id = Column(Integer, ForeignKey("public.users.id"), nullable=True) # Who opened/attends the table
    
    is_takeout = Column(Boolean, default=False)
    customer_name = Column(String, nullable=True) # For identifying takeout orders
    
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
        try:
            state = object.__getattribute__(self, '__dict__')
        except AttributeError:
            return f"<RestaurantOrder (detached)>"
        return f"<RestaurantOrder(id={state.get('id')}, table={state.get('table_id')}, is_takeout={state.get('is_takeout')}, customer_name={state.get('customer_name')})>"

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
    modifiers = relationship("RestaurantOrderItemModifier", back_populates="order_item", cascade="all, delete-orphan")
    product = relationship("Product")

    @property
    def product_name(self):
        return self.product.name if self.product else "Unknown Product"

    def __repr__(self):
        try:
            state = object.__getattribute__(self, '__dict__')
        except AttributeError:
            return f"<RestaurantOrderItem (detached)>"
        return f"<RestaurantOrderItem(order={state.get('order_id')}, product={state.get('product_id')}, status={state.get('status')})>"

class RestaurantRecipe(Base):
    __tablename__ = "restaurant_recipes"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False) # The Dish (e.g. Burger)
    ingredient_id = Column(Integer, ForeignKey("products.id"), nullable=False) # The Ingredient (e.g. Bread)
    quantity = Column(Numeric(12, 3), nullable=False) # Amount to deduct per dish
    
    product = relationship("Product", foreign_keys=[product_id], back_populates="recipes")
    ingredient = relationship("Product", foreign_keys=[ingredient_id])

class RestaurantMenuSection(Base):
    __tablename__ = "restaurant_menu_sections"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    
    items = relationship("RestaurantMenuItem", back_populates="section", cascade="all, delete-orphan")

class RestaurantMenuItem(Base):
    __tablename__ = "restaurant_menu_items"

    id = Column(Integer, primary_key=True, index=True)
    section_id = Column(Integer, ForeignKey("restaurant_menu_sections.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    
    alias = Column(String, nullable=True) # Override name for menu
    price_override = Column(Numeric(12, 2), nullable=True) # Optional price override
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)

    section = relationship("RestaurantMenuSection", back_populates="items")
    product = relationship("Product")

class ProductModifierGroup(Base):
    __tablename__ = "product_modifier_groups"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    name = Column(String, nullable=False) # e.g., "Tamaño", "Porción", "Extras"
    selection_type = Column(Enum(SelectionTypeDB), default=SelectionTypeDB.SINGLE)
    is_required = Column(Boolean, default=False)

    options = relationship("ProductModifierOption", back_populates="group", cascade="all, delete-orphan")
    product = relationship("Product")

class ProductModifierOption(Base):
    __tablename__ = "product_modifier_options"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("product_modifier_groups.id"), nullable=False)
    name = Column(String, nullable=False) # e.g., "Familiar", "1/2 Pollo", "Extra Queso"
    price_adjustment = Column(Numeric(12, 2), default=0.00)
    recipe_factor = Column(Numeric(12, 3), default=1.000) # How much of the base recipe is consumed? (e.g. 0.5 for half)
    ingredient_id = Column(Integer, ForeignKey("products.id"), nullable=True) # Product ID of the ingredient consumed by this modifier
    quantity_consumed = Column(Numeric(12, 3), default=0.000) # Quantity of the ingredient consumed
    is_active = Column(Boolean, default=True)

    group = relationship("ProductModifierGroup", back_populates="options")

class RestaurantOrderItemModifier(Base):
    __tablename__ = "restaurant_order_item_modifiers"

    id = Column(Integer, primary_key=True, index=True)
    order_item_id = Column(Integer, ForeignKey("restaurant_order_items.id"), nullable=False)
    option_id = Column(Integer, ForeignKey("product_modifier_options.id"), nullable=False)
    price_applied = Column(Numeric(12, 2), default=0.00) # Snapshot of the adjustment

    order_item = relationship("RestaurantOrderItem", back_populates="modifiers")
    option = relationship("ProductModifierOption")

    @property
    def name(self):
        return self.option.name if self.option else "Unknown"
