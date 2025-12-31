from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database.db import get_db
from ..models import models
from .. import schemas
from ..websocket.manager import manager
from ..websocket.events import WebSocketEvents

router = APIRouter(
    prefix="/customers",
    tags=["customers"]
)

@router.get("/", response_model=List[schemas.CustomerRead])
@router.get("", response_model=List[schemas.CustomerRead], include_in_schema=False)
def read_customers(
    skip: int = 0, 
    limit: int = 100, 
    q: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Customer)
    if q:
        search = f"%{q}%"
        query = query.filter(
            (models.Customer.name.ilike(search)) | 
            (models.Customer.id_number.ilike(search))
        )
    return query.offset(skip).limit(limit).all()

@router.post("/", response_model=schemas.CustomerRead)
@router.post("", response_model=schemas.CustomerRead, include_in_schema=False)
async def create_customer(customer: schemas.CustomerCreate, db: Session = Depends(get_db)):
    # Check duplicate ID
    if customer.id_number:
        exists = db.query(models.Customer).filter(models.Customer.id_number == customer.id_number).first()
        if exists:
            raise HTTPException(status_code=400, detail="Customer with this ID Number already exists")
            
    db_customer = models.Customer(**customer.model_dump())
    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)
    
    # Broadcast customer created
    await manager.broadcast(WebSocketEvents.CUSTOMER_CREATED, {
        "id": db_customer.id,
        "name": db_customer.name,
        "id_number": db_customer.id_number,
        "credit_limit": float(db_customer.credit_limit) if db_customer.credit_limit else 0.0
    })
    
    return db_customer

@router.put("/{customer_id}", response_model=schemas.CustomerRead)
async def update_customer(customer_id: int, customer_data: schemas.CustomerCreate, db: Session = Depends(get_db)):
    db_customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not db_customer:
        raise HTTPException(status_code=404, detail="Customer not found")
        
    for key, value in customer_data.model_dump(exclude_unset=True).items():
        setattr(db_customer, key, value)
        
    db.commit()
    db.refresh(db_customer)
    
    # Broadcast customer updated
    await manager.broadcast(WebSocketEvents.CUSTOMER_UPDATED, {
        "id": db_customer.id,
        "name": db_customer.name,
        "id_number": db_customer.id_number,
        "credit_limit": float(db_customer.credit_limit) if db_customer.credit_limit else 0.0
    })
    
    return db_customer

@router.get("/{customer_id}/debt")
def get_customer_debt(customer_id: int, db: Session = Depends(get_db)):
    # Calculate Total Credit Sales
    # Note: Logic assumes 'is_credit=True' sales contribute to debt.
    # We might need to handle 'paid' status if we want to ignore fully paid ones,
    # but for a running balance, usually we sum ALL credit sales and subtract ALL payments.
    
    # 1. Sum of all Credit Sales for this customer
    # We must be careful not to double count if we have a different tracking system.
    # Assuming: total_amount_bs or total_amount depending on currency?
    # For now, let's standardise on USD (total_amount).
    
    from sqlalchemy import func
    
    total_credit_sales = db.query(func.sum(models.Sale.total_amount))\
        .filter(models.Sale.customer_id == customer_id)\
        .filter(models.Sale.is_credit == True)\
        .scalar() or 0.0
        
    # 2. Sum of all Payments
    # 2. Sum of all Payments (Converted to USD)
    # We must retrieve payments and sum them manually to handle conversion if DB is mixed currency
    payments = db.query(models.Payment).filter(models.Payment.customer_id == customer_id).all()
    total_payments_usd = 0.0
    
    for p in payments:
        if p.currency == "Bs" and p.exchange_rate_used > 0:
            total_payments_usd += (p.amount / p.exchange_rate_used)
        else:
            total_payments_usd += p.amount
            
    debt = total_credit_sales - total_payments_usd
    return {"debt": round(debt, 2)} # Round for clean display

@router.get("/{customer_id}/financial-status")
def get_customer_financial_status(customer_id: int, db: Session = Depends(get_db)):
    """
    Get comprehensive financial status for a customer including:
    - Total debt (balance_pending from unpaid credit sales)
    - Credit limit and available credit
    - Overdue invoices count and amount
    - Block status
    """
    from sqlalchemy import func
    from datetime import datetime
    
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Calculate total debt from balance_pending of unpaid credit sales
    total_debt = db.query(func.sum(models.Sale.balance_pending)).filter(
        models.Sale.customer_id == customer_id,
        models.Sale.is_credit == True,
        models.Sale.paid == False
    ).scalar() or 0.0
    
    # Count and sum overdue invoices
    now = datetime.now()
    overdue_invoices = db.query(models.Sale).filter(
        models.Sale.customer_id == customer_id,
        models.Sale.is_credit == True,
        models.Sale.paid == False,
        models.Sale.due_date < now
    ).all()
    
    overdue_count = len(overdue_invoices)
    overdue_amount = sum(sale.balance_pending or 0 for sale in overdue_invoices)
    
    # Calculate available credit
    available_credit = max(0, customer.credit_limit - total_debt)
    
    return {
        "customer_id": customer.id,
        "customer_name": customer.name,
        "total_debt": round(total_debt, 2),
        "credit_limit": round(customer.credit_limit, 2),
        "available_credit": round(available_credit, 2),
        "overdue_invoices": overdue_count,
        "overdue_amount": round(overdue_amount, 2),
        "is_blocked": customer.is_blocked,
        "payment_term_days": customer.payment_term_days
    }

@router.delete("/{customer_id}")
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    """Delete a customer"""
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Check if customer has sales
    has_sales = db.query(models.Sale).filter(models.Sale.customer_id == customer_id).first()
    if has_sales:
        raise HTTPException(
            status_code=400, 
            detail="No se puede eliminar el cliente porque tiene ventas registradas"
        )
    
    db.delete(customer)
    db.commit()
    return {"status": "success", "message": "Cliente eliminado"}

@router.post("/{customer_id}/payments")
def create_customer_payment(customer_id: int, payment: schemas.CustomerPaymentCreate, db: Session = Depends(get_db)):
    db_customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not db_customer:
        raise HTTPException(status_code=404, detail="Customer not found")
        
    new_payment = models.Payment(
        customer_id=customer_id,
        amount=payment.amount,
        description=payment.description,
        payment_method=payment.payment_method,
        currency=payment.currency,
        exchange_rate_used=payment.exchange_rate,
        # Calculate amount_bs if currency is Bs, or convert if needed.
        # For simple storage, we store what was paid.
        amount_bs = payment.amount if payment.currency == "Bs" else (payment.amount * payment.exchange_rate)
    )
    db.add(new_payment)
    db.commit()
    return {"status": "success"}
