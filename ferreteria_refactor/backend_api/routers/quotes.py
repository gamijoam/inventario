from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database.db import get_db
from ..models import models
from .. import schemas
from sqlalchemy.orm import joinedload
from ..template_presets import get_quote_58_template, get_quote_80_template
from ..dependencies import get_current_active_user

router = APIRouter(
    prefix="/quotes",
    tags=["quotes"]
)

@router.post("", response_model=schemas.QuoteRead)
def create_quote(
    quote_data: schemas.QuoteCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    # Create Header
    new_quote = models.Quote(
        customer_id=quote_data.customer_id,
        user_id=current_user.id,
        total_amount=quote_data.total_amount,
        notes=quote_data.notes
    )
    db.add(new_quote)
    db.flush()

    # Create Details
    for item in quote_data.items:
        detail = models.QuoteDetail(
            quote_id=new_quote.id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=item.unit_price,
            subtotal=item.subtotal,
            is_box_sale=item.is_box
        )
        db.add(detail)
    
    db.commit()
    # db.refresh(new_quote)
    
    # Manually construct response
    response_data = {
        "id": new_quote.id,
        "customer_id": new_quote.customer_id,
        "user_id": new_quote.user_id,
        "total_amount": new_quote.total_amount,
        "notes": new_quote.notes,
        "date": new_quote.date,
        "status": new_quote.status
    }
    
    return response_data

@router.get("")
def read_quotes(skip: int = 0, limit: int = Query(default=500, le=5000), db: Session = Depends(get_db)):
    # Optimize query to load customer and user (creator)
    base_query = db.query(models.Quote)
    total = base_query.count()
    items = base_query\
        .options(
            joinedload(models.Quote.customer),
            joinedload(models.Quote.user),
            joinedload(models.Quote.details)
        )\
        .order_by(models.Quote.date.desc())\
        .offset(skip).limit(limit).all()
    return {"items": items, "total": total, "has_more": (skip + limit) < total}


@router.get("/{quote_id}", response_model=schemas.QuoteReadWithDetails)
def read_quote_details(quote_id: int, db: Session = Depends(get_db)):
    # Optimize query to load details and products within details
    quote = db.query(models.Quote)\
        .options(
            joinedload(models.Quote.customer),
            joinedload(models.Quote.details).joinedload(models.QuoteDetail.product)
        )\
        .filter(models.Quote.id == quote_id).first()
        
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    return quote

@router.put("/{quote_id}/convert")
def mark_quote_converted(quote_id: int, db: Session = Depends(get_db)):
    quote = db.query(models.Quote).filter(models.Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    quote.status = "CONVERTED"
    db.commit()
    return {"status": "success", "message": "Quote converted to sale"}

@router.put("/{quote_id}", response_model=schemas.QuoteRead)
def update_quote(quote_id: int, quote_data: schemas.QuoteCreate, db: Session = Depends(get_db)):
    # Fetch existing header
    db_quote = db.query(models.Quote).filter(models.Quote.id == quote_id).first()
    if not db_quote:
        raise HTTPException(status_code=404, detail="Quote not found")
        
    if db_quote.status != "PENDING":
        raise HTTPException(status_code=400, detail="Cannot edit a converted or expired quote")

    # Update Header
    db_quote.customer_id = quote_data.customer_id
    db_quote.total_amount = quote_data.total_amount
    db_quote.notes = quote_data.notes
    
    # Delete existing details
    db.query(models.QuoteDetail).filter(models.QuoteDetail.quote_id == quote_id).delete()
    
    # Add new details
    for item in quote_data.items:
        detail = models.QuoteDetail(
            quote_id=db_quote.id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=item.unit_price,
            subtotal=item.subtotal,
            is_box_sale=item.is_box
        )
        db.add(detail)
    
    # Capture data
    response_data = {
        "id": db_quote.id,
        "customer_id": db_quote.customer_id,
        "total_amount": db_quote.total_amount,
        "notes": db_quote.notes,
        "date": db_quote.date,
        "status": db_quote.status
    }

    db.commit()
    # db.refresh(db_quote)
    return response_data


@router.post("/{quote_id}/duplicate", response_model=schemas.QuoteRead)
def duplicate_quote(quote_id: int, db: Session = Depends(get_db)):
    """Duplica una cotización existente creando una nueva en estado PENDING."""
    original = db.query(models.Quote).options(
        joinedload(models.Quote.details)
    ).filter(models.Quote.id == quote_id).first()
    if not original:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")

    new_quote = models.Quote(
        customer_id=original.customer_id,
        user_id=original.user_id,
        total_amount=original.total_amount,
        notes=original.notes,
        status="PENDING",
        date=datetime.utcnow(),
        valid_until=original.valid_until,
        tenant_id=original.tenant_id,
    )
    db.add(new_quote)
    db.flush()

    for detail in original.details:
        new_detail = models.QuoteDetail(
            quote_id=new_quote.id,
            product_id=detail.product_id,
            quantity=detail.quantity,
            unit_price=detail.unit_price,
            subtotal=detail.subtotal,
        )
        db.add(new_detail)

    db.flush()
    result = schemas.QuoteRead(
        id=new_quote.id,
        customer_id=new_quote.customer_id,
        user_id=new_quote.user_id,
        total_amount=new_quote.total_amount,
        notes=new_quote.notes,
        status=new_quote.status,
        date=new_quote.date,
        valid_until=new_quote.valid_until,
    )
    db.commit()
    return result


@router.get("/{quote_id}/print/thermal")
def get_quote_thermal_payload(quote_id: int, width: str = None, db: Session = Depends(get_db)):
    """
    Generate a thermal print payload (template + context) for a quote.
    The frontend sends this payload to the Hardware Bridge via printerService.printRaw().
    Uses the same pattern as SalesService.get_sale_print_payload().
    """
    # Load quote with all relations
    quote = db.query(models.Quote)\
        .options(
            joinedload(models.Quote.customer),
            joinedload(models.Quote.details).joinedload(models.QuoteDetail.product)
        )\
        .filter(models.Quote.id == quote_id).first()

    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    # Get business config (same as sales_service pattern)
    business_config = {}
    configs = db.query(models.BusinessConfig).all()
    for config in configs:
        business_config[config.key] = config.value

    # Quotes are always in anchor currency (USD)
    currency_symbol = "$"

    # Build context
    context = {
        "business": {
            "name": business_config.get("business_name", "MI NEGOCIO"),
            "document_id": business_config.get("business_doc", ""),
            "address": business_config.get("business_address", ""),
            "phone": business_config.get("business_phone", ""),
        },
        "quote": {
            "id": quote.id,
            "date": quote.date.strftime("%d/%m/%Y %H:%M") if quote.date else "",
            "customer": {
                "name": quote.customer.name if quote.customer else None,
                "id_number": quote.customer.id_number if quote.customer else None,
                "phone": quote.customer.phone if quote.customer else None,
            } if quote.customer else None,
            "items": [
                {
                    "product": {
                        "name": detail.product.name if detail.product else "Producto",
                        "sku": detail.product.sku if detail.product else "",
                    },
                    "quantity": float(detail.quantity),
                    "unit_price": float(detail.unit_price),
                    "subtotal": float(detail.subtotal),
                }
                for detail in (quote.details or [])
            ],
            "total": float(quote.total_amount),
            "notes": quote.notes or "",
        },
        "currency_symbol": currency_symbol,
    }

    # Choose template: explicit ?width= param takes priority, then business config
    effective_width = width if width in ("58", "80") else business_config.get("paper_width", "58")
    template = get_quote_80_template() if effective_width == "80" else get_quote_58_template()

    return {
        "status": "ready",
        "template": template,
        "context": context,
    }


@router.delete("/{quote_id}")
def delete_quote(quote_id: int, db: Session = Depends(get_db)):
    quote = db.query(models.Quote).filter(models.Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
        
    # Delete associated details first (though cascade might handle it, explicit is safer)
    db.query(models.QuoteDetail).filter(models.QuoteDetail.quote_id == quote_id).delete()
    db.delete(quote)
    db.commit()
    return {"status": "success", "message": "Quote deleted"}
