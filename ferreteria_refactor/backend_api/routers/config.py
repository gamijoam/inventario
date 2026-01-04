from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import requests
from decimal import Decimal
from datetime import datetime
from ..database.db import get_db
from ..models import models
from .. import schemas
from ..dependencies import admin_only
from ..websocket.manager import manager
from ..websocket.events import WebSocketEvents
from ..template_presets import get_all_presets, get_preset_by_id
from ..config import settings

router = APIRouter(
    prefix="/config",
    tags=["config"]
)

@router.get("/public")
def get_public_config():
    """Get public configuration and feature flags"""
    return {
        "modules": {
            "restaurant": settings.MODULE_RESTAURANT_ENABLED,
            "services": settings.MODULE_SERVICES_ENABLED
        }
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
    db.commit()
    db.refresh(new_rate)
    
    # Broadcast event
    await manager.broadcast(WebSocketEvents.EXCHANGE_RATE_CREATED, {
        "id": new_rate.id,
        "name": new_rate.name,
        "rate": new_rate.rate,
        "currency_code": new_rate.currency_code,
        "is_default": new_rate.is_default,
        "is_active": new_rate.is_active
    })
    
    return new_rate


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
    
    db.commit()
    db.refresh(rate)
    
    # AUDIT LOG
    from ..audit_utils import log_action
    import json
    # Since we didn't capture 'old_state' easily, we'll log the new state.
    # Ideally we'd do the diff, but this is a quick action.
    log_action(db, user_id=1, action="UPDATE", table_name="exchange_rates", record_id=rate.id, changes=json.dumps({"rate": rate.rate, "is_active": rate.is_active}, default=str))

    # Broadcast event
    await manager.broadcast(WebSocketEvents.EXCHANGE_RATE_UPDATED, {
        "id": rate.id,
        "name": rate.name,
        "rate": rate.rate, # Float
        "currency_code": rate.currency_code,
        "is_default": rate.is_default,
        "is_active": rate.is_active
    })
    
    return rate


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
    
    rate.is_active = False
    db.commit()
    
    # Broadcast event
    await manager.broadcast(WebSocketEvents.EXCHANGE_RATE_DELETED, {
        "id": rate.id
    })
    
    return {"message": "Exchange rate deactivated successfully"}

# ========================================
# BUSINESS CONFIGURATION (GENERIC)
# ========================================

@router.get("/business", response_model=schemas.BusinessInfo)
def get_business_info(db: Session = Depends(get_db)):
    """Get aggregated business information"""
    keys = ["business_name", "business_doc", "business_address", "business_phone", "business_email"]
    configs = db.query(models.BusinessConfig).filter(models.BusinessConfig.key.in_(keys)).all()
    config_dict = {c.key: c.value for c in configs}
    
    return schemas.BusinessInfo(
        name=config_dict.get("business_name", ""),
        document_id=config_dict.get("business_doc", ""),
        address=config_dict.get("business_address", ""),
        phone=config_dict.get("business_phone", ""),
        email=config_dict.get("business_email", ""),
        ticket_template=config_dict.get("ticket_template", "")  # NEW
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
        "ticket_template": info.ticket_template  # NEW
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
    db.commit()
    db.refresh(db_currency)
    return db_currency

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
        
    db.commit()
    db.refresh(db_currency)
    return db_currency

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
    config = db.query(models.BusinessConfig).get(key)
    if not config:
        config = models.BusinessConfig(key=key, value=config_data.value)
        db.add(config)
    else:
        config.value = config_data.value
    
    db.commit()
    db.refresh(config)
    return config

@router.post("/batch")
def set_configs_batch(
    configs: Dict[str, str], 
    db: Session = Depends(get_db),
    user: Any = Depends(admin_only)  # Protect mutation
):
    """Set multiple configuration values at once"""
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
    """Seed default currencies if table is empty"""
    if db.query(models.Currency).first():
        return
    
    currencies = [
        {"name": "Dólar Americano", "symbol": "USD", "rate": 1.00, "is_anchor": True, "is_active": True},
        {"name": "Bolívar Venezolano", "symbol": "VES", "rate": 60.00, "is_anchor": False, "is_active": True},
        {"name": "Peso Colombiano", "symbol": "COP", "rate": 4200.00, "is_anchor": False, "is_active": True},
        {"name": "Euro", "symbol": "EUR", "rate": 1.10, "is_anchor": False, "is_active": False},
        {"name": "Peso Argentino", "symbol": "ARS", "rate": 1000.00, "is_anchor": False, "is_active": False},
        {"name": "Peso Mexicano", "symbol": "MXN", "rate": 17.00, "is_anchor": False, "is_active": False},
        {"name": "Sol Peruano", "symbol": "PEN", "rate": 3.70, "is_anchor": False, "is_active": False},
    ]
    
    for curr in currencies:
        db_curr = models.Currency(**curr)
        db.add(db_curr)
    
    db.commit()
    print("[OK] Currencies seeded successfully")

@router.get("/debug/seed")
def debug_seed_currencies(db: Session = Depends(get_db)):
    """Force seed check and return status"""
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
