from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import requests
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel
from ..database.db import get_db
from ..models import models
from .. import schemas
from ..dependencies import admin_only
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
            "ferreteria": True 
        }
    else:
        # For a Real Tenant, start with Server Capabilities
        modules = {
            "restaurant": settings.MODULE_RESTAURANT_ENABLED,
            "laundry": settings.MODULE_LAUNDRY_ENABLED,
            "services": settings.MODULE_SERVICES_ENABLED,
            "ferreteria": True
        }
    
    # 3. DB Entitlements (Override for Tenants)
    tenant_found = False
    
    if current_schema != "public":
        try:
            # Query tenant in public schema table
            tenant_obj = db.query(Tenant).filter(Tenant.schema_name == current_schema).first()
            
            if tenant_obj:
                tenant_found = True
                tenant_name = tenant_obj.name
                
                # REFACTOR: Use the NEW boolean columns instead of .env or JSON config
                modules = {
                    "restaurant": tenant_obj.has_restaurant_module,
                    "laundry": tenant_obj.has_laundry_module,
                    "services": tenant_obj.has_services_module,
                    "ferreteria": tenant_obj.has_hardware_module
                }
                
                # Falling back to JSON config if all booleans are False (for existing tenants)
                if not any(modules.values()) and tenant_obj.config:
                    db_modules = tenant_obj.config.get("modules", {})
                    for mod, enabled in db_modules.items():
                        if mod in modules:
                            modules[mod] = enabled
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
            "ferreteria": True 
        }

    return {
        "modules": modules,
        "tenant_name": tenant_name,
        "tenant": current_schema 
    }

# ========================================
# EXCHANGE RATE MANAGEMENT (NEW SYSTEM)
# ========================================

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

    query = db.query(models.ExchangeRate)
    
    if currency_code:
        query = query.filter(models.ExchangeRate.currency_code == currency_code)
    if is_active is not None:
        query = query.filter(models.ExchangeRate.is_active == is_active)
    
    return query.order_by(models.ExchangeRate.currency_code, models.ExchangeRate.is_default.desc()).all()


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
    response_data = {
        "id": new_rate.id,
        "name": new_rate.name,
        "rate": new_rate.rate,
        "currency_code": new_rate.currency_code,
        "currency_symbol": new_rate.currency_symbol,
        "is_default": new_rate.is_default,
        "is_active": new_rate.is_active,
        "created_at": new_rate.created_at,
        "updated_at": new_rate.updated_at
    }
    
    db.commit()
    # db.refresh(new_rate)
    
    # Broadcast event
    await manager.broadcast(WebSocketEvents.EXCHANGE_RATE_CREATED, {
        "id": response_data["id"],
        "name": response_data["name"],
        "rate": response_data["rate"],
        "currency_code": response_data["currency_code"],
        "is_default": response_data["is_default"],
        "is_active": response_data["is_active"]
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
            return round(float(raw), 4)
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
    
    # Update fields
    for key, value in rate_data.dict(exclude_unset=True).items():
        setattr(rate, key, value)
    
    # Capture data
    response_data = {
        "id": rate.id,
        "name": rate.name,
        "rate": rate.rate,
        "currency_code": rate.currency_code,
        "currency_symbol": rate.currency_symbol,
        "is_default": rate.is_default,
        "is_active": rate.is_active,
        "created_at": rate.created_at,
        "updated_at": rate.updated_at
    }

    db.commit()
    # db.refresh(rate)
    
    # AUDIT LOG
    from ..audit_utils import log_action
    import json
    # Since we didn't capture 'old_state' easily, we'll log the new state.
    # Ideally we'd do the diff, but this is a quick action.
    log_action(db, user_id=1, action="UPDATE", table_name="exchange_rates", record_id=response_data["id"], changes=json.dumps({"rate": response_data["rate"], "is_active": response_data["is_active"]}, default=str))

    # Broadcast event
    await manager.broadcast(WebSocketEvents.EXCHANGE_RATE_UPDATED, {
        "id": response_data["id"],
        "name": response_data["name"],
        "rate": response_data["rate"], # Float
        "currency_code": response_data["currency_code"],
        "is_default": response_data["is_default"],
        "is_active": response_data["is_active"]
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

@router.get("/business", response_model=schemas.BusinessInfo)
def get_business_info(db: Session = Depends(get_db)):
    """Get aggregated business information"""
    # SECURITY: Check Tenant Context
    from ..tenant_context import get_tenant_schema
    current_schema = get_tenant_schema()
    
    if current_schema == 'public':
        # Return empty/default info for public context
        return schemas.BusinessInfo(
            name="",
            document_id="",
            address="",
            phone="",
            email="",
            ticket_template="",
            default_tax_rate=Decimal("0.00")
        )

    keys = ["business_name", "business_doc", "business_address", "business_phone", "business_email", "default_tax_rate"]
    configs = db.query(models.BusinessConfig).filter(models.BusinessConfig.key.in_(keys)).all()
    config_dict = {c.key: c.value for c in configs}
    
    return schemas.BusinessInfo(
        name=config_dict.get("business_name", ""),
        document_id=config_dict.get("business_doc", ""),
        address=config_dict.get("business_address", ""),
        phone=config_dict.get("business_phone", ""),
        email=config_dict.get("business_email", ""),
        ticket_template=config_dict.get("ticket_template", ""),
        default_tax_rate=Decimal(config_dict.get("default_tax_rate", "0.00"))
    )

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
    
    db.commit()
    
    # Return updated info
    return get_business_info(db)

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
    except:
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
