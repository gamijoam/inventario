from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import desc
from typing import List, Optional
from pydantic import BaseModel
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime

from ..database.db import get_db
from ..models import models
from ..dependencies import any_authenticated, cashier_or_admin, warehouse_or_admin, get_current_active_user
from ..services.cash_session_resolver import resolve_current_cash_session
from ..utils.time_utils import get_venezuela_now

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

class ExternalFinancingPaymentCreate(BaseModel):
    amount: Decimal
    currency: str = "USD"
    exchange_rate: Decimal = Decimal("1")
    payment_method: Optional[str] = None
    reference: Optional[str] = None
    notes: Optional[str] = None
    session_id: Optional[int] = None
    register_in_cash: bool = True
    received_at: Optional[datetime] = None

class ExternalFinancingPaymentRead(BaseModel):
    id: int
    external_financing_id: int
    amount: Decimal
    currency: str
    exchange_rate: Decimal
    amount_usd: Decimal
    payment_method: Optional[str]
    reference: Optional[str]
    notes: Optional[str]
    session_id: Optional[int]
    cash_movement_id: Optional[int]
    received_at: datetime
    created_at: datetime
    class Config:
        from_attributes = True

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
    payments: List[ExternalFinancingPaymentRead] = []
    class Config:
        from_attributes = True

class ExternalFinancingSummary(BaseModel):
    total_records: int
    total_financed: Decimal
    total_initial_collected: Decimal
    total_pending_from_financers: Decimal
    total_received_from_financers: Decimal
    estimated_profit: Decimal


def _currency_key(value: str) -> str:
    curr = str(value or "USD").strip()
    if curr.upper() in {"BS", "VES", "VEF"}:
        return "VES"
    if curr in {"$", ""}:
        return "USD"
    return curr.upper()


def _money(value: Decimal) -> Decimal:
    return Decimal(str(value or "0")).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def _to_usd(amount: Decimal, currency: str, exchange_rate: Decimal) -> Decimal:
    amount = Decimal(str(amount or "0"))
    currency = _currency_key(currency)
    rate = Decimal(str(exchange_rate or "1"))
    if currency in {"VES", "BS"}:
        if rate <= 0:
            raise HTTPException(status_code=400, detail="La tasa debe ser mayor a cero para pagos en bolivares")
        return _money(amount / rate)
    return _money(amount)


def _payments_total_usd(record: models.ExternalFinancing) -> Decimal:
    payments = getattr(record, "payments", None) or []
    if payments:
        return _money(sum((p.amount_usd or Decimal("0")) for p in payments))
    return _money(record.financer_paid_amount or Decimal("0"))


def _sync_financing_payment_status(record: models.ExternalFinancing) -> None:
    paid = _payments_total_usd(record)
    financed = _money(record.financed_amount or Decimal("0"))
    record.financer_paid_amount = paid
    if paid <= 0:
        record.financer_payment_status = "PENDING"
    elif paid + Decimal("0.0001") >= financed:
        record.financer_payment_status = "COMPLETED"
    else:
        record.financer_payment_status = "PARTIAL"
    record.updated_at = get_venezuela_now()


def _apply_financing_filters(query, financer_name=None, status=None, date_from=None, date_to=None):
    if financer_name:
        query = query.filter(models.ExternalFinancing.financer_name.ilike(f"%{financer_name}%"))
    if status:
        query = query.filter(models.ExternalFinancing.financer_payment_status == status)
    if date_from:
        try:
            dt_from = datetime.strptime(date_from, "%Y-%m-%d")
            query = query.filter(models.ExternalFinancing.created_at >= dt_from)
        except Exception:
            pass
    if date_to:
        try:
            from datetime import timedelta
            dt_to = datetime.strptime(date_to, "%Y-%m-%d")
            query = query.filter(models.ExternalFinancing.created_at < dt_to + timedelta(days=1))
        except Exception:
            pass
    return query

# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/summary", dependencies=[any_authenticated])
def get_summary(
    financer_name: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Resumen de ventas financiadas por terceros.

    Mantiene separados los conceptos contables: la inicial es dinero que entra a
    caja y el monto financiado es una cuenta por cobrar a la financiadora.
    """
    query = _apply_financing_filters(
        db.query(models.ExternalFinancing).options(selectinload(models.ExternalFinancing.payments)),
        financer_name=financer_name,
        status=status,
        date_from=date_from,
        date_to=date_to,
    )
    records = query.all()

    total_price      = sum((r.total_price or Decimal("0")) for r in records)
    total_financed   = sum((r.financed_amount or Decimal("0")) for r in records)
    total_initial    = sum((r.initial_payment or Decimal("0")) for r in records)
    total_received   = sum(_payments_total_usd(r) for r in records)
    total_pending    = total_financed - total_received

    status_counts = {"PENDING": 0, "PARTIAL": 0, "COMPLETED": 0}
    initial_by_currency = {}
    for record in records:
        _sync_financing_payment_status(record)
        key = record.financer_payment_status or "PENDING"
        status_counts[key] = status_counts.get(key, 0) + 1
        currency = (record.initial_currency or "USD").upper()
        initial_by_currency[currency] = initial_by_currency.get(currency, Decimal("0")) + (record.initial_payment or Decimal("0"))

    estimated_profit = total_initial

    return {
        "total_records": len(records),
        "total_count": len(records),
        "total_amount": float(total_price),
        "total_price": float(total_price),
        "total_financed": float(total_financed),
        "total_initial_collected": float(total_initial),
        "total_pending_from_financers": float(total_pending),
        "total_received_from_financers": float(total_received),
        "total_paid": float(total_received),
        "total_pending": float(total_pending),
        "pending_count": status_counts.get("PENDING", 0),
        "partial_count": status_counts.get("PARTIAL", 0),
        "completed_count": status_counts.get("COMPLETED", 0),
        "by_status": status_counts,
        "initial_by_currency": {k: float(v) for k, v in initial_by_currency.items()},
        "estimated_profit": float(estimated_profit),
    }

@router.get("/", response_model=List[ExternalFinancingRead], dependencies=[any_authenticated])
def list_external_financings(
    financer_name: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    skip: int = 0,
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db)
):
    """Lista de ventas financiadas con filtros por estado, financiadora y fecha."""
    from datetime import datetime
    query = db.query(models.ExternalFinancing).options(
        joinedload(models.ExternalFinancing.customer),
        joinedload(models.ExternalFinancing.sale),
        selectinload(models.ExternalFinancing.payments),
    ).order_by(desc(models.ExternalFinancing.created_at))

    query = _apply_financing_filters(
        query,
        financer_name=financer_name,
        status=status,
        date_from=date_from,
        date_to=date_to,
    )

    return query.offset(skip).limit(limit).all()

@router.get("/by-sale/{sale_id}", dependencies=[any_authenticated])
def get_by_sale(sale_id: int, db: Session = Depends(get_db)):
    """Obtener financiamiento externo de una venta específica."""
    record = db.query(models.ExternalFinancing).options(
        selectinload(models.ExternalFinancing.payments)
    ).filter(
        models.ExternalFinancing.sale_id == sale_id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="No hay financiamiento externo para esta venta")
    return record

@router.post("/", response_model=ExternalFinancingRead, dependencies=[Depends(cashier_or_admin)])
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

@router.post("/{record_id}/payments", response_model=ExternalFinancingPaymentRead, dependencies=[Depends(warehouse_or_admin)])
def create_financing_payment(
    record_id: int,
    data: ExternalFinancingPaymentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Registrar un pago real recibido desde la financiadora.

    Si register_in_cash=true, se crea un movimiento DEPOSIT en la caja resuelta.
    Si no hay caja clara, el pago queda solo como trazabilidad de la financiera.
    """
    record = db.query(models.ExternalFinancing).options(
        selectinload(models.ExternalFinancing.payments),
        joinedload(models.ExternalFinancing.sale),
    ).filter(models.ExternalFinancing.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Registro no encontrado")

    amount = _money(data.amount)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="El monto debe ser mayor a cero")

    currency = _currency_key(data.currency)
    exchange_rate = _money(data.exchange_rate or Decimal("1"))
    amount_usd = _to_usd(amount, currency, exchange_rate)
    paid_before = _payments_total_usd(record)
    pending = _money((record.financed_amount or Decimal("0")) - paid_before)
    if amount_usd > pending + Decimal("0.0100"):
        raise HTTPException(status_code=400, detail=f"El pago supera el pendiente de la financiadora (${pending})")

    session = None
    cash_movement = None
    if data.register_in_cash:
        if data.session_id:
            session = db.query(models.CashSession).filter(
                models.CashSession.id == data.session_id,
                models.CashSession.status == "OPEN",
            ).first()
            if not session:
                raise HTTPException(status_code=400, detail="La caja seleccionada no esta abierta")
        else:
            session = resolve_current_cash_session(db, current_user)

        if not session:
            raise HTTPException(status_code=400, detail="No hay una caja abierta clara para registrar este cobro. Abre caja o envia session_id.")

        cash_movement = models.CashMovement(
            session_id=session.id,
            type="DEPOSIT",
            amount=amount,
            currency=currency,
            exchange_rate=exchange_rate,
            description=f"Pago financiadora {record.financer_name} - Venta #{record.sale_id}",
            incoming_amount=amount,
            incoming_currency=currency,
            incoming_method=data.payment_method or record.financer_name,
            incoming_reference=data.reference,
            date=data.received_at or get_venezuela_now(),
        )
        db.add(cash_movement)
        db.flush()

    payment = models.ExternalFinancingPayment(
        external_financing_id=record.id,
        amount=amount,
        currency=currency,
        exchange_rate=exchange_rate,
        amount_usd=amount_usd,
        payment_method=data.payment_method or record.financer_name,
        reference=data.reference,
        notes=data.notes,
        session_id=session.id if session else None,
        cash_movement_id=cash_movement.id if cash_movement else None,
        received_at=data.received_at or get_venezuela_now(),
    )
    db.add(payment)
    db.flush()
    record.payments.append(payment)
    _sync_financing_payment_status(record)
    db.commit()
    db.refresh(payment)
    return payment


@router.get("/{record_id}/payments", response_model=List[ExternalFinancingPaymentRead], dependencies=[any_authenticated])
def list_financing_payments(record_id: int, db: Session = Depends(get_db)):
    record = db.query(models.ExternalFinancing).filter(models.ExternalFinancing.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    return db.query(models.ExternalFinancingPayment).filter(
        models.ExternalFinancingPayment.external_financing_id == record_id
    ).order_by(models.ExternalFinancingPayment.received_at.desc(), models.ExternalFinancingPayment.id.desc()).all()


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

@router.get("/by-financer", dependencies=[any_authenticated])
def get_by_financer(db: Session = Depends(get_db)):
    """Resumen agrupado por financiadora con detalle de cada venta."""
    records = db.query(models.ExternalFinancing).options(
        selectinload(models.ExternalFinancing.payments),
        joinedload(models.ExternalFinancing.customer),
        joinedload(models.ExternalFinancing.sale),
    ).order_by(
        models.ExternalFinancing.financer_name,
        models.ExternalFinancing.created_at.desc()
    ).all()

    from collections import defaultdict
    grouped = defaultdict(lambda: {
        "financer_name": "",
        "total_sales": 0,
        "total_financed": 0.0,
        "total_initial": 0.0,
        "total_received": 0.0,
        "total_pending": 0.0,
        "records": []
    })

    for r in records:
        g = grouped[r.financer_name]
        g["financer_name"] = r.financer_name
        g["total_sales"] += 1
        g["total_financed"] += float(r.financed_amount or 0)
        g["total_initial"]  += float(r.initial_payment or 0)
        paid_amount = _payments_total_usd(r)
        _sync_financing_payment_status(r)
        g["total_received"] += float(paid_amount)
        g["total_pending"]  += float(r.financed_amount or 0) - float(paid_amount)

        # Info de la venta
        sale = r.sale
        customer_name = r.customer.name if r.customer else "Sin cliente"
        g["records"].append({
            "id":                    r.id,
            "sale_id":               r.sale_id,
            "customer_name":         customer_name,
            "total_price":           float(r.total_price or 0),
            "initial_payment":       float(r.initial_payment or 0),
            "initial_currency":      r.initial_currency or "USD",
            "financed_amount":       float(r.financed_amount or 0),
            "financer_paid_amount":  float(paid_amount),
            "financer_payment_status": r.financer_payment_status or "PENDING",
            "payments_count":          len(getattr(r, "payments", []) or []),
            "notes":                 r.notes,
            "created_at":            r.created_at.isoformat() if r.created_at else None,
            "sale_date":             sale.date.isoformat() if (sale and sale.date) else None,
        })

    return list(grouped.values())


@router.post("/{record_id}/mark-paid", dependencies=[Depends(warehouse_or_admin)])
def mark_financer_paid(
    record_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Compatibilidad: registrar pago de financiadora usando el flujo nuevo."""
    record = db.query(models.ExternalFinancing).options(
        selectinload(models.ExternalFinancing.payments)
    ).filter(models.ExternalFinancing.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Registro no encontrado")

    target_total = Decimal(str(data.get("amount", record.financed_amount or 0)))
    paid_before = _payments_total_usd(record)
    delta = _money(target_total - paid_before)
    if delta <= 0:
        _sync_financing_payment_status(record)
        db.commit()
        return {
            "id": record.id,
            "financer_payment_status": record.financer_payment_status,
            "financer_paid_amount": float(record.financer_paid_amount),
            "financed_amount": float(record.financed_amount),
            "message": "Sin cambios: el monto ya estaba registrado",
        }

    payload = ExternalFinancingPaymentCreate(
        amount=delta,
        currency="USD",
        exchange_rate=Decimal("1"),
        payment_method=data.get("payment_method") or record.financer_name,
        reference=data.get("reference"),
        notes=data.get("notes") or "Registro desde mark-paid legacy",
        session_id=data.get("session_id"),
        register_in_cash=bool(data.get("register_in_cash", False)),
    )
    payment = create_financing_payment(record_id, payload, db, current_user)
    return {
        "id": record.id,
        "payment_id": payment.id,
        "financer_payment_status": record.financer_payment_status,
        "financer_paid_amount": float(record.financer_paid_amount),
        "financed_amount": float(record.financed_amount),
    }


@router.get("/commissions/{sale_id}", dependencies=[any_authenticated])
def get_sale_commissions(sale_id: int, db: Session = Depends(get_db)):
    """
    Devuelve las comisiones generadas por una venta financiada externamente.
    Útil para mostrar en la card de crédito externo.
    """
    from sqlalchemy import text as _txt

    # Buscar commission_logs vinculados a esta venta via sale_detail
    logs = db.execute(_txt("""
        SELECT 
            cl.id,
            cl.amount,
            cl.percentage_applied,
            cl.status,
            cl.commission_role,
            cl.created_at,
            u.full_name as user_name,
            u.email as user_email
        FROM commission_logs cl
        JOIN sale_details sd ON sd.id = cl.sale_detail_id
        JOIN public.users u ON u.id = cl.user_id
        WHERE sd.sale_id = :sale_id
        ORDER BY cl.created_at DESC
    """), {"sale_id": sale_id}).fetchall()

    return [
        {
            "id": row[0],
            "amount": float(row[1] or 0),
            "percentage_applied": float(row[2] or 0),
            "status": str(row[3]),
            "commission_role": row[4],
            "created_at": row[5].isoformat() if row[5] else None,
            "user_name": row[6] or row[7],
        }
        for row in logs
    ]

@router.get("/financers/list", dependencies=[any_authenticated])
def list_financers(db: Session = Depends(get_db)):
    """Lista de financiadoras configuradas como métodos de pago."""
    methods = db.query(models.PaymentMethod).filter(
        models.PaymentMethod.is_external_financer == True,
        models.PaymentMethod.is_active == True
    ).all()
    return [{"id": m.id, "name": m.name} for m in methods]
