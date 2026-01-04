from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Numeric, Text, DateTime, Enum
from sqlalchemy.orm import relationship
from ..database.db import Base
import datetime
import enum
from ..utils.time_utils import get_venezuela_now

class MovementType(enum.Enum):
    PURCHASE = "PURCHASE"
    SALE = "SALE"
    ADJUSTMENT = "ADJUSTMENT"  # For shrinkage, discounts, damaged goods
    RETURN = "RETURN"
    ADJUSTMENT_IN = "ADJUSTMENT_IN"
    ADJUSTMENT_OUT = "ADJUSTMENT_OUT"
    EXTERNAL_TRANSFER_IN = "EXTERNAL_TRANSFER_IN"
    EXTERNAL_TRANSFER_OUT = "EXTERNAL_TRANSFER_OUT"

class PaymentStatus(enum.Enum):
    PENDING = "PENDING"
    PARTIAL = "PARTIAL"
    PAID = "PAID"

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    parent_id = Column(Integer, ForeignKey('categories.id'), nullable=True)  # For subcategories

    # Relationships
    children = relationship("Category", backref="parent", remote_side=[id])
    products = relationship("Product", back_populates="category")

    def __repr__(self):
        return f"<Category(name='{self.name}', parent_id={self.parent_id})>"

class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    contact_person = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=get_venezuela_now)
    
    # Financial fields for Accounts Payable
    current_balance = Column(Numeric(12, 2), default=0.00)  # Current debt
    credit_limit = Column(Numeric(12, 2), nullable=True)  # Optional credit limit
    payment_terms = Column(Integer, default=30)  # Payment terms in days

    products = relationship("Product", back_populates="supplier")
    purchase_orders = relationship("PurchaseOrder", back_populates="supplier")

    def __repr__(self):
        return f"<Supplier(name='{self.name}')>"

class ExchangeRate(Base):
    """
    Exchange Rate Model - Supports multiple rates per currency
    Examples: BCV, Paralelo, Preferencial for VES
    """
    __tablename__ = "exchange_rates"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)  # "BCV", "Paralelo", "Preferencial"
    currency_code = Column(String, nullable=False)  # "VES", "COP", "PEN"
    currency_symbol = Column(String, nullable=False)  # "Bs", "COP", "S/"
    rate = Column(Numeric(14, 4), nullable=False)  # Exchange rate to USD
    is_default = Column(Boolean, default=False)  # Default rate for this currency
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=get_venezuela_now)
    updated_at = Column(DateTime, default=get_venezuela_now, onupdate=datetime.datetime.now)
    
    # Relationships
    products = relationship("Product", back_populates="exchange_rate")
    product_units = relationship("ProductUnit", back_populates="exchange_rate")
    
    def __repr__(self):
        return f"<ExchangeRate(name='{self.name}', code='{self.currency_code}', rate={self.rate})>"

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    sku = Column(String, unique=True, index=True, nullable=True) # Barcode
    description = Column(Text, nullable=True)
    price = Column(Numeric(12, 2), nullable=False, default=0.00)
    price_mayor_1 = Column(Numeric(12, 2), default=0.00) # Wholesale Price 1
    price_mayor_2 = Column(Numeric(12, 2), default=0.00) # Wholesale Price 2
    cost_price = Column(Numeric(14, 4), default=0.0000)  # Cost for profit margin calculation
    
    # Pricing System Fields
    profit_margin = Column(Numeric(5, 2), nullable=True)  # Profit margin percentage (e.g., 30.00 = 30%)
    discount_percentage = Column(Numeric(5, 2), default=0.00)  # Promotional discount percentage
    is_discount_active = Column(Boolean, default=False)  # Enable/disable promotional discount
    tax_rate = Column(Numeric(5, 2), default=0.00) # Tax rate percentage (e.g. 16.00 for 16%)
    
    stock = Column(Numeric(12, 3), default=0.000) # Base units
    min_stock = Column(Numeric(12, 3), default=5.000) # Low stock alert threshold
    is_active = Column(Boolean, default=True) # Logical delete

    # Core Logic for Hardware Store
    is_box = Column(Boolean, default=False)
    location = Column(String, nullable=True) # Shelf/Department location
    conversion_factor = Column(Integer, default=1) # How many units in the box?
    unit_type = Column(String, default="Unidad") # Unidad, Metro, Kilo, Litro
    
    # NEW: Combo/Bundle Support
    is_combo = Column(Boolean, default=False)  # True if this product is a combo/bundle
    
    # Image Support
    image_url = Column(String(255), nullable=True)  # Relative path to product image
    updated_at = Column(DateTime, default=get_venezuela_now, onupdate=datetime.datetime.now)  # Auto-updated timestamp

    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    exchange_rate_id = Column(Integer, ForeignKey("exchange_rates.id"), nullable=True)  # Product-level default rate

    category = relationship("Category", back_populates="products")
    supplier = relationship("Supplier", back_populates="products")
    exchange_rate = relationship("ExchangeRate", back_populates="products")
    price_rules = relationship("PriceRule", back_populates="product")
    units = relationship("ProductUnit", back_populates="product", cascade="all, delete-orphan")
    
    # NEW: Combo relationships
    # Items that are part of THIS combo (if this product is a combo)
    combo_items = relationship(
        "ComboItem", 
        foreign_keys="ComboItem.parent_product_id",
        back_populates="parent_product",
        cascade="all, delete-orphan"
    )
    
    # Combos that include THIS product as a component
    parent_combos = relationship(
        "ComboItem",
        foreign_keys="ComboItem.child_product_id",
        back_populates="child_product"
    )
    
    # NEW: Multi-Warehouse Stocks
    stocks = relationship("ProductStock", back_populates="product", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Product(name='{self.name}', is_box={self.is_box}, is_combo={self.is_combo}, factor={self.conversion_factor})>"

class ProductUnit(Base):
    __tablename__ = "product_units"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    unit_name = Column(String, nullable=False)  # Ej: "Saco", "Caja", "Gramo"
    conversion_factor = Column(Numeric(14, 4), nullable=False) # Ej: 50.0 (Saco), 0.001 (Gramo)
    barcode = Column(String, nullable=True) # Código específico de la presentación
    cost_price = Column(Numeric(14, 4), nullable=True)  # Cost calculated: base_cost * factor
    price_usd = Column(Numeric(12, 2), nullable=True) # Precio específico (opcional)
    
    # Pricing System Fields
    profit_margin = Column(Numeric(5, 2), nullable=True)  # Unit-specific profit margin
    discount_percentage = Column(Numeric(5, 2), default=0.00)  # Unit-specific discount
    is_discount_active = Column(Boolean, default=False)  # Enable/disable unit discount
    
    is_default = Column(Boolean, default=False)
    exchange_rate_id = Column(Integer, ForeignKey("exchange_rates.id"), nullable=True)  # Unit-specific rate

    product = relationship("Product", back_populates="units")
    exchange_rate = relationship("ExchangeRate", back_populates="product_units")

    def __repr__(self):
        return f"<ProductUnit(name='{self.unit_name}', factor={self.conversion_factor})>"

class ComboItem(Base):
    """
    Combo/Bundle Item Model - Defines components of a combo product
    Example: "Combo Emprendedor" contains "2x Cemento" + "1x Pala"
    """
    __tablename__ = "combo_items"
    
    id = Column(Integer, primary_key=True, index=True)
    parent_product_id = Column(Integer, ForeignKey("products.id"), nullable=False)  # The combo product
    child_product_id = Column(Integer, ForeignKey("products.id"), nullable=False)   # The component product
    quantity = Column(Numeric(12, 3), nullable=False, default=1.000)  # Quantity of child in combo
    unit_id = Column(Integer, ForeignKey("product_units.id"), nullable=True)  # NEW: Optional unit/presentation
    
    # Relationships
    parent_product = relationship(
        "Product",
        foreign_keys=[parent_product_id],
        back_populates="combo_items"
    )
    child_product = relationship(
        "Product",
        foreign_keys=[child_product_id],
        back_populates="parent_combos"
    )
    unit = relationship("ProductUnit", foreign_keys=[unit_id])  # NEW: Link to specific unit
    
    def __repr__(self):
        return f"<ComboItem(parent={self.parent_product_id}, child={self.child_product_id}, qty={self.quantity})>"

class Kardex(Base):
    __tablename__ = "kardex"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    date = Column(DateTime, default=get_venezuela_now)
    movement_type = Column(Enum(MovementType), nullable=False)
    quantity = Column(Numeric(12, 3), nullable=False) # Positive or Negative
    balance_after = Column(Numeric(12, 3), nullable=False)
    description = Column(Text, nullable=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=True) # NEW: Warehouse link

    product = relationship("Product")

    def __repr__(self):
        return f"<Kardex(product='{self.product_id}', type='{self.movement_type}', qty={self.quantity})>"

class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime, default=get_venezuela_now, index=True)
    total_amount = Column(Numeric(12, 2), nullable=False)
    payment_method = Column(String, default="Efectivo") # Efectivo, Tarjeta, Credito
    
    # Dual Currency Support
    currency = Column(String, default="USD") # USD or BS
    exchange_rate_used = Column(Numeric(14, 4), default=1.0000) # Rate at time of sale
    total_amount_bs = Column(Numeric(12, 2), nullable=True) # Amount in Bs if applicable
    
    # Change / Vuelto Logic
    change_amount = Column(Numeric(12, 2), default=0.00) # Amount returned to customer
    change_currency = Column(String(3), default='VES') # Currency of the change (usually VES)
    
    # Credit Sales
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    is_credit = Column(Boolean, default=False)
    paid = Column(Boolean, default=True) # False for credit sales
    due_date = Column(DateTime, nullable=True)  # Payment deadline for credit sales
    balance_pending = Column(Numeric(12, 2), nullable=True)  # Remaining balance for partial payments
    
    # Sale Notes
    notes = Column(Text, nullable=True)  # Special observations or instructions
    
    # Hybrid/Sync Fields
    unique_uuid = Column(String(36), nullable=True, unique=True, index=True)
    sync_status = Column(String(20), default="SYNCED") # SYNCED, PENDING
    is_offline_sale = Column(Boolean, default=False)
    
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=True) # Linked warehouse

    details = relationship("SaleDetail", back_populates="sale")
    customer = relationship("Customer", back_populates="sales")
    payments = relationship("SalePayment", back_populates="sale", lazy="joined")
    returns = relationship("Return", back_populates="sale")
    warehouse = relationship("Warehouse")

    @property
    def status(self):
        return "VOIDED" if self.returns else "COMPLETED"

    def __repr__(self):
        return f"<Sale(id={self.id}, total={self.total_amount})>"

class SalePayment(Base):
    __tablename__ = "sale_payments"

    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String, default="USD") # USD or Bs
    payment_method = Column(String, default="Efectivo") # Efectivo, Tarjeta, etc.
    exchange_rate = Column(Numeric(14, 4), default=1.0000) # Rate used for this specific payment

    sale = relationship("Sale", back_populates="payments")

class SaleDetail(Base):
    __tablename__ = "sale_details"

    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Numeric(12, 3), nullable=False) # Units sold
    unit_price = Column(Numeric(12, 2), nullable=False) # Price at moment of sale
    
    # Discount Support
    discount = Column(Numeric(12, 2), default=0.00)  # Discount amount or percentage
    discount_type = Column(String, default="NONE")  # NONE, PERCENT, FIXED
    
    # Tax Support
    tax_rate = Column(Numeric(5, 2), default=0.00)  # Tax rate applied at moment of sale (e.g. 16.00)
    
    # Financial Integrity
    cost_at_sale = Column(Numeric(14, 4), default=0.0000)  # Historical cost at moment of sale

    subtotal = Column(Numeric(12, 2), nullable=False)
    is_box_sale = Column(Boolean, default=False) # Was it sold as a box?
    
    # NEW: Unit/Presentation Support
    unit_id = Column(Integer, ForeignKey("product_units.id"), nullable=True)  # Which presentation was sold
    
    # NEW: Commission Support
    salesperson_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Who sold this item

    sale = relationship("Sale", back_populates="details")
    product = relationship("Product")
    unit = relationship("ProductUnit")  # NEW: Link to presentation used
    salesperson = relationship("User", foreign_keys=[salesperson_id]) # NEW

    def __repr__(self):
        return f"<SaleDetail(product='{self.product_id}', qty={self.quantity}, tax={self.tax_rate})>"

class CashSession(Base):
    __tablename__ = "cash_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    start_time = Column(DateTime, default=get_venezuela_now)
    end_time = Column(DateTime, nullable=True)
    initial_cash = Column(Numeric(12, 2), default=0.00)
    initial_cash_bs = Column(Numeric(12, 2), default=0.00) # Initial amount in Bs
    final_cash_reported = Column(Numeric(12, 2), nullable=True) # What user counted (USD)
    final_cash_reported_bs = Column(Numeric(12, 2), nullable=True) # What user counted (Bs)
    final_cash_expected = Column(Numeric(12, 2), nullable=True) # Calculated (USD)
    final_cash_expected_bs = Column(Numeric(12, 2), nullable=True) # Calculated (Bs)
    difference = Column(Numeric(12, 2), nullable=True) # USD difference
    difference_bs = Column(Numeric(12, 2), nullable=True) # Bs difference
    status = Column(String, default="OPEN") # OPEN, CLOSED

    movements = relationship("CashMovement", back_populates="session")
    currencies = relationship("CashSessionCurrency", back_populates="session", cascade="all, delete-orphan")
    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self):
        return f"<CashSession(id={self.id}, status='{self.status}')>"

class CashSessionCurrency(Base):
    __tablename__ = "cash_session_currencies"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("cash_sessions.id"), nullable=False)
    currency_symbol = Column(String, nullable=False)
    initial_amount = Column(Numeric(12, 2), default=0.00)
    final_reported = Column(Numeric(12, 2), nullable=True)
    final_expected = Column(Numeric(12, 2), nullable=True)
    difference = Column(Numeric(12, 2), nullable=True)
    
    session = relationship("CashSession", back_populates="currencies")
    
    def __repr__(self):
        return f"<CashSessionCurrency(session={self.session_id}, currency='{self.currency_symbol}')>"


class CashMovement(Base):
    __tablename__ = "cash_movements"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("cash_sessions.id"), nullable=False)
    type = Column(String, nullable=False) # EXPENSE, WITHDRAWAL, DEPOSIT
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String, default="USD") # USD or BS
    exchange_rate = Column(Numeric(14, 4), default=1.0000)
    description = Column(Text, nullable=True)
    date = Column(DateTime, default=get_venezuela_now)

    session = relationship("CashSession", back_populates="movements")

    def __repr__(self):
        return f"<CashMovement(type='{self.type}', amount={self.amount})>"

class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    CASHIER = "CASHIER"
    WAREHOUSE = "WAREHOUSE"
    WAITER = "WAITER"
    KITCHEN = "KITCHEN"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    pin = Column(String, nullable=True)  # 4-6 digit PIN for discount authorization
    role = Column(Enum(UserRole), default=UserRole.CASHIER)
    full_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    commission_percentage = Column(Numeric(5, 2), default=0.00) # NEW: Commission %
    created_at = Column(DateTime, default=get_venezuela_now)

    def __repr__(self):
        return f"<User(username='{self.username}', role='{self.role}')>"

class CommissionLog(Base):
    """
    Tracks commissions earned by users per sale item
    """
    __tablename__ = "commission_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    sale_detail_id = Column(Integer, ForeignKey("sale_details.id"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False) # Commission amount in USD
    currency = Column(String, default="USD")
    percentage_applied = Column(Numeric(5, 2), nullable=False) # Snapshot of % used
    created_at = Column(DateTime, default=get_venezuela_now)

    user = relationship("User")
    sale_detail = relationship("SaleDetail")

    def __repr__(self):
        return f"<CommissionLog(user={self.user_id}, amount={self.amount})>"

class Return(Base):
    __tablename__ = "returns"

    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False)
    date = Column(DateTime, default=get_venezuela_now)
    total_refunded = Column(Numeric(12, 2), nullable=False)
    reason = Column(Text, nullable=True)

    sale = relationship("Sale", back_populates="returns")
    details = relationship("ReturnDetail", back_populates="return_obj")

    def __repr__(self):
        return f"<Return(id={self.id}, sale={self.sale_id})>"

class ReturnDetail(Base):
    __tablename__ = "return_details"

    id = Column(Integer, primary_key=True, index=True)
    return_id = Column(Integer, ForeignKey("returns.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Numeric(12, 3), nullable=False) # Units returned
    unit_price = Column(Numeric(12, 2), default=0.00)  # Price at time of return
    unit_cost = Column(Numeric(14, 4), default=0.0000) # Cost at time of return (historical)

    return_obj = relationship("Return", back_populates="details")
    product = relationship("Product")

    def __repr__(self):
        return f"<ReturnDetail(product='{self.product_id}', qty={self.quantity})>"

class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    id_number = Column(String, nullable=True, index=True)  # Cédula/ID
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    credit_limit = Column(Numeric(12, 2), default=0.00)
    payment_term_days = Column(Integer, default=15)  # Default payment term in days
    is_blocked = Column(Boolean, default=False)  # Manual credit block flag
    
    # Hybrid/Sync Fields
    unique_uuid = Column(String(36), nullable=True, unique=True, index=True)
    sync_status = Column(String(20), default="SYNCED") # SYNCED, PENDING

    sales = relationship("Sale", back_populates="customer")
    payments = relationship("Payment", back_populates="customer")

    def __repr__(self):
        return f"<Customer(name='{self.name}')>"

class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    date = Column(DateTime, default=get_venezuela_now)
    description = Column(Text, nullable=True)
    
    # Dual Currency Support
    currency = Column(String, default="USD") # USD or BS
    exchange_rate_used = Column(Numeric(14, 4), default=1.0000) # Rate at time of payment
    amount_bs = Column(Numeric(12, 2), nullable=True) # Amount in Bs if applicable
    payment_method = Column(String, default="Efectivo") # Efectivo, Transferencia, Tarjeta

    customer = relationship("Customer", back_populates="payments")

    def __repr__(self):
        return f"<Payment(customer={self.customer_id}, amount={self.amount})>"


class PriceRule(Base):
    __tablename__ = "price_rules"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    min_quantity = Column(Numeric(12, 3), nullable=False)  # Minimum qty to apply this price
    price = Column(Numeric(12, 2), nullable=False)  # Special price for this tier

    product = relationship("Product", back_populates="price_rules")

    def __repr__(self):
        return f"<PriceRule(product={self.product_id}, min_qty={self.min_quantity}, price={self.price})>"

class Quote(Base):
    __tablename__ = "quotes"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    date = Column(DateTime, default=get_venezuela_now)
    total_amount = Column(Numeric(12, 2), nullable=False)
    status = Column(String, default="PENDING")  # PENDING, CONVERTED, EXPIRED
    notes = Column(Text, nullable=True)

    customer = relationship("Customer")
    details = relationship("QuoteDetail", back_populates="quote")

    def __repr__(self):
        return f"<Quote(id={self.id}, total={self.total_amount}, status='{self.status}')>"

class QuoteDetail(Base):
    __tablename__ = "quote_details"

    id = Column(Integer, primary_key=True, index=True)
    quote_id = Column(Integer, ForeignKey("quotes.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Numeric(12, 3), nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False)
    subtotal = Column(Numeric(12, 2), nullable=False)
    is_box_sale = Column(Boolean, default=False)

    quote = relationship("Quote", back_populates="details")
    product = relationship("Product")

    def __repr__(self):
        return f"<QuoteDetail(product={self.product_id}, qty={self.quantity})>"

class BusinessConfig(Base):
    __tablename__ = "business_config"

    key = Column(String, primary_key=True, index=True)
    value = Column(Text, nullable=True)
    
    # Dual Currency Support (stored as special keys)
    # exchange_rate: Current USD to Bs rate
    # exchange_rate_updated_at: Last update timestamp

    def __repr__(self):
        return f"<BusinessConfig(key='{self.key}', value='{self.value}')>"

class PaymentMethod(Base):
    __tablename__ = "payment_methods"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    is_active = Column(Boolean, default=True)
    is_system = Column(Boolean, default=False) # Prevent deletion of core methods

    def __repr__(self):
        return f"<PaymentMethod(name='{self.name}')>"

class Currency(Base):
    __tablename__ = "business_currencies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    symbol = Column(String, nullable=False)
    rate = Column(Numeric(14, 4), default=1.0000)
    is_anchor = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    def __repr__(self):
        return f"<Currency(symbol='{self.symbol}', rate={self.rate})>"

# Purchase Order and Payment Models for Accounts Payable

class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"
    
    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    purchase_date = Column(DateTime, default=get_venezuela_now)
    due_date = Column(DateTime, nullable=True)  # Calculated from purchase_date + payment_terms
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=True) # NEW: Receiving warehouse
    
    # Payment tracking
    total_amount = Column(Numeric(12, 2), default=0.00)
    paid_amount = Column(Numeric(12, 2), default=0.00)
    payment_status = Column(Enum(PaymentStatus), default=PaymentStatus.PENDING)
    
    # Additional info
    invoice_number = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    
    # Relationships
    supplier = relationship("Supplier", back_populates="purchase_orders")
    payments = relationship("PurchasePayment", back_populates="purchase", cascade="all, delete-orphan")
    items = relationship("PurchaseItem", back_populates="purchase", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<PurchaseOrder(id={self.id}, supplier={self.supplier_id}, total={self.total_amount}, status={self.payment_status})>"

class PurchasePayment(Base):
    __tablename__ = "purchase_payments"
    
    id = Column(Integer, primary_key=True, index=True)
    purchase_id = Column(Integer, ForeignKey("purchase_orders.id"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    payment_date = Column(DateTime, default=get_venezuela_now)
    payment_method = Column(String, default="Efectivo")  # Efectivo, Transferencia, Cheque
    reference = Column(String, nullable=True)  # Transfer/check number
    notes = Column(Text, nullable=True)
    currency = Column(String, default="USD")
    exchange_rate = Column(Numeric(14, 4), default=1.0000)
    
    # Relationship
    purchase = relationship("PurchaseOrder", back_populates="payments")
    
    
    def __repr__(self):
        return f"<PurchasePayment(id={self.id}, purchase={self.purchase_id}, amount={self.amount})>"

class PurchaseItem(Base):
    __tablename__ = "purchase_items"
    
    id = Column(Integer, primary_key=True, index=True)
    purchase_id = Column(Integer, ForeignKey("purchase_orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Numeric(12, 3), nullable=False)
    unit_cost = Column(Numeric(14, 4), nullable=False) # Store cost at time of purchase
    
    # Relationships
    purchase = relationship("PurchaseOrder", back_populates="items")
    product = relationship("Product")
    
    def __repr__(self):
        return f"<PurchaseItem(purchase={self.purchase_id}, product={self.product_id}, qty={self.quantity})>"

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Nullable for system actions or if user deleted
    action = Column(String, nullable=False) # CREATE, UPDATE, DELETE, LOGIN
    table_name = Column(String, nullable=False)
    record_id = Column(Integer, nullable=True)
    changes = Column(Text, nullable=True) # JSON String
    ip_address = Column(String, nullable=True)
    timestamp = Column(DateTime, default=get_venezuela_now, index=True)

    user = relationship("User")

class Warehouse(Base):
    __tablename__ = "warehouses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    address = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    is_main = Column(Boolean, default=False) # To identify the primary/default warehouse

    stocks = relationship("ProductStock", back_populates="warehouse")

    def __repr__(self):
        return f"<Warehouse(name='{self.name}', main={self.is_main})>"

class ProductStock(Base):
    __tablename__ = "product_stocks"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    quantity = Column(Numeric(12, 3), default=0.000)
    location = Column(String, nullable=True) # Specific shelf/bin in this warehouse

    product = relationship("Product", back_populates="stocks")
    warehouse = relationship("Warehouse", back_populates="stocks")

    def __repr__(self):
        return f"<ProductStock(product={self.product_id}, warehouse={self.warehouse_id}, qty={self.quantity})>"



# ============================================
# TABLA DE PRUEBA PARA AUTO-MIGRACION
# ============================================
class TestAutoMigration(Base):
    """Tabla de prueba para verificar el sistema de auto-migracion."""
    __tablename__ = "test_auto_migration"
    
    id = Column(Integer, primary_key=True, index=True)
    test_name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=get_venezuela_now)
    is_active = Column(Boolean, default=True)


class InventoryTransfer(Base):
    __tablename__ = "inventory_transfers"

    id = Column(Integer, primary_key=True, index=True)
    source_warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    target_warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    date = Column(DateTime, default=get_venezuela_now)
    status = Column(String, default="PENDING") # PENDING, COMPLETED, CANCELLED
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=get_venezuela_now)
    updated_at = Column(DateTime, onupdate=datetime.datetime.now)

    source_warehouse = relationship("Warehouse", foreign_keys=[source_warehouse_id])
    target_warehouse = relationship("Warehouse", foreign_keys=[target_warehouse_id])
    details = relationship("TransferDetail", back_populates="transfer", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<InventoryTransfer(id={self.id}, s={self.source_warehouse_id}, t={self.target_warehouse_id}, status={self.status})>"

class TransferDetail(Base):
    __tablename__ = "transfer_details"

    id = Column(Integer, primary_key=True, index=True)
    transfer_id = Column(Integer, ForeignKey("inventory_transfers.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Numeric(12, 3), nullable=False)

    transfer = relationship("InventoryTransfer", back_populates="details")
    product = relationship("Product")

    def __repr__(self):
        return f"<TransferDetail(t={self.transfer_id}, p={self.product_id}, q={self.quantity})>"





# ============================================
# RESTAURANT MODULE
# ============================================
from .restaurant import RestaurantTable, RestaurantOrder, RestaurantOrderItem
