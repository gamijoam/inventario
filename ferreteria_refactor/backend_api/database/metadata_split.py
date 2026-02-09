"""
Metadata splitting for Multi-Branch Alembic Architecture

This module separates SQLAlchemy metadata into two distinct groups:
1. shared_metadata: Tables in the public schema (Tenant, User, TenantPayment)
2. tenant_metadata: Tables in tenant schemas (Product, Sale, Customer, etc.)
"""
from sqlalchemy import MetaData
from backend_api.database.db import Base

# Import all models to ensure they're registered
from backend_api.models.tenant import Tenant
from backend_api.models.payment import TenantPayment
from backend_api.models.models import (
    User, Product, Category, Sale, SaleDetail, Customer,
    Warehouse, PaymentMethod,
    Currency, ExchangeRate, BusinessConfig, CashSession,
    CashMovement, CommissionLog,
    PriceList, ProductPrice, Supplier, PurchaseOrder, PurchaseItem,
    InventoryTransfer, TransferDetail, ServiceOrder, ServiceOrderDetail,
    ProductUnit, ComboItem, Kardex, SalePayment, CashSessionCurrency,
    Return, ReturnDetail, Payment, PriceRule, Quote, QuoteDetail,
    AuditLog, ProductStock
)
from backend_api.models.restaurant import (
    RestaurantTable, RestaurantOrder, RestaurantOrderItem,
    RestaurantRecipe, RestaurantMenuSection, RestaurantMenuItem
)
from backend_api.models.prueba import PruebaActualizacion
from backend_api.models.prueba_vps import PruebaVPS
from backend_api.models.notas import NotasRapidas

# ============================================================
# SHARED METADATA (Public Schema)
# ============================================================
shared_metadata = MetaData(schema="public")

# Register shared tables
Tenant.__table__.to_metadata(shared_metadata, schema="public")
TenantPayment.__table__.to_metadata(shared_metadata, schema="public")

# ============================================================
# TENANT METADATA (Tenant Schemas)
# ============================================================
tenant_metadata = MetaData()

# Core tables
User.__table__.to_metadata(tenant_metadata, schema="public")
Product.__table__.to_metadata(tenant_metadata)
Category.__table__.to_metadata(tenant_metadata)
Sale.__table__.to_metadata(tenant_metadata)
SaleDetail.__table__.to_metadata(tenant_metadata)
Customer.__table__.to_metadata(tenant_metadata)
Warehouse.__table__.to_metadata(tenant_metadata)
PaymentMethod.__table__.to_metadata(tenant_metadata)
Currency.__table__.to_metadata(tenant_metadata)
ExchangeRate.__table__.to_metadata(tenant_metadata)
BusinessConfig.__table__.to_metadata(tenant_metadata)
CashSession.__table__.to_metadata(tenant_metadata)
CashMovement.__table__.to_metadata(tenant_metadata)
CommissionLog.__table__.to_metadata(tenant_metadata)
PriceList.__table__.to_metadata(tenant_metadata)
ProductPrice.__table__.to_metadata(tenant_metadata)
Supplier.__table__.to_metadata(tenant_metadata)
PurchaseOrder.__table__.to_metadata(tenant_metadata)
PurchaseItem.__table__.to_metadata(tenant_metadata)
InventoryTransfer.__table__.to_metadata(tenant_metadata)
TransferDetail.__table__.to_metadata(tenant_metadata)
ServiceOrder.__table__.to_metadata(tenant_metadata)
ServiceOrderDetail.__table__.to_metadata(tenant_metadata)
ServiceOrderDetail.__table__.to_metadata(tenant_metadata)

# Missing Core Tables
ProductUnit.__table__.to_metadata(tenant_metadata)
ComboItem.__table__.to_metadata(tenant_metadata)
Kardex.__table__.to_metadata(tenant_metadata)
SalePayment.__table__.to_metadata(tenant_metadata)
CashSessionCurrency.__table__.to_metadata(tenant_metadata)
Return.__table__.to_metadata(tenant_metadata)
ReturnDetail.__table__.to_metadata(tenant_metadata)
Payment.__table__.to_metadata(tenant_metadata)
PriceRule.__table__.to_metadata(tenant_metadata)
Quote.__table__.to_metadata(tenant_metadata)
QuoteDetail.__table__.to_metadata(tenant_metadata)
AuditLog.__table__.to_metadata(tenant_metadata)
ProductStock.__table__.to_metadata(tenant_metadata)
RestaurantTable.__table__.to_metadata(tenant_metadata)
RestaurantOrder.__table__.to_metadata(tenant_metadata)
RestaurantOrderItem.__table__.to_metadata(tenant_metadata)
RestaurantRecipe.__table__.to_metadata(tenant_metadata)
RestaurantMenuSection.__table__.to_metadata(tenant_metadata)
RestaurantMenuItem.__table__.to_metadata(tenant_metadata)

# Test/Debug tables
PruebaActualizacion.__table__.to_metadata(tenant_metadata)
PruebaVPS.__table__.to_metadata(tenant_metadata)
NotasRapidas.__table__.to_metadata(tenant_metadata)
