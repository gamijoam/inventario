from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database.db import get_db
from ..models import models
from .. import schemas
from sqlalchemy.orm import joinedload

router = APIRouter(
    prefix="/quotes",
    tags=["quotes"]
)

@router.post("", response_model=schemas.QuoteRead)
def create_quote(quote_data: schemas.QuoteCreate, db: Session = Depends(get_db)):
    # Create Header
    new_quote = models.Quote(
        customer_id=quote_data.customer_id,
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
    db.refresh(new_quote)
    # Return limited data compliant with schema
    # Pydantic will handle date conversion if models.date is datetime
    return new_quote

@router.get("", response_model=List[schemas.QuoteRead])
def read_quotes(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    # Optimize query to load customer
    return db.query(models.Quote)\
        .options(
            joinedload(models.Quote.customer),
            joinedload(models.Quote.details)
        )\
        .order_by(models.Quote.date.desc())\
        .offset(skip).limit(limit).all()


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
    
    db.commit()
    db.refresh(db_quote)
    return db_quote


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
