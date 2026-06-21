from pydantic import BaseModel, Field, ConfigDict, condecimal, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
from decimal import Decimal

# Item Condition Enum for Returns
class ItemCondition(str, Enum):
    GOOD = "GOOD"
    DAMAGED = "DAMAGED"

class WarrantyUnit(str, Enum):
    DAYS = "DAYS"
    MONTHS = "MONTHS"
    YEARS = "YEARS"

class ProductBase(BaseModel):
    name: str = Field(..., description="Nombre comercial del producto", json_schema_extra={'example': "Taladro Percutor 500W"})
    sku: Optional[str] = Field(None, description="Código único de inventario (SKU)", json_schema_extra={'example': "TAL-001"})
    price: Decimal = Field(..., description="Precio de venta al público en USD", ge=0, json_schema_extra={'example': "45.99"})
    price_mayor_1: Optional[Decimal] = Field(Decimal("0.00"), description="Precio mayorista nivel 1", json_schema_extra={'example': "42.00"})
    price_mayor_2: Optional[Decimal] = Field(Decimal("0.00"), description="Precio mayorista nivel 2", json_schema_extra={'example': "40.00"})
    stock: Optional[Decimal] = Field(Decimal("0.000"), description="Cantidad actual en inventario físico", json_schema_extra={'example': "10.000"})
    description: Optional[str] = Field(None, description="Descripción detallada del producto", json_schema_extra={'example': "Incluye maletín y brocas"})
    cost_price: Optional[Decimal] = Field(Decimal("0.0000"), description="Costo de adquisición en USD", json_schema_extra={'example': "25.0000"})
    
    # Pricing System Fields
    profit_margin: Optional[Decimal] = Field(None, description="Margen de ganancia en porcentaje", json_schema_extra={'example': "30.00"})
    discount_percentage: Optional[Decimal] = Field(Decimal("0.00"), description="Descuento promocional en porcentaje", json_schema_extra={'example': "10.00"})
    is_discount_active: Optional[bool] = Field(False, description="Activar/desactivar descuento promocional")
    tax_rate: Optional[Decimal] = Field(Decimal("0.00"), description="Porcentaje de Impuesto (IVA)", json_schema_extra={'example': "16.00"})
    
    min_stock: Optional[Decimal] = Field(Decimal("5.000"), description="Nivel mínimo para alerta de reabastecimiento", json_schema_extra={'example': "5.000"})
    unit_type: Optional[str] = Field("Unidad", description="Unidad de medida base", json_schema_extra={'example': "Unidad"})
    is_box: Optional[bool] = Field(False, description="Indica si es vendido por caja (Legacy)")
    conversion_factor: Optional[Decimal] = Field(Decimal("1.0"), description="Factor de conversión", json_schema_extra={'example': "1.0"})
    category_id: Optional[int] = Field(None, description="ID de la categoría a la que pertenece", json_schema_extra={'example': 3})
    supplier_id: Optional[int] = Field(None, description="ID del proveedor principal", json_schema_extra={'example': 1})
    location: Optional[str] = Field(None, description="Ubicación física en almacén", json_schema_extra={'example': "Pasillo 4, Estante B"})
    exchange_rate_id: Optional[int] = Field(None, description="ID de tasa de cambio específica (opcional)", json_schema_extra={'example': 2})
    is_combo: Optional[bool] = Field(False, description="Indica si el producto es un combo/bundle")
    has_imei: bool = Field(False, description="Indica si el producto maneja seriales/IMEIs") # NEW
    is_service: Optional[bool] = Field(False, description="Indica si es un servicio (no requiere stock)") # NEW
    is_commissionable: bool = Field(False, description="Indica si genera comision al vendedor") # NEW
    is_barbershop_service: Optional[bool] = Field(False, description="Indica si es un servicio de barbería") # NEW
    is_menu_item: Optional[bool] = Field(False, description="Indica si es un item de menú de restaurante") # NEW
    needs_kitchen: bool = Field(True, description="False = servido directo por mesero sin pasar por KDS") # NEW
    is_active: Optional[bool] = True
    
    # Image Support
    image_url: Optional[str] = Field(None, description="URL relativa de la imagen del producto", json_schema_extra={'example': "/media/products/uuid-v4.webp"})
    image_url_original: Optional[str] = Field(None, description="Imagen ORIGINAL (antes de eliminar fondo); permite restaurar")
    
    @field_validator('image_url', mode='before')
    @classmethod
    def sanitize_image_url(cls, v):
        if not v:
            return v
        # Remove /qa/ and other prefixes to stay in /media/products/...
        # Matches patterns like /media/qa/products/ or /media/tenant-a/products/
        import re
        # Convert /media/(anything)/products/ to /media/products/
        return re.sub(r"/media/[^/]+/products/", "/media/products/", v)
    updated_at: Optional[datetime] = Field(None, description="Fecha de última actualización (auto-gestionada)")

    # Warranty Configuration
    warranty_duration: Optional[int] = Field(0, description="Duración de la garantía", json_schema_extra={'example': 30})
    warranty_unit: Optional[WarrantyUnit] = Field(WarrantyUnit.DAYS, description="Unidad de tiempo (DAYS/MONTHS/YEARS)", json_schema_extra={'example': "DAYS"})
    warranty_notes: Optional[str] = Field(None, description="Notas de garantía", json_schema_extra={'example': "Solo defectos de fábrica"})
    
    # New Warranty System (Policy Link)
    warranty_policy_id: Optional[int] = Field(None, description="ID de la política de garantía asignada")

# Exchange Rate Schemas
class ExchangeRateBase(BaseModel):
    name: str
    currency_code: str
    currency_symbol: str
    rate: Decimal
    is_default: bool = False
    is_active: bool = True
    auto_update_enabled: bool = False
    auto_update_source: str = 'manual'

class ExchangeRateCreate(ExchangeRateBase):
    pass

class ExchangeRateUpdate(BaseModel):
    name: Optional[str] = None
    rate: Optional[Decimal] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None
    auto_update_enabled: Optional[bool] = None
    auto_update_source: Optional[str] = None

class ExchangeRateRead(ExchangeRateBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)

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
    is_active: bool = True
    exchange_rate_id: Optional[int] = None  # NEW: Specific rate for this unit

class ProductUnitCreate(ProductUnitBase):
    pass

class ProductUnitRead(ProductUnitBase):
    id: int
    product_id: int
    exchange_rate: Optional[ExchangeRateRead] = None  # NEW: Include rate details

    model_config = ConfigDict(from_attributes=True)

# --- Quantity-Based Discount Rule Schemas (Feature 2) ---
class DiscountRuleBase(BaseModel):
    min_quantity: Decimal = Field(..., description="Cantidad mínima para activar el descuento", ge=0)
    discount_percentage: Decimal = Field(..., description="Porcentaje de descuento", ge=0, le=100)
    is_active: bool = Field(True)

class DiscountRuleCreate(DiscountRuleBase):
    product_id: int

class DiscountRuleUpdate(BaseModel):
    min_quantity: Optional[Decimal] = None
    discount_percentage: Optional[Decimal] = None
    is_active: Optional[bool] = None

class DiscountRuleRead(DiscountRuleBase):
    id: int
    product_id: int
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class ComboItemBase(BaseModel):
    child_product_id: int = Field(..., description="ID del producto componente", json_schema_extra={'example': 5})
    quantity: Decimal = Field(..., description="Cantidad del componente en el combo", gt=0, json_schema_extra={'example': "2.000"})
    unit_id: Optional[int] = Field(None, description="ID de la presentación específica (opcional)")  # NEW

class ComboItemCreate(ComboItemBase):
    pass

class ComboItemRead(ComboItemBase):
    id: int
    parent_product_id: int
    child_product: Optional['ProductRead'] = None  # Include child product details
    
    model_config = ConfigDict(from_attributes=True)

class ProductStockRead(BaseModel):
    id: int
    product_id: int
    warehouse_id: int
    quantity: Decimal
    location: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class ProductStockCreate(BaseModel):
    warehouse_id: int
    quantity: Decimal
    location: Optional[str] = None

# Combo/Bundle Schemas
# Combo/Bundle Schemas


# Combo/Bundle Schemas

class PriceRuleCreate(BaseModel):
    product_id: int
    min_quantity: Decimal
    price: Decimal

class PriceRuleRead(BaseModel):
    id: int
    product_id: int
    min_quantity: Decimal
    price: Decimal

    model_config = ConfigDict(from_attributes=True)

class PriceListBase(BaseModel):
    name: str = Field(..., description="Nombre de la lista (ej: Detal)", json_schema_extra={'example': "Detal"})
    requires_auth: bool = Field(False, description="Requiere PIN de supervisor")
    is_active: bool = True
    currency_code: str = Field("FLEX", description="Moneda asociada: FLEX, USD, VES, etc.")
    payment_policy: str = Field("flexible", description="Politica de cobro: flexible o strict")

class PriceListCreate(PriceListBase):
    pass

class PriceListRead(PriceListBase):
    id: int
    created_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)

def normalize_product_prices(value):
    if value in (None, ''):
        return [] if value == '' else value
    if isinstance(value, dict):
        normalized = []
        for list_id, price in value.items():
            if price in (None, ''):
                continue
            normalized.append({"price_list_id": list_id, "price": price})
        return normalized
    return value



class ProductImageBase(BaseModel):
    image_url: str
    color_name: Optional[str] = None
    color_hex: Optional[str] = None
    sort_order: Optional[int] = 0
    is_primary: bool = False

class ProductImageCreate(ProductImageBase):
    pass

class ProductImageRead(ProductImageBase):
    id: int
    product_id: int
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class ProductPriceBase(BaseModel):
    price_list_id: int
    price: Decimal = Field(..., description="Precio en la lista", ge=0, json_schema_extra={'example': "10.5000"})

class ProductPriceInput(ProductPriceBase):
    """Schema for input when creating/updating product (nested)"""
    pass

class ProductPriceCreate(ProductPriceBase):
    product_id: int

class ProductPriceRead(ProductPriceBase):
    id: int
    product_id: int
    price_list: Optional[PriceListRead] = None  # Include list details if needed

    model_config = ConfigDict(from_attributes=True)

class CatalogProductRead(ProductBase):
    id: int
    units: List[ProductUnitRead] = []
    prices: List[ProductPriceRead] = []

    model_config = ConfigDict(from_attributes=True)


class ProductCreate(ProductBase):
    units: List[ProductUnitCreate] = Field([], description="Lista de unidades alternativas (cajas, bultos)")
    combo_items: List[ComboItemCreate] = Field([], description="Lista de componentes si es un combo")
    warehouse_stocks: List[ProductStockCreate] = Field([], description="Distribución de stock por almacén")
    prices: List[ProductPriceInput] = Field([], description="Precios por lista (Mayorista, VIP, etc)") # NEW
    gallery_images: List[ProductImageCreate] = Field([], description="Galeria de imagenes del producto")

    @field_validator('prices', mode='before')
    @classmethod
    def normalize_prices(cls, value):
        return normalize_product_prices(value)

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    image_url: Optional[str] = None
    image_url_original: Optional[str] = None
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
    has_imei: Optional[bool] = None # NEW: Allow updating serialized status
    is_service: Optional[bool] = None # NEW: Allow updating service status
    is_commissionable: Optional[bool] = None # NEW: Commission flag
    is_barbershop_service: Optional[bool] = None # NEW
    is_menu_item: Optional[bool] = None # NEW
    needs_kitchen: Optional[bool] = None # NEW: False = servido directo por mesero sin pasar por KDS
    is_active: Optional[bool] = None
    # Pricing System Fields - Added for updates
    profit_margin: Optional[Decimal] = None
    discount_percentage: Optional[Decimal] = None
    is_discount_active: Optional[bool] = None
    tax_rate: Optional[Decimal] = None
    
    units: Optional[List[ProductUnitCreate]] = None
    combo_items: Optional[List[ComboItemCreate]] = None  # NEW: Allow updating combo items
    warehouse_stocks: Optional[List[ProductStockCreate]] = None  # NEW: Allow updating stocks per warehouse
    prices: Optional[List[ProductPriceInput]] = None # NEW
    gallery_images: Optional[List[ProductImageCreate]] = None

    @field_validator('prices', mode='before')
    @classmethod
    def normalize_prices(cls, value):
        return normalize_product_prices(value)
    
    # Warranty Updates
    warranty_duration: Optional[int] = None
    warranty_unit: Optional[str] = None
    warranty_notes: Optional[str] = None
    warranty_policy_id: Optional[int] = None  # FIX: was missing → policy never saved on edit
    image_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class ProductRead(ProductBase):
    id: int
    category: Optional['CategoryResponse'] = None  # Include category relationship
    price_rules: List[PriceRuleRead] = []
    units: List[ProductUnitRead] = []
    combo_items: List[ComboItemRead] = []  # NEW: Include combo items
    stocks: List[ProductStockRead] = [] # NEW: Include warehouse stocks
    instances: List['ProductInstanceRead'] = []
    has_imei: Optional[bool] = False # NEW: Include serialized status exposed to frontend
    is_commissionable: Optional[bool] = False # NEW: Commission flag
    prices: List[ProductPriceRead] = [] # NEW: Multi-Price List
    gallery_images: List[ProductImageRead] = []
    discount_rules: List[DiscountRuleRead] = []  # Feature 2: Quantity-based rules
    
    model_config = ConfigDict(from_attributes=True)

class PaginatedCatalog(BaseModel):
    items: List[CatalogProductRead]
    total: int
    has_more: bool

class PaginatedProductList(BaseModel):
    """Respuesta paginada para GET /products/ — incluye total para paginación correcta"""
    items: List[ProductRead]
    total: int
    has_more: bool

class SaleDetailCreate(BaseModel):
    product_id: int
    quantity: Decimal
    unit_price: Decimal  # Renamed from unit_price_usd for consistency
    subtotal: Decimal    # Added: Essential for sync validation
    conversion_factor: Decimal = Decimal("1.0")
    unit_id: Optional[int] = None  # NEW: Which presentation/unit was sold
    discount: Decimal = Decimal("0.00")
    discount_type: str = "NONE"  # NONE, PERCENT, FIXED
    tax_rate: Decimal = Decimal("0.00")
    salesperson_id: Optional[int] = None # NEW: Granular commission support
    employee_id: Optional[int] = None # NEW: Barbershop Service Commission Target
    serial_numbers: Optional[List[str]] = Field(None, description="Lista de seriales para productos serializados") # NEW
    combo_serials: Optional[dict] = Field(None, description="Dict {child_product_id: [serials]} para componentes serializados de un combo") # NEW
    price_list_id: Optional[int] = None # NEW: Price List Validation
    auth_user_id: Optional[int] = None # NEW: Supervisor Auth for Price List
    recipe_factor: Decimal = Decimal("1.0")
    modifier_option_ids: Optional[List[int]] = [] # NEW: IDs of selected modifier options
    skip_stock_deduction: bool = False # New: avoid double deduction in restaurant flow

    model_config = ConfigDict(from_attributes=True)

class SalePaymentCreate(BaseModel):
    sale_id: Optional[int] = None # Optional for inline creation
    amount: Decimal
    currency: str = "USD"
    payment_method: str = "Efectivo"
    exchange_rate: Optional[Decimal] = None  # None = not provided by client (skip strict validation)
    # NEW: Mobile/Laundry Support
    reference: Optional[str] = None
    payment_date: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class SaleCreate(BaseModel):
    customer_id: Optional[int] = Field(None, description="ID del cliente (Opcional)", json_schema_extra={'example': 5})
    payment_method: str = Field("Efectivo", description="Método de pago principal", json_schema_extra={'example': "Efectivo"})
    payments: List[SalePaymentCreate] = Field([], description="Lista de pagos desglosados (Multi-moneda)")
    items: List[SaleDetailCreate] = Field(..., description="Lista de productos a vender")
    total_amount: Decimal = Field(..., description="Monto total de la venta en USD", gt=0, json_schema_extra={'example': "150.50"})
    # NEW: Multi-currency Source of Truth
    total_amount_bs: Decimal = Field(..., description="Monto total en VES calculado por Frontend (respetando anclajes)", ge=0)
    
    # Cart Global Discount
    total_discount_usd: Optional[Decimal] = Field(Decimal("0.00"), description="Monto total descontado en USD para todo el carrito")
    cart_discount_type: Optional[str] = Field(None, description="Tipo de descuento global aplicado (percent, fixed, fixed_bs, target)")
    discount_auth_user_id: Optional[int] = Field(None, description="ID del administrador que autorizó el descuento")
    
    change_amount: Decimal = Field(Decimal("0.00"), description="Monto del vuelto entregado", ge=0)
    change_currency: str = Field("VES", description="Moneda del vuelto (VES/USD)")
    
    currency: str = Field("USD", description="Moneda de referencia de la venta", json_schema_extra={'example': "USD"})
    exchange_rate: Decimal = Field(Decimal("1.0"), description="Tasa de cambio global (Referencia)", json_schema_extra={'example': "35.5"})
    notes: Optional[str] = Field(None, description="Notas adicionales o observaciones", json_schema_extra={'example': "Entregar en puerta trasera"})
    is_credit: bool = Field(False, description="Indica si es una venta a crédito")

    # Datos del crédito (de la CalculadoraCredito — modelo plano)
    credit_down_payment      : Optional[Decimal] = Field(None, description="Enganche pagado por el cliente")
    credit_installments      : Optional[int]     = Field(None, description="Número de cuotas pactadas")
    credit_interest_rate     : Optional[Decimal] = Field(None, description="Tasa de interés % sobre el precio")
    credit_frequency         : Optional[str]     = Field(None, description="Frecuencia: semanal/quincenal/mensual")
    credit_installment_amount: Optional[Decimal] = Field(None, description="Monto de cada cuota calculado")
    
    # Hybrid/Sync Fields (Optional, for offline sales)
    unique_uuid: Optional[str] = Field(None, description="UUID único generado offline")
    is_offline_sale: bool = Field(False, description="Flag si la venta vino de sync")
    warehouse_id: Optional[int] = Field(None, description="ID del almacén de salida") # NEW: Multi-warehouse support
    quote_id: Optional[int] = Field(None, description="ID de la cotización origen (si aplica)") # NEW: Quote Link
    session_id: Optional[int] = Field(None, description="ID de la sesión de caja activa (multi-caja)")

    model_config = ConfigDict(from_attributes=True)

class ServiceCheckoutPayment(BaseModel):
    """
    Schema specialized for Service Checkout.
    Omits 'items' because they are derived from the Service Order itself,
    avoiding validation errors with mock/string IDs from Frontend.
    """
    customer_id: Optional[int] = Field(None, description="ID del cliente override")
    payment_method: str = Field("Efectivo", description="Método de pago principal")
    payments: List[SalePaymentCreate] = Field([], description="Lista de pagos")
    total_amount: Decimal = Field(..., description="Monto total a pagar")
    total_amount_bs: Decimal = Field(..., description="Monto en Bs")
    change_amount: Decimal = Decimal("0.00")
    change_currency: str = "VES"
    
    currency: str = "USD"
    exchange_rate: Decimal = Decimal("1.0")
    notes: Optional[str] = None
    is_credit: bool = False
    
    warehouse_id: Optional[int] = None 
    unique_uuid: Optional[str] = None # Support idempotency if needed
    
    # Cart Global Discount (Optional for Service, but needed to match frontend payload structure)
    total_discount_usd: Optional[Decimal] = Decimal("0.00")
    cart_discount_type: Optional[str] = None
    discount_auth_user_id: Optional[int] = None
    recipe_factor: Decimal = Decimal("1.0")
    
    # NEW
    reference: Optional[str] = None
    payment_date: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class SalePaymentRead(BaseModel):
    id: int
    amount: Decimal
    currency: str
    payment_method: str
    exchange_rate: Decimal
    reference: Optional[str] = None
    payment_date: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)

# NEW: Product Instance Schema
class ProductInstanceRead(BaseModel):
    id: int
    product_id: int
    warehouse_id: int
    serial_number: str
    color_name: Optional[str] = None
    color_hex: Optional[str] = None
    status: str

    model_config = ConfigDict(from_attributes=True)

# NEW: Sale Detail Instance Schema
class SaleDetailInstanceRead(BaseModel):
    id: int
    sale_detail_id: int
    product_instance_id: int
    product_instance: Optional[ProductInstanceRead] = None
    warranty_expiration_date: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

# NEW: Sale Detail Read Schema (for invoice detail view)
class SaleDetailRead(BaseModel):
    id: int
    product_id: int
    quantity: Decimal
    unit_price: Decimal
    subtotal: Decimal = Decimal("0.00")
    discount: Decimal = Decimal("0.00")
    discount_type: str = "NONE"
    tax_rate: Decimal = Decimal("0.00")
    description: Optional[str] = None # NEW: Manual description
    unit_id: Optional[int] = None  # NEW: Which presentation was sold
    product: Optional['ProductRead'] = None  # Include product info
    unit: Optional['ProductUnitRead'] = None  # NEW: Include unit/presentation info
    instances: List[SaleDetailInstanceRead] = [] # NEW: Serialized items
    
    # Warranty Snapshot
    warranty_expiration_date: Optional[datetime] = None

    @field_validator('subtotal', 'discount', 'tax_rate', mode='before')
    @classmethod
    def validate_decimals(cls, v):
        if v is None:
            return Decimal("0.00")
        return v
    
    model_config = ConfigDict(from_attributes=True)

class SaleRead(BaseModel):
    id: int
    date: datetime
    total_amount: Decimal
    total_amount_bs: Decimal = Decimal("0.00")
    
    total_discount_usd: Decimal = Decimal("0.00")
    cart_discount_type: Optional[str] = None
    discount_auth_user_id: Optional[int] = None
    recipe_factor: Decimal = Decimal("1.0")
    
    change_amount: Decimal = Decimal("0.00")
    change_currency: str = "VES"
    
    payment_method: str
    customer_id: Optional[int]
    customer: Optional['CustomerRead'] = None
    payments: List[SalePaymentRead] = []  # Include payments
    details: List[SaleDetailRead] = []  # NEW: Include sale items
    due_date: Optional[datetime] = None
    balance_pending: Optional[Decimal] = None
    is_credit: bool = False
    paid: bool = True
    credit_down_payment      : Optional[Decimal] = None
    credit_installments      : Optional[int]     = None
    credit_interest_rate     : Optional[Decimal] = None
    credit_frequency         : Optional[str]     = None
    credit_installment_amount: Optional[Decimal] = None
    bloqueo_sincronizado      : Optional[bool]   = None
    bloqueo_codigo_activacion : Optional[str]    = None
    bloqueo_estado            : Optional[str]    = None
    bloqueo_cliente_id        : Optional[int]    = None
    bloqueo_dispositivo_id    : Optional[int]    = None
    currency: str = "USD"  # NEW: Include currency
    exchange_rate_used: Decimal = Decimal("1.0")  # NEW: Include exchange rate
    status: str = "COMPLETED" # Derived from property
    unique_uuid: Optional[str] = None
    is_offline_sale: bool = False

    @field_validator('total_amount_bs', 'change_amount', 'total_discount_usd', mode='before')
    @classmethod
    def validate_decimals(cls, v):
        if v is None:
            return Decimal("0.00")
        return v

    @field_validator('change_currency', mode='before')
    @classmethod
    def validate_currency(cls, v):
        if v is None:
            return "VES"
        return v

    @field_validator('is_offline_sale', mode='before')
    @classmethod
    def validate_offline_flag(cls, v):
        if v is None:
            return False
        return v
    
    model_config = ConfigDict(from_attributes=True)

class CustomerBase(BaseModel):
    name: str = Field(..., description="Nombre completo o Razón Social", json_schema_extra={'example': "Constructora Global S.A."})
    id_number: Optional[str] = Field(None, description="Cédula o RIF del cliente", json_schema_extra={'example': "J-12345678-9"})
    phone: Optional[str] = Field(None, description="Teléfono de contacto principal", json_schema_extra={'example': "+58 412 5555555"})
    email: Optional[str] = Field(None, description="Correo electrónico para facturación", json_schema_extra={'example': "compras@global.com"})
    address: Optional[str] = Field(None, description="Dirección fiscal o de entrega", json_schema_extra={'example': "Av. Principal, Edif. Azul"})
    credit_limit: Decimal = Field(Decimal("500.00"), description="Límite máximo de crédito permitido en USD", ge=0)
    payment_term_days: Optional[int] = Field(15, description="Días de crédito otorgados", ge=0)
    unique_uuid: Optional[str] = Field(None, description="UUID único para sync")
    is_blocked: Optional[bool] = Field(False, description="Bloqueo administrativo para impedir nuevas ventas")
    is_active: bool = Field(True, description="Estado activo del cliente (False = eliminado lógicamente)")



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
    
    model_config = ConfigDict(from_attributes=True)

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

    model_config = ConfigDict(from_attributes=True)

class QuoteCreatorInfo(BaseModel):
    id: int
    username: str
    full_name: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class QuoteRead(BaseModel):
    id: int
    date: datetime
    customer_id: Optional[int]
    user_id: Optional[int] = None
    total_amount: Decimal
    status: str = "PENDING"
    notes: Optional[str]
    valid_until: Optional[datetime] = None
    customer: Optional[CustomerRead] = None
    user: Optional[QuoteCreatorInfo] = None
    details: List[QuoteDetailRead] = []

    model_config = ConfigDict(from_attributes=True)

class QuoteReadWithDetails(QuoteRead):
    details: List[QuoteDetailRead]
    notes: Optional[str]
    customer: Optional[CustomerRead] = None

    model_config = ConfigDict(from_attributes=True)


class CashMovementCreate(BaseModel):
    amount: Decimal
    type: str # IN, OUT, CASH_ADVANCE
    currency: str = "USD"
    description: str
    session_id: Optional[int] = None
    
    # Dual Transaction Fields (Optional)
    incoming_amount: Optional[Decimal] = None
    incoming_currency: Optional[str] = None
    incoming_method: Optional[str] = None
    incoming_reference: Optional[str] = None

    @field_validator('description')
    @classmethod
    def validate_description_content(cls, v, info):
        if info.data.get('type') == 'CASH_ADVANCE':
            if not v or len(v.strip()) < 5:
                raise ValueError('Para Avances de Efectivo, la descripción debe detallar la referencia o destino (min 5 chars)')
        return v

class CashMovementRead(CashMovementCreate):
    id: int
    date: datetime
    
    model_config = ConfigDict(from_attributes=True)

# ===== CASH REGISTER SCHEMAS =====

class CashRegisterCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    hardware_client_id: Optional[str] = None

class CashRegisterUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    hardware_client_id: Optional[str] = None

class CashRegisterRead(BaseModel):
    id: int
    name: str
    code: str
    description: Optional[str] = None
    is_active: bool
    created_at: Optional[datetime] = None
    hardware_client_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

# ===== CASH SESSION SCHEMAS =====
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
    
    model_config = ConfigDict(from_attributes=True)

class CashSessionCreate(BaseModel):
    initial_cash: Decimal = Decimal("0.00")
    initial_cash_bs: Decimal = Decimal("0.00")
    currencies: List[CashSessionCurrencyCreate] = []
    register_id: Optional[int] = None  # Which cash register to open. Uses default if omitted.

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
    user_id: Optional[int] = None      # Who opened this session
    register_id: Optional[int] = None
    register: Optional[CashRegisterRead] = None
    # NOTE: 'user' removed — forward-ref to UserRead caused 500 on ORM serialization.
    # Use user_id + a separate query if needed.
    movements: List[CashMovementRead] = []
    currencies: List[CashSessionCurrencyRead] = []

    model_config = ConfigDict(from_attributes=True)

class CashCloseDetails(BaseModel):
    initial_usd: Decimal
    initial_bs: Decimal
    sales_total: Decimal
    sales_by_method: dict
    expenses_usd: Decimal
    expenses_bs: Decimal
    deposits_usd: Decimal
    deposits_bs: Decimal
    cash_advances_usd: Optional[Decimal] = Decimal("0.00") # NEW
    cash_advances_bs: Optional[Decimal] = Decimal("0.00") # NEW
    returns_usd: Optional[Decimal] = Decimal("0.00")
    returns_bs: Optional[Decimal] = Decimal("0.00")
    credit_pending: Optional[Decimal] = Decimal("0.00")
    credit_count: Optional[int] = 0
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
    # Fix 4: lista explicita de IMEIs/serials devueltos. Si esta vacia,
    # el backend usa la logica legacy (item.quantity + .limit()).
    # Si viene con seriales, se trackean explicitamente en
    # return_detail_instances y se marca el SaleDetailInstance como RETURNED.
    serial_numbers: List[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

class ReturnCreate(BaseModel):
    sale_id: int 
    items: List[ReturnItemCreate]
    reason: Optional[str] = None
    refund_currency: str = "USD"
    exchange_rate: Decimal = Decimal("1.0")
    resolution_type: str = Field("REFUND", description="REFUND o EXCHANGE")
    exchange_credit_amount: Decimal = Field(Decimal("0.00"), ge=0, description="Monto USD aplicado como credito de canje")

class ReturnExchangeCreate(ReturnCreate):
    replacement_sale: SaleCreate

class ReturnDetailRead(BaseModel):
    id: int
    product_id: int
    quantity: Decimal
    unit_price: Decimal
    product: Optional[ProductRead] = None

    model_config = ConfigDict(from_attributes=True)

class ReturnRead(BaseModel):
    id: int
    sale_id: int
    date: datetime
    total_refunded: Decimal
    reason: Optional[str]
    details: List[ReturnDetailRead] = []

    model_config = ConfigDict(from_attributes=True)


class ReturnExchangeRead(BaseModel):
    return_record: ReturnRead
    replacement_sale_id: int
    exchange_credit_amount: Decimal
    difference_due: Decimal
    cash_refund_amount: Decimal

    model_config = ConfigDict(from_attributes=True)



# User Management Schemas
class UserCreate(BaseModel):
    username: str
    password: str
    email: str # Required for login
    role: str = "CASHIER"  # ADMIN, CASHIER, MANAGER
    full_name: Optional[str] = None
    commission_percentage: Optional[Decimal] = Decimal("0.00")
    preferences: Optional[Dict[str, Any]] = {} # NEW


class UserUpdate(BaseModel):
    password: Optional[str] = None
    email: Optional[str] = None # NEW: Allow email update
    role: Optional[str] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = None
    commission_percentage: Optional[Decimal] = None
    preferences: Optional[Dict[str, Any]] = None # NEW


class UserRead(BaseModel):
    id: int
    username: str
    role: str
    full_name: Optional[str]
    is_active: bool
    created_at: Optional[datetime]
    commission_percentage: Optional[Decimal] = Decimal("0.00")
    commission_vendor_pct: Optional[Decimal] = Decimal("0.00")        # v2 comisiones
    commission_technician_pct: Optional[Decimal] = Decimal("0.00")    # v2 comisiones
    preferences: Optional[Dict[str, Any]] = {}
    is_onboarding_completed: Optional[bool] = False   # Optional — tolera NULL en BD
    tenant_id: Optional[int] = None
    is_superuser: Optional[bool] = False
    org_role: Optional[str] = None
    is_org_owner: Optional[bool] = False

    model_config = ConfigDict(from_attributes=True)

class UserLogin(BaseModel):
    username: str
    password: str

class DiscoveryRequest(BaseModel):
    email: str

class DiscoveryResponse(BaseModel):
    redirect_url: str
    tenant_id: str
    tenant_name: Optional[str] = None

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

class SerializedEntry(BaseModel):
    product_id: int
    warehouse_id: int
    imeis: List[str]
    cost: Optional[Decimal] = Decimal("0.0000")
    color_name: Optional[str] = None
    color_hex: Optional[str] = None

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

    model_config = ConfigDict(from_attributes=True)

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
    
    model_config = ConfigDict(from_attributes=True)

# Category Schemas
class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    parent_id: Optional[int] = None
    is_no_kitchen_category: Optional[bool] = False

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[int] = None
    is_no_kitchen_category: Optional[bool] = None

class CategoryResponse(CategoryBase):
    id: int
    
    model_config = ConfigDict(from_attributes=True)

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
    
    model_config = ConfigDict(from_attributes=True)

class ExchangeRateSync(BaseModel):
    id: int
    name: str # BCV, Paralelo
    currency_code: str # VES
    currency_symbol: str # Bs
    rate: Decimal
    is_default: bool
    is_active: bool
    auto_update_enabled: bool = False
    auto_update_source: str = 'manual'
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Purchase Order and Payment Schemas

class PurchaseOrderBase(BaseModel):
    supplier_id: int
    invoice_number: Optional[str] = None
    notes: Optional[str] = None

class QuickProductCreate(BaseModel):
    """Producto rápido creado al vuelo desde el módulo de compras."""
    name: str
    sku: Optional[str] = None
    cost_price: Decimal             # precio de costo inicial
    sale_price: Optional[Decimal] = None  # precio de venta sugerido
    category_id: Optional[int] = None
    has_imei: bool = False  # crear como producto serializado/IMEI desde compras

class PurchaseItemCreate(BaseModel):
    product_id: Optional[int] = None      # None si se crea producto nuevo
    quick_product: Optional[QuickProductCreate] = None  # producto nuevo al vuelo
    quantity: Decimal
    unit_cost: Decimal
    discount_pct: Optional[Decimal] = Decimal("0")      # % descuento por ítem
    discount_amount: Optional[Decimal] = Decimal("0")   # monto descuento por ítem
    update_cost: bool = False
    update_price: bool = False
    new_sale_price: Optional[Decimal] = None
    serial_numbers: List[str] = Field(default_factory=list)  # IMEIs/seriales recibidos para productos serializados
    color_name: Optional[str] = None
    color_hex: Optional[str] = None
    is_combo: bool = False
    is_service: bool = False
    is_barbershop_service: bool = False
    is_menu_item: bool = False

class PurchaseOrderCreate(PurchaseOrderBase):
    total_amount: Decimal
    items: List[PurchaseItemCreate] = []
    payment_type: str = "CREDIT"  # CASH or CREDIT
    warehouse_id: int
    purchase_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    # Descuentos del proveedor
    discount_amount: Optional[Decimal] = Decimal("0")   # descuento global en monto
    discount_type: Optional[str] = "NONE"               # NONE / PERCENT / FIXED
    discount_notes: Optional[str] = None                # ej: "descuento pronto pago"

class PurchaseOrderUpdate(BaseModel):
    invoice_number: Optional[str] = None
    notes: Optional[str] = None

class PurchaseProductBasic(BaseModel):
    """Minimal product info for purchase orders — avoids lazy-loading category/price_rules."""
    id: int
    name: str
    sku: Optional[str] = None
    unit: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class PurchaseItemRead(BaseModel):
    id: int
    product_id: int
    quantity: Decimal
    unit_cost: Decimal
    discount_pct: Optional[Decimal] = Decimal("0")
    discount_amount: Optional[Decimal] = Decimal("0")
    subtotal: Optional[Decimal] = None
    serial_numbers: Optional[str] = None
    product: Optional[PurchaseProductBasic] = None

    model_config = ConfigDict(from_attributes=True)

class PurchaseOrderResponse(PurchaseOrderBase):
    id: int
    purchase_date: datetime
    due_date: Optional[datetime] = None
    warehouse_id: Optional[int] = None
    warehouse: Optional['WarehouseRead'] = None  # Nested warehouse object for display
    total_amount: Decimal
    paid_amount: Decimal
    payment_status: str
    supplier: Optional['SupplierRead'] = None
    items: List[PurchaseItemRead] = [] # Include items in response

    model_config = ConfigDict(from_attributes=True)

class PurchasePaymentCreate(BaseModel):
    amount: Decimal
    payment_method: str = "Efectivo"
    reference: Optional[str] = None
    notes: Optional[str] = None
    currency: Optional[str] = "USD"
    exchange_rate: Optional[float] = 1.0

class PurchasePaymentResponse(BaseModel):
    id: int
    purchase_id: int
    amount: Decimal
    payment_date: datetime
    payment_method: str
    reference: Optional[str] = None
    notes: Optional[str] = None
    currency: Optional[str] = "USD"
    exchange_rate: Optional[float] = 1.0
    
    model_config = ConfigDict(from_attributes=True)

class SupplierStatsResponse(BaseModel):
    supplier_id: int
    supplier_name: str
    current_balance: Decimal
    credit_limit: Optional[Decimal] = None
    pending_purchases: int
    total_purchases: int
    
    model_config = ConfigDict(from_attributes=True)

class BusinessInfo(BaseModel):
    name: Optional[str] = None
    document_id: Optional[str] = None # RIF/NIT/Etc
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    logo_url: Optional[str] = None # URL for displayed logo
    ticket_template: Optional[str] = None  # NEW: Jinja2 template for tickets
    default_tax_rate: Optional[Decimal] = Decimal("0.00")
    warranty_format_url: Optional[str] = None
    external_financing_enabled: Optional[bool] = None
    # Credit Defaults
    credit_default_down_payment_pct: Optional[Decimal] = Decimal("20.00")
    credit_default_interest_rate: Optional[Decimal] = Decimal("10.00")

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

    model_config = ConfigDict(from_attributes=True)

# ========================
# Remote Print Schemas
# ========================

class RemotePrintRequest(BaseModel):
    """Request body for remote printing via WebSocket"""
    sale_id: int = Field(..., description="Sale ID to print", json_schema_extra={'example': 123})
    client_id: Optional[str] = Field(None, description="Hardware Bridge client ID for the current station", json_schema_extra={'example': "escritorio-caja-1"})
    register_id: Optional[int] = Field(None, description="Cash register selected for this station")
    prefer_sale_register: bool = Field(False, description="Route to the cash register that created the sale")

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
    
    model_config = ConfigDict(from_attributes=True)

class WarehouseWithStocks(WarehouseRead):
    stocks: List[ProductStockRead] = []

# ========================
# Inventory Transfer Schemas
# ========================

class TransferDetailInstanceCreate(BaseModel):
    """IMEI/serial especifico que se traslada en esta linea."""
    product_instance_id: int

class TransferDetailInstanceRead(BaseModel):
    id: int
    product_instance_id: int
    serial_number: Optional[str] = None  # populated from product_instance for convenience

    model_config = ConfigDict(from_attributes=True)

class TransferDetailBase(BaseModel):
    product_id: int
    quantity: Decimal

class TransferDetailCreate(TransferDetailBase):
    instances: List["TransferDetailInstanceCreate"] = Field(
        [], description="IMEIs/seriales especificos a trasladar (solo si el producto tiene has_imei=true y el feature flag esta ON)"
    )

class TransferDetailRead(TransferDetailBase):
    id: int
    transfer_id: int
    product: Optional[ProductRead] = None
    instances: List[TransferDetailInstanceRead] = Field([], description="IMEIs/seriales que se trasladaron")

    model_config = ConfigDict(from_attributes=True)

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

    model_config = ConfigDict(from_attributes=True)



class WarehouseInventoryItem(BaseModel):
    product_id: int
    product_name: str
    sku: Optional[str] = None
    quantity: Decimal
    location: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

# --- INTER-COMPANY TRANSFER SCHEMAS ---
class TransferItemSchema(BaseModel):
    sku: str
    quantity: float
    name: str
    has_imei: bool = False
    serial_numbers: List[str] = []

class TransferPackageSchema(BaseModel):
    package_id: Optional[str] = None
    source_company: str
    generated_at: datetime
    items: List[TransferItemSchema]
    source_schema: Optional[str] = None
    source_business_name: Optional[str] = None
    generated_at_friendly: Optional[str] = None
    items_count: Optional[int] = None
    models_count: Optional[int] = None
    units_count: Optional[float] = None
    imei_count: Optional[int] = None
    photos_count: Optional[int] = None
    source_warehouse_id: Optional[int] = None
    source_warehouse_name: Optional[str] = None
    photo_urls: Optional[List[str]] = None

class TransferResultSchema(BaseModel):
    success_count: int
    failure_count: int
    errors: List[str]

class TransferPreviewItemResult(BaseModel):
    sku: str
    name: str
    quantity: float
    has_imei: bool = False
    serial_numbers: List[str] = []
    match_type: str  # exact, fuzzy, name, none
    matched_product_id: Optional[int] = None
    matched_sku: Optional[str] = None
    matched_name: Optional[str] = None
    matched_stock: Optional[float] = None

class TransferPreviewResult(BaseModel):
    package_id: Optional[str] = None
    source_company: str
    items: List[TransferPreviewItemResult]
    photo_urls: Optional[List[str]] = None
    source_schema: Optional[str] = None
    source_warehouse_id: Optional[int] = None
    source_warehouse_name: Optional[str] = None
    items_count: Optional[int] = None
    models_count: Optional[int] = None
    units_count: Optional[float] = None
    imei_count: Optional[int] = None
    photos_count: Optional[int] = None

class TransferImportV2Item(BaseModel):
    sku: str
    name: str
    quantity: float
    has_imei: bool = False
    serial_numbers: List[str] = []
    target_product_id: Optional[int] = None
    create_new: bool = False
    warehouse_id: Optional[int] = None

class TransferImportV2Request(BaseModel):
    package_id: Optional[str] = None
    source_company: str
    warehouse_id: Optional[int] = None
    items: List[TransferImportV2Item]
    source_schema: Optional[str] = None

# ========================
# SERVICE MODULE SCHEMAS
# ========================

class ServiceOrderDetailBase(BaseModel):
    product_id: Optional[int] = None
    description: Optional[str] = None # New for manual items
    observations: Optional[str] = None # Special notes/instructions
    quantity: Decimal = Decimal("1.000")
    unit_price: Decimal
    technician_id: Optional[int] = None

class ServiceOrderDetailCreate(ServiceOrderDetailBase):
    pass

class ServiceOrderDetailRead(ServiceOrderDetailBase):
    id: int
    service_order_id: int
    cost: Decimal
    is_manual: bool = False
    observations: Optional[str] = None
    created_at: datetime
    
    product: Optional[ProductRead] = None
    technician: Optional[UserRead] = None

    model_config = ConfigDict(from_attributes=True)

class ServiceType(str, Enum):
    REPAIR = "REPAIR"
    LAUNDRY = "LAUNDRY"

class ServicePriority(str, Enum):
    NORMAL = "NORMAL"
    HIGH = "HIGH"
    URGENT = "URGENT"

class ServicePaymentRead(BaseModel):
    id: int
    amount: Decimal
    currency: str
    payment_method: str
    reference: Optional[str] = None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

# Service Payment Create Schema (Nested in Order Create or standalone)
class ServicePaymentCreate(BaseModel):
    amount: Decimal
    currency: str = "USD"
    payment_method: str = "Efectivo"
    reference: Optional[str] = None

class ServiceOrderBase(BaseModel):
    customer_id: int
    technician_id: Optional[int] = None
    
    service_type: ServiceType = ServiceType.REPAIR
    priority: ServicePriority = ServicePriority.NORMAL
    
    # Device Info (Optional now)
    device_type: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    serial_imei: Optional[str] = None
    passcode_pattern: Optional[str] = None
    
    # Diagnosis / Details
    problem_description: Optional[str] = None
    physical_condition: Optional[str] = None
    diagnosis_notes: Optional[str] = None
    
    # Flexible Data
    order_metadata: Optional[Dict[str, Any]] = None

    # Warranty Policy (overrides tenant default; None = use default)
    warranty_policy_id: Optional[int] = None

    # Optional on creation
    estimated_delivery: Optional[datetime] = None

class ServiceOrderUpdate(BaseModel):
    status: Optional[str] = None
    diagnosis_notes: Optional[str] = None
    order_metadata: Optional[Dict[str, Any]] = None
    technician_id: Optional[int] = None
    priority: Optional[ServicePriority] = None
    admin_pin: Optional[str] = None # For reversing delivered status

class ServiceOrderCreate(ServiceOrderBase):
    # NEW: Support Multi-Item creation
    items: List[ServiceOrderDetailCreate] = []
    # NEW: Support Initial Payment (Abono)
    payments: List[ServicePaymentCreate] = []

    @field_validator('problem_description')
    @classmethod
    def validate_tech_fields(cls, v, info):
        service_type = info.data.get('service_type', ServiceType.REPAIR)
        if service_type == ServiceType.REPAIR:
            # If REPAIR, we might want to warn or ensure some fields are present
            # But we made them generic. Let's ensure 'problem_description' is present for Repairs?
            if not v:
                 raise ValueError('La descripción del problema es obligatoria para reparaciones.')
        return v
        


class ServiceOrderRead(ServiceOrderBase):
    id: int
    ticket_number: str
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    customer: Optional[CustomerRead] = None
    technician: Optional[UserRead] = None
    details: List[ServiceOrderDetailRead] = []
    payments: List[ServicePaymentRead] = []

    model_config = ConfigDict(from_attributes=True)

# ========================
# SERVICE TEMPLATE SCHEMAS
# ========================

class ServiceTemplateItemBase(BaseModel):
    description: str
    unit_price: Decimal
    quantity: Decimal = Decimal("1.000")

class ServiceTemplateItemCreate(ServiceTemplateItemBase):
    pass

class ServiceTemplateItemRead(ServiceTemplateItemBase):
    id: int
    template_id: int
    model_config = ConfigDict(from_attributes=True)

class ServiceTemplateBase(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    estimated_days: Optional[int] = None
    is_active: bool = True

class ServiceTemplateCreate(ServiceTemplateBase):
    items: List[ServiceTemplateItemCreate] = []

class ServiceTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    estimated_days: Optional[int] = None
    is_active: Optional[bool] = None
    items: Optional[List[ServiceTemplateItemCreate]] = None

class ServiceTemplateRead(ServiceTemplateBase):
    id: int
    created_at: datetime
    items: List[ServiceTemplateItemRead] = []
    model_config = ConfigDict(from_attributes=True)

# ========================
# COMMISSION & CASH SCHEMAS
# ========================

class CommissionLogRead(BaseModel):
    id: int
    user_id: int
    amount: Decimal
    currency: str
    source_type: Optional[str] = "SALE"
    source_id: Optional[int] = None
    sale_detail_id: Optional[int] = None
    source_reference: Optional[str] = None
    status: Optional[str] = "PENDING"
    created_at: datetime
    paid_at: Optional[datetime] = None
    notes: Optional[str] = None
    # Nuevos campos para tasa congelada y monto en Bs
    exchange_rate_snapshot: Optional[Decimal] = None  # Tasa del día de la venta
    amount_bs: Optional[Decimal] = None               # Equivalente Bs congelado
    paid_in_bs: Optional[bool] = False                # Si fue cobrado en Bs
    percentage_applied: Optional[Decimal] = None
    commission_role: Optional[str] = None

    user: Optional[UserRead] = None

    model_config = ConfigDict(from_attributes=True)



class CommissionSummaryRead(BaseModel):
    user_id: int
    user_name: str
    full_name: Optional[str] = None
    commission_role: Optional[str] = "VENDOR"
    total_earned: Optional[Decimal] = Decimal("0.00")
    pending_amount: Decimal
    count: int

class CommissionPayoutRequest(BaseModel):
    user_id: int
    log_ids: List[int]
    payment_source: str # DRAWER, EXTERNAL
    payment_method: str # CASH_USD, CASH_VES, ZELLE, TRANSFER
    amount_usd_total: Decimal
    exchange_rate: Decimal = Decimal("1.00")
    reference: Optional[str] = None


# Authentication Recovery Schemas
from pydantic import EmailStr

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=6)

# ========================
# Warranty Schemas
# ========================
from .warranty import (
    WarrantyType,
    ResolutionType,
    ClaimStatus,
    WarrantyPolicyBase,
    WarrantyPolicyCreate,
    WarrantyPolicyRead,
    WarrantyClaimBase,
    WarrantyClaimCreate,
    WarrantyClaimUpdate,
    WarrantyClaimRead
)

# ── Resolver forward references de Pydantic v2 ──────────────────────────────
# ComboItemRead.child_product usa 'ProductRead' como forward ref
# ProductRead.combo_items usa ComboItemRead -- dependencia circular
# model_rebuild() resuelve ambas referencias después de que todos los modelos están definidos
ComboItemRead.model_rebuild()
ProductRead.model_rebuild()
