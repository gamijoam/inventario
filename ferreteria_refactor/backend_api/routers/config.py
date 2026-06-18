from ..cache import get_cached, set_cached, invalidate, invalidate_resource, TTL
from fastapi import File, UploadFile
from ..cache import get_cached, set_cached, invalidate, TTL
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import requests
from decimal import Decimal, InvalidOperation
from datetime import datetime
from pydantic import BaseModel
from ..database.db import get_db
from ..models import models
from .. import schemas
from ..dependencies import admin_only, get_current_active_user
from ..websocket.manager import manager
from ..websocket.events import WebSocketEvents
from ..template_presets import (
    get_all_presets, get_preset_by_id,
    get_services_sale_58_template, get_services_sale_80_template,
)
from ..config import settings

router = APIRouter(
    prefix="/config",
    tags=["config"]
)

@router.get("/public")
def get_public_config(db: Session = Depends(get_db)):
    """
    Get public configuration and feature flags.
    Response is the INTERSECTION of:
    1. Server Capabilities (Env Vars)
    2. Tenant Entitlements (DB Config)
    """
    from ..tenant_context import get_tenant_schema
    from ..models.tenant import Tenant
    
    current_schema = get_tenant_schema()
    tenant_name = "Ferretería Demo (Public)"
    
    # Logic:
    # 1. Server Capabilities (Env) - What the code CAN do.
    # 2. Public Default - What we show to unknown users (Clean slate).
    # 3. Tenant Entitlements (DB) - What the customer paid for.

    if current_schema == "public":
        # Use Server Capabilities from .env for local development (no tenant)
        modules = {
            "restaurant": settings.MODULE_RESTAURANT_ENABLED,
            "laundry": settings.MODULE_LAUNDRY_ENABLED,
            "services": settings.MODULE_SERVICES_ENABLED,
            "ferreteria": True,
            "barbershop": False,
            "pharmacy": False,
        }
    else:
        # For a Real Tenant, start with Server Capabilities
        modules = {
            "restaurant": settings.MODULE_RESTAURANT_ENABLED,
            "laundry": settings.MODULE_LAUNDRY_ENABLED,
            "services": settings.MODULE_SERVICES_ENABLED,
            "ferreteria": True,
            "barbershop": False,
            "pharmacy": False,
        }
    
    # 3. DB Entitlements (Override for Tenants)
    tenant_found = False
    feature_flags: dict = {}

    if current_schema != "public":
        try:
            # Query tenant in public schema table
            tenant_obj = db.query(Tenant).filter(Tenant.schema_name == current_schema).first()

            if tenant_obj:
                tenant_found = True
                tenant_name = tenant_obj.name

                # REFACTOR: Use the NEW boolean columns with .env fallback
                modules = {
                    "restaurant": tenant_obj.has_restaurant_module or settings.MODULE_RESTAURANT_ENABLED,
                    "laundry": tenant_obj.has_laundry_module or settings.MODULE_RESTAURANT_ENABLED, # Using restaurant env for now if needed, or specific ones
                    "services": tenant_obj.has_services_module or settings.MODULE_SERVICES_ENABLED,
                    "ferreteria": tenant_obj.has_hardware_module or True,
                    "barbershop": tenant_obj.has_barbershop_module,
                    "pharmacy": tenant_obj.has_pharmacy_module,
                }
                # Ensure compatibility with frontend mapping logic
                modules["has_restaurant_module"] = modules["restaurant"]
                modules["has_pharmacy_module"] = modules["pharmacy"]
                modules["has_services_module"] = modules["services"]

                # Falling back to JSON config if all booleans are False (for existing tenants)
                if not any(modules.values()) and tenant_obj.config:
                    db_modules = tenant_obj.config.get("modules", {})
                    for mod, enabled in db_modules.items():
                        if mod in modules:
                            modules[mod] = enabled

                # Feature flags a la carta
                feature_flags = tenant_obj.feature_flags or {}
            else:
                print(f"⚠️ Warning: Schema '{current_schema}' detected but not found in DB. Falling back to public defaults.")

        except Exception as e:
            print(f"⚠️ Error fetching tenant config: {e}")

    # SAFETY NET: If we are not public, but tenant not found, DO NOT expose all modules.
    if current_schema != "public" and not tenant_found:
         # Force Clean Slate (Safety Fallback)
        modules = {
            "restaurant": False,
            "laundry": False,
            "services": False,
            "ferreteria": True,
            "barbershop": False,
            "pharmacy": False,
        }

    return {
        "modules": modules,
        "feature_flags": feature_flags,
        "tenant_name": tenant_name,
        "tenant": current_schema,
    }

# ========================================
# EXCHANGE RATE MANAGEMENT (NEW SYSTEM)
# ========================================

def _exchange_rate_payload(rate):
    return {
        "id": rate.id,
        "name": rate.name,
        "currency_code": rate.currency_code,
        "currency_symbol": rate.currency_symbol,
        "rate": float(rate.rate),
        "is_default": rate.is_default,
        "is_active": rate.is_active,
        "auto_update_enabled": getattr(rate, "auto_update_enabled", False),
        "auto_update_source": getattr(rate, "auto_update_source", "manual") or "manual",
        "created_at": rate.created_at,
        "updated_at": rate.updated_at,
    }


@router.get("/exchange-rates", response_model=List[schemas.ExchangeRateRead])
def get_exchange_rates(
    currency_code: str = None,
    is_active: bool = None,
    db: Session = Depends(get_db)
):
    """Get all exchange rates, optionally filtered by currency or active status"""
    # SECURITY: Check Tenant Context
    # If we are in 'public' schema, the 'exchange_rates' table DOES NOT EXIST.
    # Return default static rates to prevent crash and allow landing page to work.
    from ..tenant_context import get_tenant_schema
    current_schema = get_tenant_schema()
    
    if current_schema == 'public':
        # Return static defaults for public context (e.g. login page, landing)
        return [
            schemas.ExchangeRateRead(
                id=0,
                name="BCV",
                currency_code="VES",
                currency_symbol="Bs",
                rate=45.00,
                is_default=True,
                is_active=True,
                created_at=datetime.now(),
                updated_at=datetime.now()
            ),
             schemas.ExchangeRateRead(
                id=0,
                name="Paralelo",
                currency_code="VES",
                currency_symbol="Bs",
                rate=52.00,
                is_default=False,
                is_active=True,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
        ]

    # Caché Redis 15 min (las tasas cambian poco)
    cache_extra = f"{currency_code or ''}:{is_active or ''}"
    cached = get_cached(current_schema, "exchange_rates", cache_extra)
    if cached is not None:
        return [schemas.ExchangeRateRead(**r) for r in cached]

    query = db.query(models.ExchangeRate)
    if currency_code:
        query = query.filter(models.ExchangeRate.currency_code == currency_code)
    if is_active is not None:
        query = query.filter(models.ExchangeRate.is_active == is_active)

    rates = query.order_by(models.ExchangeRate.currency_code, models.ExchangeRate.is_default.desc()).all()
    set_cached(current_schema, "exchange_rates",
               [{**_exchange_rate_payload(r),
                 "created_at": str(r.created_at),
                 "updated_at": str(r.updated_at)} for r in rates],
               extra=cache_extra, ttl=TTL["exchange_rates"])
    return rates


@router.post("/exchange-rates", response_model=schemas.ExchangeRateRead)
async def create_exchange_rate(
    rate_data: schemas.ExchangeRateCreate,
    db: Session = Depends(get_db),
    user: Any = Depends(admin_only)  # Protect mutation
):
    """Create a new exchange rate"""
    # Validate: If is_default=True, unset other defaults for same currency
    if rate_data.is_default:
        db.query(models.ExchangeRate).filter(
            models.ExchangeRate.currency_code == rate_data.currency_code,
            models.ExchangeRate.is_default == True
        ).update({"is_default": False})
    
    new_rate = models.ExchangeRate(**rate_data.dict())
    db.add(new_rate)
    db.flush()
    
    # Capture data
    response_data = _exchange_rate_payload(new_rate)
    
    db.commit()

    # Invalidar TODAS las variantes de caché de exchange_rates y pos_init
    from ..tenant_context import get_tenant_schema as _gts
    _schema = _gts()
    invalidate_resource(_schema, "exchange_rates")
    invalidate_resource(_schema, "pos_init")
    invalidate_resource(_schema, "pos-init")

    # Broadcast event
    await manager.broadcast(WebSocketEvents.EXCHANGE_RATE_CREATED, {
        "id": response_data["id"],
        "name": response_data["name"],
        "rate": response_data["rate"],
        "currency_code": response_data["currency_code"],
        "is_default": response_data["is_default"],
        "is_active": response_data["is_active"],
        "auto_update_enabled": response_data["auto_update_enabled"],
        "auto_update_source": response_data["auto_update_source"]
    })
    
    return response_data


# ========================================
# BCV SCRAPING (Banco Central de Venezuela)
# NOTE: must be defined BEFORE /{id} route or FastAPI will try to cast
#       "bcv" as int and return a Pydantic validation error.
# ========================================

@router.get("/exchange-rates/bcv")
def fetch_bcv_rates():
    """
    Scrape current official exchange rates from the BCV website.
    Returns USD/VES and EUR/VES rates.
    No auth required (read-only, public data).
    """
    import re
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-VE,es;q=0.9,en;q=0.5",
        "Cache-Control": "no-cache",
    }

    try:
        resp = requests.get(
            "https://www.bcv.org.ve/",
            headers=HEADERS,
            timeout=15,
            verify=False,   # VPS Docker containers may lack root CA bundle
        )
        resp.raise_for_status()
        html = resp.text
    except requests.RequestException as e:
        raise HTTPException(
            status_code=503,
            detail=f"No se pudo conectar al BCV: {str(e)}"
        )

    def extract_rate(currency_id: str):
        """Find <div id='{currency_id}'>...<strong>45,8000</strong>..."""
        pattern = (
            r'id=["\']' + re.escape(currency_id) + r'["\'][^>]*>'
            r'.*?<strong[^>]*>\s*([\d,\.]+)\s*</strong>'
        )
        m = re.search(pattern, html, re.DOTALL | re.IGNORECASE)
        if not m:
            return None
        raw = m.group(1).strip().replace(",", ".")
        try:
            return round(float(raw), 8)
        except ValueError:
            return None

    usd_ves = extract_rate("dolar")
    eur_ves = extract_rate("euro")

    if usd_ves is None and eur_ves is None:
        raise HTTPException(
            status_code=502,
            detail=(
                "No se pudieron extraer las tasas del BCV. "
                "El sitio puede haber cambiado su estructura. "
                "Intenta nuevamente más tarde."
            ),
        )

    return {
        "usd_ves": usd_ves,
        "eur_ves": eur_ves,
        "fetched_at": datetime.now().isoformat(),
        "source": "Banco Central de Venezuela",
        "url": "https://www.bcv.org.ve/",
    }


@router.get("/exchange-rates/{id}", response_model=schemas.ExchangeRateRead)
def get_exchange_rate_by_id(id: int, db: Session = Depends(get_db)):
    """Get a specific exchange rate by ID"""
    rate = db.query(models.ExchangeRate).get(id)
    if not rate:
        raise HTTPException(status_code=404, detail="Exchange rate not found")
    return rate


@router.put("/exchange-rates/{id}", response_model=schemas.ExchangeRateRead)
async def update_exchange_rate(
    id: int,
    rate_data: schemas.ExchangeRateUpdate,
    db: Session = Depends(get_db),
    user: Any = Depends(admin_only)  # Protect mutation
):
    """Update an exchange rate"""
    rate = db.query(models.ExchangeRate).get(id)
    if not rate:
        raise HTTPException(status_code=404, detail="Exchange rate not found")
    
    # Handle default flag
    if rate_data.is_default is not None and rate_data.is_default and not rate.is_default:
        # Unset other defaults for same currency
        db.query(models.ExchangeRate).filter(
            models.ExchangeRate.currency_code == rate.currency_code,
            models.ExchangeRate.id != id
        ).update({"is_default": False})
    
    update_data = rate_data.dict(exclude_unset=True)
    if "rate" in update_data and "auto_update_enabled" not in update_data:
        update_data["auto_update_enabled"] = False
        update_data["auto_update_source"] = "manual"
    if update_data.get("auto_update_enabled") is False:
        update_data["auto_update_source"] = "manual"
    if update_data.get("auto_update_enabled") is True and update_data.get("auto_update_source") not in ("bcv_usd", "bcv_eur"):
        update_data["auto_update_source"] = "bcv_usd"

    # Update fields
    for key, value in update_data.items():
        setattr(rate, key, value)
    
    # Capture data
    response_data = _exchange_rate_payload(rate)

    db.commit()

    # Invalidar TODAS las variantes de caché de exchange_rates y pos_init
    from ..tenant_context import get_tenant_schema as _gts
    _schema = _gts()
    invalidate_resource(_schema, "exchange_rates")
    invalidate_resource(_schema, "pos_init")
    invalidate_resource(_schema, "pos-init")

    # AUDIT LOG
    from ..audit_utils import log_action
    import json
    log_action(db, user_id=user.id, action="UPDATE", table_name="exchange_rates", record_id=response_data["id"], changes=json.dumps({"rate": str(response_data["rate"]), "is_active": response_data["is_active"]}, default=str))

    # Broadcast al tenant correcto (no a "public")
    await manager.broadcast(WebSocketEvents.EXCHANGE_RATE_UPDATED, {
        "id": response_data["id"],
        "name": response_data["name"],
        "rate": response_data["rate"],
        "currency_code": response_data["currency_code"],
        "is_default": response_data["is_default"],
        "is_active": response_data["is_active"],
        "auto_update_enabled": response_data["auto_update_enabled"],
        "auto_update_source": response_data["auto_update_source"]
    })
    
    return response_data


@router.delete("/exchange-rates/{id}")
async def delete_exchange_rate(
    id: int,
    db: Session = Depends(get_db),
    user: Any = Depends(admin_only)  # Protect mutation
):
    """Soft delete (deactivate) an exchange rate"""
    rate = db.query(models.ExchangeRate).get(id)
    if not rate:
        raise HTTPException(status_code=404, detail="Exchange rate not found")
    
    if rate.is_default:
        raise HTTPException(
            status_code=400, 
            detail="Cannot delete default rate. Set another rate as default first."
        )
    
    try:
        db.delete(rate)
        db.commit()
    except Exception as e:
        db.rollback()
        # Check standard SQLAlchemy integrity error string or type (simplified here to generic catch with check)
        if "foreign key constraint" in str(e).lower() or "integrity" in str(e).lower():
            raise HTTPException(
                status_code=400, 
                detail="No se puede eliminar esta tasa porque está asignada a uno o más Productos. Desasígnela primero o simplemente desactívela."
            )
        raise HTTPException(status_code=500, detail=str(e))
    
    # Broadcast event
    await manager.broadcast(WebSocketEvents.EXCHANGE_RATE_DELETED, {
        "id": rate.id
    })
    
    return {"message": "Exchange rate deleted successfully"}


# ========================================
# BUSINESS CONFIGURATION (GENERIC)
# ========================================

@router.get("/pos-init")
def get_pos_init(db: Session = Depends(get_db)):
    """
    Endpoint optimizado para carga inicial del POS.
    Consolida en 1 request lo que antes eran 4:
    - business_config
    - exchange_rates activos
    - payment_methods
    - pos settings (auto_print_ticket)
    """
    from ..tenant_context import get_tenant_schema
    from ..cache import get_cached, set_cached, TTL
    from sqlalchemy import text

    schema = get_tenant_schema()
    if schema == 'public':
        return {"business": {}, "exchange_rates": [], "payment_methods": [], "settings": {}}

    cache_key = "pos_init"
    cached = get_cached(schema, cache_key)
    if cached:
        return cached

    # Ejecutar las 4 queries en paralelo usando la misma sesión
    configs = {r[0]: r[1] for r in db.execute(text(f"SELECT key, value FROM {schema}.business_config")).all()}
    exchange_rates = db.query(models.ExchangeRate).filter(models.ExchangeRate.is_active == True).all()
    payment_methods = db.query(models.PaymentMethod).filter(models.PaymentMethod.is_active == True).all()
    price_lists = db.query(models.PriceList).filter(models.PriceList.is_active == True).order_by(models.PriceList.id.asc()).all()
    categories = db.query(models.Category).order_by(models.Category.name.asc()).all()
    warehouses = db.query(models.Warehouse).order_by(models.Warehouse.id.asc()).all()

    result = {
        "business": {
            "name": configs.get("business_name", ""),
            "logo_url": configs.get("business_logo", ""),
            "address": configs.get("business_address", ""),
            "phone": configs.get("business_phone", ""),
            "default_tax_rate": configs.get("default_tax_rate", "0"),
            "external_financing_enabled": configs.get("external_financing_enabled", "false").lower() == "true",
            "warranty_format_url": configs.get("warranty_format_url", ""),
        },
        "exchange_rates": [
            {"id": r.id, "name": r.name, "currency_code": r.currency_code,
             "currency_symbol": r.currency_symbol, "rate": float(r.rate),
             "is_default": r.is_default, "is_active": r.is_active,
             "auto_update_enabled": getattr(r, "auto_update_enabled", False),
             "auto_update_source": getattr(r, "auto_update_source", "manual") or "manual"}
            for r in exchange_rates
        ],
        "payment_methods": [
            {"id": m.id, "name": m.name, "is_active": m.is_active,
             "is_system": m.is_system, "is_external_financer": getattr(m, 'is_external_financer', False),
             "requires_reference": getattr(m, 'requires_reference', False)}
            for m in payment_methods
        ],
        "price_lists": [
            {"id": pl.id, "name": pl.name, "requires_auth": pl.requires_auth,
             "is_active": pl.is_active, "created_at": pl.created_at.isoformat() if pl.created_at else None}
            for pl in price_lists
        ],
        "categories": [
            {"id": c.id, "name": c.name, "description": c.description,
             "parent_id": c.parent_id, "is_no_kitchen_category": c.is_no_kitchen_category}
            for c in categories
        ],
        "warehouses": [
            {"id": w.id, "name": w.name, "address": w.address,
             "is_main": w.is_main, "is_active": w.is_active, "stocks_count": 0}
            for w in warehouses
        ],
        "settings": {
            "auto_print_ticket": configs.get("auto_print_ticket", "false").lower() == "true",
            "paper_width": configs.get("paper_width", "58"),
            "pos_default_price_list_id": configs.get("pos_default_price_list_id", ""),
            "pos_show_bs": configs.get("pos_show_bs", "true").lower() != "false",
        }
    }

    set_cached(schema, cache_key, result, ttl=TTL["business_config"])
    return result


@router.get("/business", response_model=schemas.BusinessInfo)
def get_business_info(db: Session = Depends(get_db)):
    from ..tenant_context import get_tenant_schema
    from sqlalchemy import text
    schema = get_tenant_schema()
    # Consulta directa al esquema para evitar errores de UndefinedTable
    # Caché Redis: business_config por tenant (5 min)
    _cached = get_cached(schema, "business_config")
    if _cached:
        return schemas.BusinessInfo(**_cached)

    result = db.execute(text(f"SELECT key, value FROM {schema}.business_config")).all()
    configs = {r[0]: r[1] for r in result}
    _biz = schemas.BusinessInfo(
        # Las keys en BD usan prefijo "business_" — buscar ambas formas por compatibilidad
        name=configs.get("business_name") or configs.get("name", ""),
        document_id=configs.get("business_doc") or configs.get("document_id", ""),
        address=configs.get("business_address") or configs.get("address", ""),
        phone=configs.get("business_phone") or configs.get("phone", ""),
        email=configs.get("business_email") or configs.get("email", ""),
        website=configs.get("business_website") or configs.get("website"),
        logo_url=configs.get("business_logo") or configs.get("logo_url"),
        warranty_format_url=configs.get("warranty_format_url"),
        ticket_template=configs.get("ticket_template", ""),
        default_tax_rate=Decimal(str(configs.get("default_tax_rate", "0.00"))),
        external_financing_enabled=configs.get("external_financing_enabled", "false").lower() == "true"
    )
    set_cached(schema, "business_config", _biz.model_dump(), ttl=TTL["business_config"])
    return _biz

@router.put("/business", response_model=schemas.BusinessInfo)
def update_business_info(
    info: schemas.BusinessInfo, 
    db: Session = Depends(get_db),
    user: Any = Depends(admin_only)
):
    """Update aggregated business information"""
    mapping = {
        "business_name": info.name,
        "business_doc": info.document_id,
        "business_address": info.address,
        "business_phone": info.phone,
        "business_email": info.email,
        "ticket_template": info.ticket_template,
        "default_tax_rate": str(info.default_tax_rate) if info.default_tax_rate is not None else None
    }
    
    for key, value in mapping.items():
        if value is not None:
            config = db.query(models.BusinessConfig).get(key)
            if not config:
                config = models.BusinessConfig(key=key, value=value)
                db.add(config)
            else:
                config.value = value

    db.flush()
    result = get_business_info(db)
    db.commit()
    return result

@router.patch("/business")
def patch_business_config(
    data: dict,
    db: Session = Depends(get_db),
    user: Any = Depends(admin_only)
):
    """Actualizar campos individuales de la configuración del negocio"""
    allowed_keys = [
        'external_financing_enabled',
        'bloqueocelular_enabled',
        'warranty_format_url',
        'auto_print_ticket',
    ]
    for key, value in data.items():
        if key not in allowed_keys:
            continue
        config = db.query(models.BusinessConfig).get(key)
        if not config:
            config = models.BusinessConfig(key=key, value=str(value))
            db.add(config)
        else:
            config.value = str(value).lower() if isinstance(value, bool) else str(value)
    db.commit()
    return {"status": "ok", "updated": list(data.keys())}


@router.post("/test-print")
async def test_print_ticket(db: Session = Depends(get_db)):
    """Send test ticket to hardware bridge"""
    print("DEBUG: /test-print endpoint hit") # Debug log
    # Get template
    template_config = db.query(models.BusinessConfig).get("ticket_template")
    if not template_config or not template_config.value:
        pass # Allow testing even without saved template (use default if needed) or raise
        # For now, let's just proceed to verify endpoint works
        
    # Get business info
    business_info = get_business_info(db)
    
    # Create mock sale data
    context = {
        "business": {
            "name": business_info.name or "Mi Negocio",
            "document_id": business_info.document_id or "J-12345678-9",
            "address": business_info.address or "Calle Principal, Local 123",
            "phone": business_info.phone or "0414-1234567",
            "email": business_info.email or "info@minegocio.com"
        },
        "sale": {
            "id": 9999,
            "date": datetime.now().strftime("%d/%m/%Y %H:%M"),
            "total": 125.50,
            "total_usd": 3.50, # Added for completeness
            "exchange_rate": 35.80, # Added for completeness
            "currency_symbol": "$", # Added for templates
            "discount": 0.0,
            "is_credit": True,
            "due_date": "2023-12-31", # Added mock due date
            "balance": 75.50,
            "customer": {
                "name": "Juan Pérez",
                "id_number": "V-12345678"
            },
            "items": [
                {
                    "product": {"name": "Cemento Gris 50kg", "sku": "CEM01"},
                    "quantity": 2.0,
                    "unit_price": 15.00,
                    "subtotal": 30.00,
                    "discount_percentage": 0
                },
                {
                    "product": {"name": "Cabilla 3/8 x 12m", "sku": "CAB02"},
                    "quantity": 5.0,
                    "unit_price": 12.50,
                    "subtotal": 62.50,
                    "discount_percentage": 0
                },
                {
                    "product": {"name": "Pala Metálica", "sku": "PAL01"},
                    "quantity": 1.0,
                    "unit_price": 33.00,
                    "subtotal": 33.00,
                    "discount_percentage": 0
                }
            ],
            "payments": [] # Added payments list
        }
    }
    # Add alias 'products' to avoid Jinja collision with dict.items()
    context["sale"]["products"] = context["sale"]["items"]
    
    # Construct print payload
    template_str = template_config.value if (template_config and template_config.value) else "NOTE: No template saved. This is a test."
    
    # FIX: Jinja2 dict.items collision. Force usage of sale.products
    if "sale.items" in template_str:
        template_str = template_str.replace("sale.items", "sale.products")

    payload = {
        "template": template_str,
        "context": context
    }
    
    # Broadcast to hardware bridge
    from ..services.websocket_manager import manager
    
    await manager.broadcast({
            "type": "print",
            "sale_id": "TEST",
            "payload": payload
    })
    
    return {
        "status": "success",
        "message": "Test print sent to Hardware Bridge",
        "template": payload["template"],
        "context": context
    }

# ========================================
# TEMPLATE PRESETS
# ========================================

@router.get("/ticket-templates/presets")
def get_template_presets():
    """Get all available template presets"""
    from ..template_presets import get_all_presets
    return get_all_presets()

@router.post("/ticket-templates/apply/{preset_id}")
def apply_template_preset(
    preset_id: str,
    db: Session = Depends(get_db),
    user: Any = Depends(admin_only)
):
    """Apply a template preset to business configuration"""
    from ..template_presets import get_preset_by_id
    
    preset = get_preset_by_id(preset_id)
    if not preset:
        raise HTTPException(status_code=404, detail="Template preset not found")
    
    # Update or create ticket_template config
    config = db.query(models.BusinessConfig).get("ticket_template")
    if not config:
        config = models.BusinessConfig(key="ticket_template", value=preset["template"])
        db.add(config)
    else:
        config.value = preset["template"]
    
    db.commit()
    
    return {
        "status": "success",
        "message": f"Template '{preset['name']}' applied successfully",
        "preset_id": preset_id,
        "preset_name": preset["name"]
    }

class ServicesTicketPayload(BaseModel):
    template_58: Optional[str] = None
    template_80: Optional[str] = None


@router.get("/services-ticket")
def get_services_ticket_config(db: Session = Depends(get_db)):
    """Get services-specific sale ticket templates (58mm and 80mm)."""
    cfg = {
        c.key: c.value
        for c in db.query(models.BusinessConfig).filter(
            models.BusinessConfig.key.in_([
                "ticket_template_services_58",
                "ticket_template_services_80",
            ])
        ).all()
    }
    return {
        "template_58": cfg.get("ticket_template_services_58") or get_services_sale_58_template(),
        "template_80": cfg.get("ticket_template_services_80") or get_services_sale_80_template(),
    }


@router.put("/services-ticket")
def save_services_ticket_config(
    payload: ServicesTicketPayload,
    db: Session = Depends(get_db),
    user: Any = Depends(admin_only),
):
    """Save 58mm and/or 80mm services sale ticket templates."""
    to_save = {}
    if payload.template_58 is not None:
        to_save["ticket_template_services_58"] = payload.template_58
    if payload.template_80 is not None:
        to_save["ticket_template_services_80"] = payload.template_80

    for key, value in to_save.items():
        config = db.query(models.BusinessConfig).get(key)
        if config:
            config.value = value
        else:
            db.add(models.BusinessConfig(key=key, value=value))
    db.commit()
    return {"status": "success", "saved_keys": list(to_save.keys())}


@router.post("/services-ticket/apply/{preset_id}")
def apply_services_ticket_preset(
    preset_id: str,
    db: Session = Depends(get_db),
    user: Any = Depends(admin_only),
):
    """Apply a services-category preset to the services ticket template."""
    preset = get_preset_by_id(preset_id)
    if not preset or preset.get("category") != "services":
        raise HTTPException(status_code=404, detail="Preset de equipos no encontrado")

    width = str(preset.get("paper_width", 58))
    key = f"ticket_template_services_{width}"
    config = db.query(models.BusinessConfig).get(key)
    if config:
        config.value = preset["template"]
    else:
        db.add(models.BusinessConfig(key=key, value=preset["template"]))
    db.commit()
    return {"status": "success", "preset_name": preset["name"], "key": key}


@router.get("", response_model=List[schemas.BusinessConfigRead])
def get_all_configs(db: Session = Depends(get_db)):
    """Get all configuration entries"""
    from ..tenant_context import get_tenant_schema
    schema = get_tenant_schema()
    from sqlalchemy import text
    db.execute(text(f"SET search_path TO {schema}, public"))
    return db.query(models.BusinessConfig).all()

@router.get("/dict", response_model=Dict[str, Any])
def get_all_configs_dict(db: Session = Depends(get_db)):
    """Get all configuration as a dictionary"""
    configs = db.query(models.BusinessConfig).all()
    return {c.key: c.value for c in configs}

# Helper endpoint for Legacy Exchange Rate compatibility
@router.get("/exchange-rate/current")
def get_legacy_exchange_rate(db: Session = Depends(get_db)):
    """Get current legacy exchange rate"""
    config = db.query(models.BusinessConfig).get("exchange_rate")
    if not config:
        return {"rate": 1.0}
    try:
        return {"rate": float(config.value)}
    except (ValueError, TypeError):
        return {"rate": 1.0}

# Currency Management Endpoints

@router.get("/currencies")
def get_currencies(db: Session = Depends(get_db)):
    """Get all currencies"""
    # SECURITY: Check Tenant Context
    from ..tenant_context import get_tenant_schema
    current_schema = get_tenant_schema()
    
    if current_schema == 'public':
        # Return default currencies for public context
        return [
            models.Currency(
                id=1, name="Dólar Americano", symbol="USD", rate=1.00, is_anchor=True, is_active=True
            ),
            models.Currency(
                id=2, name="Bolívar Venezolano", symbol="VES", rate=60.00, is_anchor=False, is_active=True
            ),
             models.Currency(
                id=3, name="Peso Colombiano", symbol="COP", rate=4200.00, is_anchor=False, is_active=True
            )
        ]

    data = db.query(models.Currency).all()
    print(f"DEBUG: Returning {len(data)} currencies")
    return data

@router.post("/currencies", response_model=schemas.CurrencyRead)
def create_currency(currency: schemas.CurrencyCreate, db: Session = Depends(get_db)):
    """Create a new currency"""
    # If this is anchor, unset others
    if currency.is_anchor:
        db.query(models.Currency).update({models.Currency.is_anchor: False})
    
    db_currency = models.Currency(**currency.dict())
    db.add(db_currency)
    db.flush()
    
    response_data = {
        "id": db_currency.id,
        "name": db_currency.name,
        "symbol": db_currency.symbol,
        "rate": db_currency.rate,
        "is_anchor": db_currency.is_anchor,
        "is_active": db_currency.is_active
    }
    
    db.commit()
    # db.refresh(db_currency)
    return response_data

@router.put("/currencies/{currency_id}", response_model=schemas.CurrencyRead)
def update_currency(currency_id: int, currency: schemas.CurrencyUpdate, db: Session = Depends(get_db)):
    """Update a currency"""
    db_currency = db.query(models.Currency).get(currency_id)
    if not db_currency:
        raise HTTPException(status_code=404, detail="Currency not found")
    
    update_data = currency.dict(exclude_unset=True)
    
    # If setting to anchor, unset others
    if update_data.get("is_anchor"):
        db.query(models.Currency).update({models.Currency.is_anchor: False})
        
    for key, value in update_data.items():
        setattr(db_currency, key, value)
        
    response_data = {
        "id": db_currency.id,
        "name": db_currency.name,
        "symbol": db_currency.symbol,
        "rate": db_currency.rate,
        "is_anchor": db_currency.is_anchor,
        "is_active": db_currency.is_active
    }

    db.commit()
    # db.refresh(db_currency)
    return response_data

@router.delete("/currencies/{currency_id}")
def delete_currency(currency_id: int, db: Session = Depends(get_db)):
    """Delete a currency"""
    db_currency = db.query(models.Currency).get(currency_id)
    if not db_currency:
        raise HTTPException(status_code=404, detail="Currency not found")
        
    db.delete(db_currency)
    db.commit()
    return {"message": f"Deleted config key: {currency_id}"}


@router.get("/{key}", response_model=schemas.BusinessConfigRead)
def get_config(key: str, db: Session = Depends(get_db)):
    """Get specific configuration key"""
    # SECURITY: Check Tenant Context (Prevent UndefinedTable in public)
    from ..tenant_context import get_tenant_schema
    current_schema = get_tenant_schema()
    
    if current_schema == 'public':
        return models.BusinessConfig(key=key, value="")

    config = db.query(models.BusinessConfig).get(key)
    if not config:
        # Return a dummy config object instead of 404 to suppress errors
        return models.BusinessConfig(key=key, value="")
    return config

@router.put("/{key}", response_model=schemas.BusinessConfigRead)
def set_config(
    key: str, 
    config_data: schemas.BusinessConfigCreate, 
    db: Session = Depends(get_db),
    user: Any = Depends(admin_only)  # Protect mutation
):
    """Set configuration value"""
    # SECURITY: Check Tenant Context (Prevent UndefinedTable in public)
    from ..tenant_context import get_tenant_schema
    current_schema = get_tenant_schema()
    
    if current_schema == 'public':
        # In public context, we can't save to 'business_config' table as it doesn't exist.
        # We just return the value echoed back to simulate success without persistence,
        # or we could raise 403. For SaaS Panel compatibility, echoing is often safer.
        return models.BusinessConfig(key=key, value=config_data.value)

    config = db.query(models.BusinessConfig).get(key)
    if not config:
        config = models.BusinessConfig(key=key, value=config_data.value)
        db.add(config)
    else:
        config.value = config_data.value
    
    response_data = {
        "key": config.key,
        "value": config.value
    }

    db.commit()
    try:
        invalidate_resource(current_schema, "pos_init")
        invalidate_resource(current_schema, "pos-init")
        invalidate_resource(current_schema, "business_config")
    except Exception:
        pass
    # db.refresh(config)
    return response_data

@router.post("/batch")
def set_configs_batch(
    configs: Dict[str, str], 
    db: Session = Depends(get_db),
    user: Any = Depends(admin_only)  # Protect mutation
):
    """Set multiple configuration values at once"""
    # SECURITY: Check Tenant Context (Prevent UndefinedTable in public)
    from ..tenant_context import get_tenant_schema
    current_schema = get_tenant_schema()
    
    if current_schema == 'public':
         return {"message": "Configurations ignored in public context", "data": configs}

    results = {}
    for key, value in configs.items():
        config = db.query(models.BusinessConfig).get(key)
        if not config:
            config = models.BusinessConfig(key=key, value=str(value))
            db.add(config)
        else:
            config.value = str(value)
        results[key] = value
    
    db.commit()
    return {"message": "Configurations updated", "data": results}

@router.get("/tax-rate/default", response_model=Dict[str, Decimal])
def get_default_tax_rate(db: Session = Depends(get_db)):
    """Get the default tax rate percentage"""
    # SECURITY: Check Tenant Context
    from ..tenant_context import get_tenant_schema
    current_schema = get_tenant_schema()
    
    if current_schema == 'public':
         return {"rate": Decimal("0.00")}

    config = db.query(models.BusinessConfig).get("default_tax_rate")
    if not config or not config.value:
        return {"rate": Decimal("0.00")}
    try:
        return {"rate": Decimal(config.value)}
    except (ValueError, InvalidOperation, TypeError):
        return {"rate": Decimal("0.00")}

@router.put("/tax-rate/default")
def set_default_tax_rate(
    rate_data: Dict[str, Any], 
    db: Session = Depends(get_db),
    user: Any = Depends(admin_only)
):
    """Set the default tax rate percentage"""
    try:
        rate_val = Decimal(str(rate_data.get("rate", 0)))
        key = "default_tax_rate"
        
        config = db.query(models.BusinessConfig).get(key)
        if not config:
            config = models.BusinessConfig(key=key, value=str(rate_val))
            db.add(config)
        else:
            config.value = str(rate_val)
        
        db.commit()
        return {"message": "Default tax rate updated", "rate": rate_val}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

def init_exchange_rates(db: Session):
    """Seed default exchange rates if table is empty"""
    existing_count = db.query(models.ExchangeRate).count()
    
    if existing_count > 0:
        print(f"[OK] Exchange rates already seeded ({existing_count} rates found)")
        return
    
    print("[SEED] Seeding default exchange rates...")
    
    default_rates = [
        models.ExchangeRate(
            name="USD Default",
            currency_code="USD",
            currency_symbol="$",
            rate=1.00,
            is_default=True,
            is_active=True
        ),
        models.ExchangeRate(
            name="BCV",
            currency_code="VES",
            currency_symbol="Bs",
            rate=45.00,
            is_default=True,
            is_active=True
        ),
        models.ExchangeRate(
            name="Paralelo",
            currency_code="VES",
            currency_symbol="Bs",
            rate=52.00,
            is_default=False,
            is_active=True
        ),
        models.ExchangeRate(
            name="TRM",
            currency_code="COP",
            currency_symbol="COP",
            rate=4200.00,
            is_default=True,
            is_active=True
        ),
        models.ExchangeRate(
            name="Euro",
            currency_code="EUR",
            currency_symbol="€",
            rate=0.92,
            is_default=True,
            is_active=False
        ),
    ]
    
    for rate in default_rates:
        db.add(rate)
    
    db.commit()
    print(f"[OK] Seeded {len(default_rates)} default exchange rates")

def init_currencies(db: Session):
    """Seed default currencies if they don't exist"""
    print("[SEED] Verificando monedas (Currencies)...")
    
    currencies_data = [
        {"name": "Dólar Americano", "symbol": "USD", "rate": 1.00, "is_anchor": True, "is_active": True},
        {"name": "Bolívar Venezolano", "symbol": "VES", "rate": 60.00, "is_anchor": False, "is_active": True},
        {"name": "Peso Colombiano", "symbol": "COP", "rate": 4200.00, "is_anchor": False, "is_active": True},
    ]
    
    seeded_count = 0
    for curr_data in currencies_data:
        exists = db.query(models.Currency).filter(models.Currency.symbol == curr_data["symbol"]).first()
        if not exists:
            db_curr = models.Currency(**curr_data)
            db.add(db_curr)
            seeded_count += 1
            print(f"[SEED] Creando moneda faltante: {curr_data['symbol']}")
    
    if seeded_count > 0:
        db.commit()
        print(f"[OK] Se han creado {seeded_count} monedas faltantes.")
    else:
        print("[OK] Todas las monedas base existen.")

@router.get("/debug/seed")
def debug_seed_currencies(db: Session = Depends(get_db)):
    """Force seed check and return status"""
    from ..tenant_context import get_tenant_schema
    
    schema = get_tenant_schema()
    if schema == "public" or schema is None:
        return {
             "status": "skipped", 
             "reason": "Cannot seed currencies in public schema. This endpoint is for tenant contexts only."
        }

    try:
        count_before = db.query(models.Currency).count()
        init_currencies(db)
        count_after = db.query(models.Currency).count()
        # Also return the actual data to see what the API sees
        data = db.query(models.Currency).all()
        return {
            "count_before": count_before,
            "count_after": count_after,
            "seeded": count_after > count_before,
            "data": data
        }
    except Exception as e:
        print(f"❌ Error in debug_seed: {e}")
        return {"status": "error", "detail": str(e)}


# ========================================
# SUBSCRIPTION STATUS (Tenant-Facing)
# ========================================

@router.get("/subscription")


@router.post("/warranty-format/upload")
async def upload_warranty_format(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: Any = Depends(admin_only)
):
    import os
    from ..tenant_context import get_tenant_schema
    schema = get_tenant_schema()
    if schema == "public":
        raise HTTPException(status_code=400, detail="Invalid context")
    
    upload_dir = f"/app/media/{schema}/warranty"
    os.makedirs(upload_dir, exist_ok=True)
    
    import time
    # Limpiar archivos viejos para evitar duplicados
    for old_file in os.listdir(upload_dir):
        if old_file.startswith("format_"):
            try:
                os.remove(os.path.join(upload_dir, old_file))
            except:
                pass

    file_ext = os.path.splitext(file.filename)[1]
    timestamp = int(time.time())
    filename = f"format_{timestamp}{file_ext}"
    file_path = os.path.join(upload_dir, filename)
    
    with open(file_path, "wb") as buffer:
        file_content = await file.read()
        buffer.write(file_content)
    
    val = f"/media/{schema}/warranty/{filename}"
    config = db.query(models.BusinessConfig).get("warranty_format_url")
    if not config:
        db.add(models.BusinessConfig(key="warranty_format_url", value=val))
    else:
        config.value = val
    db.commit()
    return {"url": val}

def get_subscription_status(
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user),
):
    """Returns subscription status for the current tenant. Accessible by any authenticated tenant user."""
    from datetime import datetime, timezone
    from ..tenant_context import get_tenant_schema
    from ..models.tenant import Tenant

    current_schema = get_tenant_schema()
    tenant = db.query(Tenant).filter(Tenant.schema_name == current_schema).first()

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    now = datetime.now(timezone.utc)

    if tenant.license_type == "lifetime":
        return {
            "license_type": "lifetime",
            "is_demo": tenant.is_demo,
            "days_remaining": None,
            "expiry_date": None,
            "is_expired": False,
            "is_active": tenant.is_active,
            "grace_period_active": False,
        }

    expiry = tenant.trial_ends_at if tenant.license_type == "trial" else tenant.subscription_expires_at

    if expiry:
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        delta = expiry - now
        days_remaining = max(0, delta.days)
        is_expired = expiry < now
        grace_period_active = is_expired and (now - expiry).days <= 5
    else:
        days_remaining = None
        is_expired = False
        grace_period_active = False

    return {
        "license_type": tenant.license_type,
        "is_demo": tenant.is_demo,
        "days_remaining": days_remaining,
        "expiry_date": expiry.isoformat() if expiry else None,
        "is_expired": is_expired,
        "is_active": tenant.is_active,
        "grace_period_active": grace_period_active,
        "license_blocked_reason": tenant.license_blocked_reason,
    }


# ─── Auto Print Ticket Toggle ─────────────────────────────────────────────────
@router.get("/pos/auto-print-ticket")
def get_auto_print_ticket(db: Session = Depends(get_db)):
    """Obtener el estado del auto-print de ticket al confirmar venta."""
    config = db.query(models.BusinessConfig).get("auto_print_ticket")
    return {"auto_print_ticket": config.value == "true" if config else False}


class AutoPrintTicketPayload(BaseModel):
    enabled: bool = False

@router.post("/pos/auto-print-ticket")
def set_auto_print_ticket(
    payload: AutoPrintTicketPayload,
    db: Session = Depends(get_db),
    user: Any = Depends(admin_only),
):
    """Activar/desactivar impresión automática de ticket al confirmar venta. Solo ADMIN."""
    enabled = payload.enabled
    config = db.query(models.BusinessConfig).get("auto_print_ticket")
    if config:
        config.value = "true" if enabled else "false"
    else:
        db.add(models.BusinessConfig(key="auto_print_ticket", value="true" if enabled else "false"))
    db.commit()
    return {"auto_print_ticket": enabled}

@router.post("/business/upload-logo")
async def upload_business_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: Any = Depends(admin_only)
):
    """Sube el logo del negocio y guarda la URL en business_config.business_logo"""
    import os, time
    from PIL import Image
    from ..tenant_context import get_tenant_schema

    schema = get_tenant_schema()
    if schema == "public":
        raise HTTPException(status_code=400, detail="Invalid context")

    # Validar extensión
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in {".png", ".jpg", ".jpeg", ".webp"}:
        raise HTTPException(status_code=400, detail="Formato no permitido. Use PNG, JPG o WEBP.")

    raw = await file.read()
    if len(raw) < 50:
        raise HTTPException(status_code=400, detail="Archivo inválido")
    if len(raw) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Imagen demasiado grande (máx 2 MB)")

    upload_dir = f"/app/media/{schema}/business"
    os.makedirs(upload_dir, exist_ok=True)

    # Limpiar logos viejos
    for old_file in os.listdir(upload_dir):
        if old_file.startswith("logo_"):
            try: os.remove(os.path.join(upload_dir, old_file))
            except: pass

    timestamp = int(time.time())
    filename = f"logo_{timestamp}.png"
    file_path = os.path.join(upload_dir, filename)

    # Procesar con PIL: convertir a PNG y limitar tamaño max 600x600
    try:
        from io import BytesIO
        img = Image.open(BytesIO(raw))
        if img.mode not in ("RGBA", "RGB"):
            img = img.convert("RGBA")
        img.thumbnail((600, 600))
        img.save(file_path, "PNG", optimize=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al procesar imagen: {e}")

    url = f"/media/{schema}/business/{filename}"
    cfg = db.query(models.BusinessConfig).filter(
        models.BusinessConfig.key == "business_logo"
    ).first()
    if cfg:
        cfg.value = url
    else:
        db.add(models.BusinessConfig(key="business_logo", value=url))
    db.commit()

    return {"success": True, "url": url}


@router.delete("/business/logo")
def delete_business_logo(
    db: Session = Depends(get_db),
    user: Any = Depends(admin_only)
):
    """Elimina el logo del negocio."""
    import os
    from ..tenant_context import get_tenant_schema
    schema = get_tenant_schema()
    if schema == "public":
        raise HTTPException(status_code=400, detail="Invalid context")

    cfg = db.query(models.BusinessConfig).filter(
        models.BusinessConfig.key == "business_logo"
    ).first()
    if cfg and cfg.value:
        # Borrar archivo físico (best-effort)
        try:
            file_path = cfg.value.replace("/media/", "/app/media/")
            if os.path.exists(file_path):
                os.remove(file_path)
        except: pass
        cfg.value = ""
        db.commit()
    return {"success": True}

