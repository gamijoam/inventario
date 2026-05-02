from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from typing import List, Optional
from pydantic import BaseModel
from decimal import Decimal
from datetime import datetime

from ..database.db import get_db
from ..models import models
from ..dependencies import any_authenticated, warehouse_or_admin

router = APIRouter(
    prefix="/external-financing",
    tags=["external-financing"]
)

# ─── Schemas ──────────────────────────────────────────────────────────────────

class ExternalFinancingCreate(BaseModel):
    sale_id: int
    customer_id: Optional[int] = None
    financer_name: str
    financer_payment_method_id: Optional[int] = None
    total_price: Decimal
    initial_payment: Decimal = Decimal("0")
    initial_currency: str = "USD"
    financed_amount: Decimal = Decimal("0")
    installments: Optional[int] = None
    installment_amount: Optional[Decimal] = None
    installment_frequency: Optional[str] = None  # semanal/quincenal/mensual
    notes: Optional[str] = None

class ExternalFinancingUpdate(BaseModel):
    financer_payment_status: Optional[str] = None  # PENDING/PARTIAL/COMPLETED
    financer_paid_amount: Optional[Decimal] = None
    installments: Optional[int] = None
    installment_amount: Optional[Decimal] = None
    installment_frequency: Optional[str] = None
    notes: Optional[str] = None

class CustomerBasic(BaseModel):
    id: int
    name: str
    phone: Optional[str] = None
    class Config:
        from_attributes = True

class SaleBasic(BaseModel):
    id: int
    date: datetime
    total_amount: Decimal
    class Config:
        from_attributes = True

class ExternalFinancingRead(BaseModel):
    id: int
    sale_id: int
    customer_id: Optional[int]
    financer_name: str
    financer_payment_method_id: Optional[int]
    total_price: Decimal
    initial_payment: Decimal
    initial_currency: str
    financed_amount: Decimal
    installments: Optional[int]
    installment_amount: Optional[Decimal]
    installment_frequency: Optional[str]
    financer_payment_status: str
    financer_paid_amount: Decimal
    notes: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    # Nested
    customer: Optional[CustomerBasic] = None
    sale: Optional[SaleBasic] = None
    class Config:
        from_attributes = True

class ExternalFinancingSummary(BaseModel):
    total_records: int
    total_financed: Decimal
    total_initial_collected: Decimal
    total_pending_from_financers: Decimal
    total_received_from_financers: Decimal
    estimated_profit: Decimal

# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/summary", dependencies=[any_authenticated])
def get_summary(db: Session = Depends(get_db)):
    """Resumen financiero de todas las ventas financiadas."""
    records = db.query(models.ExternalFinancing).all()

    total_financed   = sum(r.financed_amount or 0 for r in records)
    total_initial    = sum(r.initial_payment or 0 for r in records)
    total_received   = sum(r.financer_paid_amount or 0 for r in records)
    total_pending    = total_financed - total_received

    # Ganancia estimada = suma de (precio_total - costo del equipo)
    # Por ahora: precio_total - financed_amount (lo que ya es tuyo = inicial)
    estimated_profit = total_initial  # el inicial ya es ganancia parcial real

    return {
        "total_records": len(records),
        "total_financed": float(total_financed),
        "total_initial_collected": float(total_initial),
        "total_pending_from_financers": float(total_pending),
        "total_received_from_financers": float(total_received),
        "estimated_profit": float(estimated_profit),
    }

@router.get("/", response_model=List[ExternalFinancingRead], dependencies=[any_authenticated])
def list_external_financings(
    financer_name: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db)
):
    """Lista de ventas financiadas con filtros."""
    query = db.query(models.ExternalFinancing).options(
        joinedload(models.ExternalFinancing.customer),
        joinedload(models.ExternalFinancing.sale),
    ).order_by(desc(models.ExternalFinancing.created_at))

    if financer_name:
        query = query.filter(models.ExternalFinancing.financer_name.ilike(f"%{financer_name}%"))
    if status:
        query = query.filter(models.ExternalFinancing.financer_payment_status == status)

    return query.offset(skip).limit(limit).all()

@router.get("/by-sale/{sale_id}", dependencies=[any_authenticated])
def get_by_sale(sale_id: int, db: Session = Depends(get_db)):
    """Obtener financiamiento externo de una venta específica."""
    record = db.query(models.ExternalFinancing).filter(
        models.ExternalFinancing.sale_id == sale_id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="No hay financiamiento externo para esta venta")
    return record

@router.post("/", response_model=ExternalFinancingRead, dependencies=[Depends(warehouse_or_admin)])
def create_external_financing(data: ExternalFinancingCreate, db: Session = Depends(get_db)):
    """Registrar una nueva venta financiada por tercero."""
    # Verificar que la venta existe
    sale = db.query(models.Sale).filter(models.Sale.id == data.sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")

    # Verificar que no tiene ya un financiamiento
    existing = db.query(models.ExternalFinancing).filter(
        models.ExternalFinancing.sale_id == data.sale_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Esta venta ya tiene un financiamiento externo registrado")

    record = models.ExternalFinancing(
        sale_id=data.sale_id,
        customer_id=data.customer_id or sale.customer_id,
        financer_name=data.financer_name,
        financer_payment_method_id=data.financer_payment_method_id,
        total_price=data.total_price,
        initial_payment=data.initial_payment,
        initial_currency=data.initial_currency,
        financed_amount=data.financed_amount,
        installments=data.installments,
        installment_amount=data.installment_amount,
        installment_frequency=data.installment_frequency,
        financer_payment_status="PENDING",
        financer_paid_amount=0,
        notes=data.notes,
    )
    db.add(record)
    db.flush()

    # Recargar con relaciones
    db.refresh(record)
    db.commit()
    return record

@router.put("/{record_id}", response_model=ExternalFinancingRead, dependencies=[Depends(warehouse_or_admin)])
def update_external_financing(record_id: int, data: ExternalFinancingUpdate, db: Session = Depends(get_db)):
    """Actualizar estado de pago o datos de cuotas."""
    record = db.query(models.ExternalFinancing).filter(
        models.ExternalFinancing.id == record_id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Registro no encontrado")

    if data.financer_payment_status is not None:
        record.financer_payment_status = data.financer_payment_status
    if data.financer_paid_amount is not None:
        record.financer_paid_amount = data.financer_paid_amount
        # Auto-completar si pagó todo
        if record.financer_paid_amount >= record.financed_amount:
            record.financer_payment_status = "COMPLETED"
    if data.installments is not None:
        record.installments = data.installments
    if data.installment_amount is not None:
        record.installment_amount = data.installment_amount
    if data.installment_frequency is not None:
        record.installment_frequency = data.installment_frequency
    if data.notes is not None:
        record.notes = data.notes

    db.flush()
    db.refresh(record)
    db.commit()
    return record

@router.delete("/{record_id}", dependencies=[Depends(warehouse_or_admin)])
def delete_external_financing(record_id: int, db: Session = Depends(get_db)):
    """Eliminar registro de financiamiento externo."""
    record = db.query(models.ExternalFinancing).filter(
        models.ExternalFinancing.id == record_id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    db.delete(record)
    db.commit()
    return {"message": "Registro eliminado"}

@router.get("/search-sales", dependencies=[any_authenticated])
def search_sales_for_financing(
    q: str = "",
    db: Session = Depends(get_db)
):
    """
    Busca ventas para vincular a un financiamiento externo.
    Busca por: # venta, nombre cliente, teléfono, IMEI.
    Devuelve info enriquecida: cliente, productos, IMEIs.
    """
    from sqlalchemy import cast, String, or_
    from sqlalchemy.orm import joinedload

    query = db.query(models.Sale).options(
        joinedload(models.Sale.customer),
        joinedload(models.Sale.details).joinedload(models.SaleDetail.product),
        joinedload(models.Sale.details).joinedload(
            models.SaleDetail.instances
        ).joinedload(models.SaleDetailInstance.product_instance),
        joinedload(models.Sale.payments),
    ).outerjoin(models.Customer, models.Customer.id == models.Sale.customer_id)

    if q:
        query = query.outerjoin(
            models.SaleDetail, models.SaleDetail.sale_id == models.Sale.id
        ).outerjoin(
            models.SaleDetailInstance,
            models.SaleDetailInstance.sale_detail_id == models.SaleDetail.id
        ).outerjoin(
            models.ProductInstance,
            models.ProductInstance.id == models.SaleDetailInstance.product_instance_id
        ).filter(
            or_(
                cast(models.Sale.id, String).ilike(f"%{q}%"),
                models.Customer.name.ilike(f"%{q}%"),
                models.Customer.phone.ilike(f"%{q}%"),
                models.ProductInstance.serial_number.ilike(f"%{q}%"),
            )
        ).distinct()

    sales = query.order_by(models.Sale.date.desc()).limit(10).all()

    result = []
    for sale in sales:
        # Recopilar IMEIs de esta venta
        imeis = []
        products = []
        for detail in sale.details:
            if detail.product:
                products.append(detail.product.name)
            for inst in (detail.instances or []):
                if inst.product_instance:
                    imeis.append(inst.product_instance.serial_number)

        # Métodos de pago usados
        payments = [
            {"method": p.payment_method, "amount": float(p.amount), "currency": p.currency}
            for p in sale.payments
        ]

        result.append({
            "id": sale.id,
            "date": sale.date.isoformat(),
            "total_amount": float(sale.total_amount),
            "customer_id": sale.customer_id,
            "customer_name": sale.customer.name if sale.customer else None,
            "customer_phone": sale.customer.phone if sale.customer else None,
            "products": products[:3],  # Max 3 nombres
            "imeis": imeis,
            "payments": payments,
        })

    return result

@router.get("/financers/list", dependencies=[any_authenticated])
def list_financers(db: Session = Depends(get_db)):
    """Lista de financiadoras configuradas como métodos de pago."""
    methods = db.query(models.PaymentMethod).filter(
        models.PaymentMethod.is_external_financer == True,
        models.PaymentMethod.is_active == True
    ).all()
    return [{"id": m.id, "name": m.name} for m in methods]
