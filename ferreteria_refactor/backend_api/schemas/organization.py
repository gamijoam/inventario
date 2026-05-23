"""
Schemas Pydantic — Sistema Multi-Empresa
"""
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from datetime import datetime
import re


# ── Organizations ─────────────────────────────────────────────────────────────

class OrganizationCreate(BaseModel):
    name           : str
    owner_email    : str
    owner_name     : Optional[str] = None
    owner_password : Optional[str] = None  # Si se da, crea el usuario en todos los tenants
    plan           : str = "multi"
    max_tenants    : int = 5
    primary_color  : str = "#4F46E5"
    logo_url       : Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v):
        if not v.strip():
            raise ValueError("El nombre no puede estar vacío")
        return v.strip()


class OrganizationUpdate(BaseModel):
    name                 : Optional[str]      = None
    owner_name           : Optional[str]      = None
    plan                 : Optional[str]      = None
    max_tenants          : Optional[int]      = None
    is_active            : Optional[bool]     = None
    primary_color        : Optional[str]      = None
    logo_url             : Optional[str]      = None
    use_shared_whatsapp  : Optional[bool]     = None
    whatsapp_instance    : Optional[str]      = None
    plan_expires_at      : Optional[datetime] = None
    plan_price           : Optional[float]    = None
    plan_notes           : Optional[str]      = None


class OrganizationMemberOut(BaseModel):
    id          : int
    user_email  : str
    role        : str
    can_switch  : bool
    invited_at  : datetime
    accepted_at : Optional[datetime] = None
    model_config = {"from_attributes": True}


class OrganizationTenantOut(BaseModel):
    id          : int
    schema_name : str
    name        : str
    is_active   : bool
    license_type: Optional[str] = None
    trial_ends_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


class OrganizationOut(BaseModel):
    id                   : int
    name                 : str
    slug                 : str
    owner_email          : str
    owner_name           : Optional[str]
    plan                 : str
    max_tenants          : int
    is_active            : bool
    created_at           : datetime
    logo_url             : Optional[str]
    primary_color        : str
    use_shared_whatsapp  : bool = False
    whatsapp_instance    : Optional[str] = None
    plan_expires_at      : Optional[datetime] = None
    plan_price           : float = 0.0
    plan_notes           : Optional[str] = None
    member_count         : int = 0
    tenant_count         : int = 0
    model_config = {"from_attributes": True}


# ── Organization Users ────────────────────────────────────────────────────────

class InviteMemberRequest(BaseModel):
    user_email  : str
    role        : str = "manager"    # owner | manager | viewer
    can_switch  : bool = True


# ── Shared Products ───────────────────────────────────────────────────────────

class SharedProductCreate(BaseModel):
    name            : str
    sku             : Optional[str]   = None
    description     : Optional[str]   = None
    cost_price      : float = 0.0
    suggested_price : float = 0.0
    category_name   : Optional[str]   = None
    image_url       : Optional[str]   = None


class SharedProductOut(BaseModel):
    id              : int
    organization_id : int
    name            : str
    sku             : Optional[str]
    description     : Optional[str]
    cost_price      : float
    suggested_price : float
    category_name   : Optional[str]
    is_active       : bool
    created_at      : datetime
    model_config = {"from_attributes": True}


class ImportSharedProductRequest(BaseModel):
    """Importar productos del catálogo compartido a una empresa específica."""
    product_ids : List[int]
    warehouse_id: int = 1
    initial_stock: float = 0.0
    use_suggested_price: bool = True


# ── Inter-Company Transfers ───────────────────────────────────────────────────

class TransferItemCreate(BaseModel):
    product_sku  : str
    product_name : str
    quantity     : float
    unit_cost    : float = 0.0


class InterCompanyTransferCreate(BaseModel):
    to_tenant_id : int
    notes        : Optional[str] = None
    items        : List[TransferItemCreate]


class TransferItemOut(BaseModel):
    id           : int
    product_sku  : str
    product_name : str
    quantity     : float
    unit_cost    : float
    model_config = {"from_attributes": True}


class InterCompanyTransferOut(BaseModel):
    id              : int
    organization_id : int
    from_tenant_id  : int
    to_tenant_id    : int
    status          : str
    notes           : Optional[str]
    created_at      : datetime
    completed_at    : Optional[datetime]
    items           : List[TransferItemOut] = []
    from_tenant_name: Optional[str] = None
    to_tenant_name  : Optional[str] = None
    model_config = {"from_attributes": True}


# ── Consolidated Dashboard ────────────────────────────────────────────────────

class TenantDailySummary(BaseModel):
    tenant_id   : int
    schema_name : str
    name        : str
    sales_today : float = 0.0
    sales_count : int   = 0
    low_stock   : int   = 0   # productos bajo stock mínimo


class ConsolidatedSummary(BaseModel):
    organization_id     : int
    organization_name   : str
    total_sales_today   : float
    total_transactions  : int
    best_tenant_name    : Optional[str]
    best_tenant_sales   : float
    total_low_stock     : int
    tenants             : List[TenantDailySummary]


# ── Auth / Switch de empresa ──────────────────────────────────────────────────

class OrgCompanyOut(BaseModel):
    """Empresa dentro de una organización para mostrar en el selector."""
    tenant_id   : int
    schema_name : str
    name        : str
    is_active   : bool
    logo_url    : Optional[str] = None
    switch_url  : Optional[str] = None   # URL del subdominio de la empresa


# ── Configuración de plan desde el panel SaaS ─────────────────────────────────

class OrgPlanConfig(BaseModel):
    """Configuración del plan de una organización (desde panel admin / bot Telegram)."""
    plan            : str               # duo | multi | enterprise
    max_tenants     : int = 5
    plan_price      : float = 0.0
    plan_notes      : Optional[str] = None
    plan_expires_at : Optional[datetime] = None


class OrgWhatsAppConfig(BaseModel):
    """Configuración de WhatsApp compartido para la organización."""
    use_shared_whatsapp : bool          # Activar / desactivar WA compartido
    whatsapp_instance   : Optional[str] = None  # Nombre de la instancia Baileys


# ── Stock Search Cross-Empresa ────────────────────────────────────────────────

class StockSearchMatch(BaseModel):
    """Una coincidencia de producto en una empresa del grupo."""
    tenant_id     : int
    tenant_name   : str
    tenant_schema : str
    product_id    : int
    sku           : Optional[str] = None
    name          : str
    stock         : float
    min_stock     : float = 0.0
    price         : float = 0.0
    cost_price    : float = 0.0
    is_active     : bool  = True
    low_stock     : bool  = False   # True si stock <= min_stock (y min_stock > 0)


class StockSearchResponse(BaseModel):
    """Respuesta de búsqueda de stock cross-empresa."""
    query             : str
    organization_id   : int
    organization_name : str
    tenants_searched  : int
    total_matches     : int
    results           : List[StockSearchMatch]
