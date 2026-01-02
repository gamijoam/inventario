from pydantic import BaseModel, Field, condecimal
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
from decimal import Decimal

# Item Condition Enum for Returns
class ItemCondition(str, Enum):
    GOOD = "GOOD"
    DAMAGED = "DAMAGED"

class ProductBase(BaseModel):
    name: str = Field(..., description="Nombre comercial del producto", example="Taladro Percutor 500W")
    sku: Optional[str] = Field(None, description="Código único de inventario (SKU)", example="TAL-001")
    price: Decimal = Field(..., description="Precio de venta al público en USD", gt=0, example="45.99")
    price_mayor_1: Optional[Decimal] = Field(Decimal("0.00"), description="Precio mayorista nivel 1", example="42.00")
    price_mayor_2: Optional[Decimal] = Field(Decimal("0.00"), description="Precio mayorista nivel 2", example="40.00")
    stock: Optional[Decimal] = Field(Decimal("0.000"), description="Cantidad actual en inventario físico", example="10.000")
    description: Optional[str] = Field(None, description="Descripción detallada del producto", example="Incluye maletín y brocas")
    cost_price: Optional[Decimal] = Field(Decimal("0.0000"), description="Costo de adquisición en USD", example="25.0000")
    
    # Pricing System Fields
    profit_margin: Optional[Decimal] = Field(None, description="Margen de ganancia en porcentaje", example="30.00")
    discount_percentage: Optional[Decimal] = Field(Decimal("0.00"), description="Descuento promocional en porcentaje", example="10.00")
    is_discount_active: bool = Field(False, description="Activar/desactivar descuento promocional")
    tax_rate: Optional[Decimal] = Field(Decimal("0.00"), description="Porcentaje de Impuesto (IVA)", example="16.00")
    
    min_stock: Optional[Decimal] = Field(Decimal("5.000"), description="Nivel mínimo para alerta de reabastecimiento", example="5.000")
    unit_type: Optional[str] = Field("Unidad", description="Unidad de medida base", example="Unidad")
    is_box: bool = Field(False, description="Indica si es vendido por caja (Legacy)")
    conversion_factor: Decimal = Field(Decimal("1.0"), description="Factor de conversión", example="1.0")
    category_id: Optional[int] = Field(None, description="ID de la categoría a la que pertenece", example=3)
    supplier_id: Optional[int] = Field(None, description="ID del proveedor principal", example=1)
    location: Optional[str] = Field(None, description="Ubicación física en almacén", example="Pasillo 4, Estante B")
    exchange_rate_id: Optional[int] = Field(None, description="ID de tasa de cambio específica (opcional)", example=2)
    is_combo: bool = Field(False, description="Indica si el producto es un combo/bundle")
    is_active: bool = Field(True, description="Indica si el producto está disponible para la venta")
    
    # Image Support
    image_url: Optional[str] = Field(None, description="URL relativa de la imagen del producto", example="/images/products/123.webp")
    updated_at: Optional[datetime] = Field(None, description="Fecha de última actualización (auto-gestionada)")

# Exchange Rate Schemas
class ExchangeRateBase(BaseModel):
    name: str
    currency_code: str
    currency_symbol: str
    rate: Decimal
    is_default: bool = False
    is_active: bool = True

class ExchangeRateCreate(ExchangeRateBase):
    pass

class ExchangeRateUpdate(BaseModel):
    name: Optional[str] = None
    rate: Optional[Decimal] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None

class ExchangeRateRead(ExchangeRateBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class ProductUnitBase(BaseModel):
    unit_name: str
    conversion_factor: Decimal
    barcode: Optional[str] = None
    cost_price: Optional[Decimal] = None  # Calculated: base_cost * factor
    price_usd: Optional[Decimal] = None
    
    # Pricing System Fields
    profit_margin: Optional[Decimal] = None
    discount_percentage: Optional[Decimal] = Decimal("0.00")
    is_discount_active: bool = False
    
    is_default: bool = False
    exchange_rate_id: Optional[int] = None  # NEW: Specific rate for this unit

class ProductUnitCreate(ProductUnitBase):
    pass

class ProductUnitRead(ProductUnitBase):
    id: int
    product_id: int
    exchange_rate: Optional[ExchangeRateRead] = None  # NEW: Include rate details

    class Config:
        from_attributes = True

# Combo/Bundle Schemas
class ComboItemBase(BaseModel):
    child_product_id: int = Field(..., description="ID del producto componente", example=5)
    quantity: Decimal = Field(..., description="Cantidad del componente en el combo", gt=0, example="2.000")
    unit_id: Optional[int] = Field(None, description="ID de la presentación específica (opcional)")  # NEW

class ComboItemCreate(ComboItemBase):
    pass

class ComboItemRead(ComboItemBase):
    id: int
    parent_product_id: int
    child_product: Optional['ProductRead'] = None  # Include child product details
    
    class Config:
        from_attributes = True

class ProductStockRead(BaseModel):
    id: int
    product_id: int
    warehouse_id: int
    quantity: Decimal
    location: Optional[str] = None
    
    class Config:
        from_attributes = True

class ProductStockCreate(BaseModel):
    warehouse_id: int
    quantity: Decimal
    location: Optional[str] = None

class ProductCreate(ProductBase):
    units: List[ProductUnitCreate] = Field([], description="Lista de unidades alternativas (cajas, bultos)")
    combo_items: List[ComboItemCreate] = Field([], description="Lista de componentes si es un combo")
    warehouse_stocks: List[ProductStockCreate] = Field([], description="Distribución de stock por almacén")

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    price: Optional[Decimal] = None
    price_mayor_1: Optional[Decimal] = None
    price_mayor_2: Optional[Decimal] = None
    stock: Optional[Decimal] = None
    description: Optional[str] = None
    cost_price: Optional[Decimal] = None
    min_stock: Optional[Decimal] = None
    is_box: Optional[bool] = None
    conversion_factor: Optional[Decimal] = None
    category_id: Optional[int] = None
    supplier_id: Optional[int] = None
    location: Optional[str] = None
    unit_type: Optional[str] = None
    exchange_rate_id: Optional[int] = None  # NEW: Allow updating exchange rate
    is_combo: Optional[bool] = None  # NEW: Allow updating combo status
    is_active: Optional[bool] = None
    # Pricing System Fields - Added for updates
    profit_margin: Optional[Decimal] = None
    discount_percentage: Optional[Decimal] = None
    is_discount_active: Optional[bool] = None
    tax_rate: Optional[Decimal] = None
    
    units: Optional[List[ProductUnitCreate]] = None
    combo_items: Optional[List[ComboItemCreate]] = None  # NEW: Allow updating combo items
    warehouse_stocks: Optional[List[ProductStockCreate]] = None  # NEW: Allow updating stocks per warehouse

    class Config:
        from_attributes = True

class PriceRuleCreate(BaseModel):
    product_id: int
    min_quantity: Decimal
    price: Decimal

class PriceRuleRead(BaseModel):
    id: int
    product_id: int
    min_quantity: Decimal
    price: Decimal

    class Config:
        from_attributes = True

class ProductRead(ProductBase):
    id: int
    price_rules: List[PriceRuleRead] = []
    units: List[ProductUnitRead] = []
    combo_items: List[ComboItemRead] = []  # NEW: Include combo items
    stocks: List[ProductStockRead] = [] # NEW: Include warehouse stocks
    
    class Config:
        from_attributes = True

class SaleDetailCreate(BaseModel):
    product_id: int
    quantity: Decimal
    unit_price: Decimal  # Renamed from unit_price_usd for consistency
    subtotal: Decimal    # Added: Essential for sync validation
    conversion_factor: Decimal = Decimal("1.0")
    discount: Decimal = Decimal("0.00")
    discount_type: str = "NONE"  # NONE, PERCENT, FIXED
    tax_rate: Decimal = Decimal("0.00")

    class Config:
        from_attributes = True

class SalePaymentCreate(BaseModel):
    sale_id: Optional[int] = None # Optional for inline creation
    amount: Decimal
    currency: str = "USD"
    payment_method: str = "Efectivo"
    exchange_rate: Decimal = Decimal("1.0")

    class Config:
        from_attributes = True

class SaleCreate(BaseModel):
    customer_id: Optional[int] = Field(None, description="ID del cliente (Opcional)", example=5)
    payment_method: str = Field("Efectivo", description="Método de pago principal", example="Efectivo")
    payments: List[SalePaymentCreate] = Field([], description="Lista de pagos desglosados (Multi-moneda)")
    items: List[SaleDetailCreate] = Field(..., description="Lista de productos a vender")
    total_amount: Decimal = Field(..., description="Monto total de la venta en USD", gt=0, example="150.50")
    currency: str = Field("USD", description="Moneda de referencia de la venta", example="USD")
    exchange_rate: Decimal = Field(Decimal("1.0"), description="Tasa de cambio aplicada", example="35.5")
    notes: Optional[str] = Field(None, description="Notas adicionales o observaciones", example="Entregar en puerta trasera")
    is_credit: bool = Field(False, description="Indica si es una venta a crédito")
    
    # Hybrid/Sync Fields (Optional, for offline sales)
    unique_uuid: Optional[str] = Field(None, description="UUID único generado offline")
    is_offline_sale: bool = Field(False, description="Flag si la venta vino de sync")
    warehouse_id: Optional[int] = Field(None, description="ID del almacén de salida") # NEW: Multi-warehouse support
    quote_id: Optional[int] = Field(None, description="ID de la cotización origen (si aplica)") # NEW: Quote Link

    class Config:
        from_attributes = True


class SalePaymentRead(BaseModel):
    id: int
    amount: Decimal
    currency: str
    payment_method: str
    exchange_rate: Decimal
    
    class Config:
        from_attributes = True

# NEW: Sale Detail Read Schema (for invoice detail view)
class SaleDetailRead(BaseModel):
    id: int
    product_id: int
    quantity: Decimal
    unit_price: Decimal
    subtotal: Decimal
    discount: Decimal = Decimal("0.00")
    discount_type: str = "NONE"
    tax_rate: Decimal = Decimal("0.00")
    product: Optional['ProductRead'] = None  # Include product info
    
    class Config:
        from_attributes = True

class SaleRead(BaseModel):
    id: int
    date: datetime
    total_amount: Decimal
    payment_method: str
    customer_id: Optional[int]
    customer: Optional['CustomerRead'] = None
    payments: List[SalePaymentRead] = []  # Include payments
    details: List[SaleDetailRead] = []  # NEW: Include sale items
    due_date: Optional[datetime] = None
    balance_pending: Optional[Decimal] = None
    is_credit: bool = False
    paid: bool = True
    currency: str = "USD"  # NEW: Include currency
    exchange_rate_used: Decimal = Decimal("1.0")  # NEW: Include exchange rate
    status: str = "COMPLETED" # Derived from property
    unique_uuid: Optional[str] = None
    is_offline_sale: bool = False
    
    class Config:
        from_attributes = True

class CustomerBase(BaseModel):
    name: str = Field(..., description="Nombre completo o Razón Social", example="Constructora Global S.A.")
    id_number: Optional[str] = Field(None, description="Cédula o RIF del cliente", example="J-12345678-9")
    phone: Optional[str] = Field(None, description="Teléfono de contacto principal", example="+58 412 5555555")
    email: Optional[str] = Field(None, description="Correo electrónico para facturación", example="compras@global.com")
    address: Optional[str] = Field(None, description="Dirección fiscal o de entrega", example="Av. Principal, Edif. Azul")
    credit_limit: Decimal = Field(Decimal("0.00"), description="Límite máximo de crédito permitido en USD", ge=0)
    payment_term_days: int = Field(15, description="Días de crédito otorgados", ge=0)
    unique_uuid: Optional[str] = Field(None, description="UUID único para sync")
    is_blocked: bool = Field(False, description="Bloqueo administrativo para impedir nuevas ventas")

class CustomerCreate(CustomerBase):
    pass

class CustomerPaymentCreate(BaseModel):
    amount: Decimal
    description: Optional[str] = None
    payment_method: str = "Efectivo"
    currency: str = "USD"
    exchange_rate: Decimal = Decimal("1.0")

class CustomerRead(CustomerBase):
    id: int
    
    class Config:
        from_attributes = True

class QuoteDetailCreate(BaseModel):
    product_id: int
    quantity: Decimal
    is_box: bool = False
    unit_price: Decimal 
    subtotal: Decimal

class QuoteCreate(BaseModel):
    customer_id: Optional[int] = None
    items: List[QuoteDetailCreate]
    total_amount: Decimal
    notes: Optional[str] = None

class QuoteDetailRead(BaseModel):
    id: int
    product_id: int
    quantity: Decimal
    unit_price: Decimal
    subtotal: Decimal
    is_box_sale: bool
    product: Optional[ProductRead] = None # Include product info for display

    class Config:
        from_attributes = True

class QuoteRead(BaseModel):
    id: int
    date: datetime
    customer_id: Optional[int]
    total_amount: Decimal
    status: str = "PENDING"
    notes: Optional[str]
    customer: Optional[CustomerRead] = None
    details: List[QuoteDetailRead] = [] # Include details for counts in list view

    class Config:
        from_attributes = True

class QuoteReadWithDetails(QuoteRead):
    details: List[QuoteDetailRead]
    notes: Optional[str]
    customer: Optional[CustomerRead] = None

    class Config:
        from_attributes = True


class CashMovementCreate(BaseModel):
    amount: Decimal
    type: str # IN, OUT
    currency: str = "USD"
    description: str
    session_id: Optional[int] = None

class CashMovementRead(CashMovementCreate):
    id: int
    date: datetime
    
    class Config:
        from_attributes = True

# Cash Session Schemas
class CashSessionCurrencyCreate(BaseModel):
    currency_symbol: str
    initial_amount: Decimal

class CashSessionCurrencyRead(BaseModel):
    id: int
    currency_symbol: str
    initial_amount: Decimal
    final_reported: Optional[Decimal] = None
    final_expected: Optional[Decimal] = None
    difference: Optional[Decimal] = None
    
    class Config:
        from_attributes = True

class CashSessionCreate(BaseModel):
    initial_cash: Decimal = Decimal("0.00")
    initial_cash_bs: Decimal = Decimal("0.00")
    currencies: List[CashSessionCurrencyCreate] = []

class CurrencyClose(BaseModel):
    currency_symbol: str
    final_reported: Decimal

class CashSessionClose(BaseModel):
    final_cash_reported: Decimal
    final_cash_reported_bs: Decimal
    currencies: List[CurrencyClose] = []  # List of currency amounts reported

class CashSessionRead(BaseModel):
    id: int
    start_time: datetime
    end_time: Optional[datetime]
    initial_cash: Decimal
    initial_cash_bs: Decimal
    final_cash_reported: Optional[Decimal]
    final_cash_reported_bs: Optional[Decimal]
    final_cash_expected: Optional[Decimal]
    status: str
    user: Optional['UserRead'] = None  # Include user details
    movements: List[CashMovementRead] = []
    currencies: List[CashSessionCurrencyRead] = []

    class Config:
        from_attributes = True

class CashCloseDetails(BaseModel):
    initial_usd: Decimal
    initial_bs: Decimal
    sales_total: Decimal
    sales_by_method: dict
    expenses_usd: Decimal
    expenses_bs: Decimal
    deposits_usd: Decimal
    deposits_bs: Decimal
    # New: per-currency breakdown
    cash_by_currency: Optional[Dict[str, Decimal]] = {}
    transfers_by_currency: Optional[Dict[str, Dict[str, Decimal]]] = {}  # {currency: {method: amount}}

class CashSessionCloseResponse(BaseModel):
    session: CashSessionRead
    details: CashCloseDetails
    expected_usd: Decimal
    expected_bs: Decimal
    diff_usd: Decimal
    diff_bs: Decimal
    # New: per-currency expected/diff
    expected_by_currency: Optional[Dict[str, Decimal]] = {}
    diff_by_currency: Optional[Dict[str, Decimal]] = {}
    total_sales_invoiced: Optional[Decimal] = None
    total_cash_collected: Optional[Decimal] = None


class ReturnItemCreate(BaseModel):
    product_id: int
    quantity: Decimal
    condition: ItemCondition = ItemCondition.GOOD  # Default to GOOD condition
    product: Optional[ProductRead] = None

    class Config:
        from_attributes = True

class ReturnCreate(BaseModel):
    sale_id: int 
    items: List[ReturnItemCreate]
    reason: Optional[str] = None
    refund_currency: str = "USD"
    exchange_rate: Decimal = Decimal("1.0")

class ReturnDetailRead(BaseModel):
    id: int
    product_id: int
    quantity: Decimal
    unit_price: Decimal
    product: Optional[ProductRead] = None

    class Config:
        from_attributes = True

class ReturnRead(BaseModel):
    id: int
    sale_id: int
    date: datetime
    total_refunded: Decimal
    reason: Optional[str]
    details: List[ReturnDetailRead] = []

    class Config:
        from_attributes = True



# User Management Schemas
class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "CASHIER"  # ADMIN, CASHIER, MANAGER
    full_name: Optional[str] = None

class UserUpdate(BaseModel):
    password: Optional[str] = None
    role: Optional[str] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = None

class UserRead(BaseModel):
    id: int
    username: str
    role: str
    full_name: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    username: str
    password: str

# Business Configuration Schemas
class BusinessConfigBase(BaseModel):
    key: str
    value: Optional[str] = None

class BusinessConfigRead(BusinessConfigBase):
    pass

class BusinessConfigCreate(BusinessConfigBase):
    pass

class BulkImportResult(BaseModel):
    success_count: int
    failed_count: int
    errors: List[str]

# Currency Schemas
class CurrencyBase(BaseModel):
    name: str
    symbol: str
    rate: Decimal
    is_anchor: bool = False
    is_active: bool = True

class CurrencyCreate(CurrencyBase):
    pass

class CurrencyUpdate(BaseModel):
    name: Optional[str] = None
    symbol: Optional[str] = None
    rate: Optional[Decimal] = None
    is_anchor: Optional[bool] = None
    is_active: Optional[bool] = None

class CurrencyRead(CurrencyBase):
    id: int

    class Config:
        from_attributes = True

# Inventory/Kardex Schemas
class StockAdjustmentCreate(BaseModel):
    product_id: int
    type: str  # ADJUSTMENT_IN, ADJUSTMENT_OUT, DAMAGED, INTERNAL_USE
    quantity: Decimal  # Already in base units
    reason: str
    warehouse_id: int # NEW: Required warehouse

class KardexRead(BaseModel):
    id: int
    product_id: int
    date: datetime
    movement_type: str
    quantity: Decimal
    balance_after: Decimal
    description: Optional[str] = None
    product: Optional['ProductRead'] = None
    
    class Config:
        from_attributes = True

# Category Schemas
class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    parent_id: Optional[int] = None

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[int] = None

class CategoryResponse(CategoryBase):
    id: int
    
    class Config:
        from_attributes = True

# Supplier Schemas

class SupplierBase(BaseModel):
    name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    payment_terms: Optional[int] = 30
    credit_limit: Optional[Decimal] = None

class SupplierCreate(SupplierBase):
    pass

class SupplierRead(SupplierBase):
    id: int
    is_active: Optional[bool] = True
    created_at: Optional[datetime] = None
    current_balance: Optional[Decimal] = Decimal("0.00")
    
    class Config:
        from_attributes = True

class ExchangeRateSync(BaseModel):
    id: int
    name: str # BCV, Paralelo
    currency_code: str # VES
    currency_symbol: str # Bs
    rate: Decimal
    is_default: bool
    is_active: bool
    updated_at: datetime

    class Config:
        from_attributes = True

# Purchase Order and Payment Schemas

class PurchaseOrderBase(BaseModel):
    supplier_id: int
    invoice_number: Optional[str] = None
    notes: Optional[str] = None

class PurchaseItemCreate(BaseModel):
    product_id: int
    quantity: Decimal
    unit_cost: Decimal
    update_cost: bool = False
    update_price: bool = False  # NEW: Update sale price?
    new_sale_price: Optional[Decimal] = None # NEW: The new sale price if update_price is True

class PurchaseOrderCreate(PurchaseOrderBase):
    total_amount: Decimal
    items: List[PurchaseItemCreate] = []
    payment_type: str = "CREDIT"  # CASH or CREDIT
    warehouse_id: int # NEW: Required warehouse

class PurchaseOrderUpdate(BaseModel):
    invoice_number: Optional[str] = None
    notes: Optional[str] = None

class PurchaseItemRead(BaseModel):
    id: int
    product_id: int
    quantity: Decimal
    unit_cost: Decimal
    product: Optional['ProductRead'] = None

    class Config:
        from_attributes = True

class PurchaseOrderResponse(PurchaseOrderBase):
    id: int
    purchase_date: datetime
    due_date: Optional[datetime] = None
    total_amount: Decimal
    paid_amount: Decimal
    payment_status: str
    supplier: Optional['SupplierRead'] = None
    items: List[PurchaseItemRead] = [] # Include items in response
    
    class Config:
        from_attributes = True

class PurchasePaymentCreate(BaseModel):
    amount: Decimal
    payment_method: str = "Efectivo"
    reference: Optional[str] = None
    notes: Optional[str] = None

class PurchasePaymentResponse(BaseModel):
    id: int
    purchase_id: int
    amount: Decimal
    payment_date: datetime
    payment_method: str
    reference: Optional[str] = None
    notes: Optional[str] = None
    
    class Config:
        from_attributes = True

class SupplierStatsResponse(BaseModel):
    supplier_id: int
    supplier_name: str
    current_balance: Decimal
    credit_limit: Optional[Decimal] = None
    pending_purchases: int
    total_purchases: int
    
    class Config:
        from_attributes = True

class BusinessInfo(BaseModel):
    name: Optional[str] = None
    document_id: Optional[str] = None # RIF/NIT/Etc
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    logo_url: Optional[str] = None # URL for displayed logo
    ticket_template: Optional[str] = None  # NEW: Jinja2 template for tickets

# ========================
# Audit Log Schemas
# ========================

class AuditLogBase(BaseModel):
    action: str
    table_name: str
    record_id: Optional[int] = None
    changes: Optional[str] = None
    timestamp: Optional[datetime] = None
    ip_address: Optional[str] = None

class AuditLogCreate(AuditLogBase):
    user_id: Optional[int] = None

class AuditLogRead(AuditLogBase):
    id: int
    user_id: Optional[int] = None
    user: Optional[UserRead] = None

    class Config:
        from_attributes = True

# ========================
# Remote Print Schemas
# ========================

class RemotePrintRequest(BaseModel):
    """Request body for remote printing via WebSocket"""
    client_id: str = Field(..., description="Hardware Bridge client ID", example="escritorio-caja-1")
    sale_id: int = Field(..., description="Sale ID to print", example=123)

# ========================
# Warehouse Schemas
# ========================

class WarehouseBase(BaseModel):
    name: str
    address: Optional[str] = None
    is_main: bool = False
    is_active: bool = True

class WarehouseCreate(WarehouseBase):
    pass

class WarehouseUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    is_main: Optional[bool] = None
    is_active: Optional[bool] = None



class WarehouseRead(WarehouseBase):
    id: int
    stocks_count: Optional[int] = 0 # To show how many products it has
    
    class Config:
        from_attributes = True

class WarehouseWithStocks(WarehouseRead):
    stocks: List[ProductStockRead] = []

# ========================
# Inventory Transfer Schemas
# ========================

class TransferDetailBase(BaseModel):
    product_id: int
    quantity: Decimal

class TransferDetailCreate(TransferDetailBase):
    pass

class TransferDetailRead(TransferDetailBase):
    id: int
    transfer_id: int
    product: Optional[ProductRead] = None
    
    class Config:
        from_attributes = True

class InventoryTransferBase(BaseModel):
    source_warehouse_id: int
    target_warehouse_id: int
    notes: Optional[str] = None
    date: datetime = Field(default_factory=datetime.now)

class InventoryTransferCreate(InventoryTransferBase):
    items: List[TransferDetailCreate]

class InventoryTransferRead(InventoryTransferBase):
    id: int
    status: str
    created_at: datetime
    source_warehouse: Optional[WarehouseRead] = None
    target_warehouse: Optional[WarehouseRead] = None
    details: List[TransferDetailRead] = []

    class Config:
        from_attributes = True



class WarehouseInventoryItem(BaseModel):
    product_id: int
    product_name: str
    sku: Optional[str] = None
    quantity: Decimal
    location: Optional[str] = None
    
    class Config:
        from_attributes = True
