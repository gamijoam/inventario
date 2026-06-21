from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..database.db import get_db
from ..dependencies import require_any_permission, require_permission
from ..models import models
from ..utils.time_utils import get_venezuela_now

router = APIRouter(prefix="/layaways", tags=["layaways"])

ACTIVE_LAYAWAY_STATUSES = ("ACTIVE", "PAID")


class LayawaySettingsUpdate(BaseModel):
    enabled: Optional[bool] = None
    default_term_days: Optional[int] = Field(None, ge=1, le=365)
    max_term_days: Optional[int] = Field(None, ge=1, le=365)
    minimum_down_payment_type: Optional[str] = None
    minimum_down_payment_value: Optional[Decimal] = Field(None, ge=0)
    expiration_action: Optional[str] = None
    expired_payment_policy: Optional[str] = None
    allow_extensions: Optional[bool] = None
    require_customer: Optional[bool] = None
    allow_serialized: Optional[bool] = None
    allow_non_serialized: Optional[bool] = None


class LayawayItemCreate(BaseModel):
    product_id: int
    warehouse_id: Optional[int] = None
    quantity: Decimal = Field(default=Decimal("1"), gt=0)
    unit_price: Decimal = Field(default=Decimal("0"), ge=0)
    product_instance_id: Optional[int] = None
    serial_number: Optional[str] = None


class LayawayPaymentCreate(BaseModel):
    amount: Decimal = Field(..., gt=0)
    currency: str = "USD"
    exchange_rate: Decimal = Field(default=Decimal("1"), gt=0)
    payment_method: str = "Efectivo"
    reference: Optional[str] = None
    session_id: Optional[int] = None
    notes: Optional[str] = None


class LayawayCreate(BaseModel):
    customer_id: Optional[int] = None
    warehouse_id: Optional[int] = None
    expires_at: Optional[datetime] = None
    term_days: Optional[int] = Field(None, ge=1, le=365)
    currency: str = "USD"
    notes: Optional[str] = None
    items: List[LayawayItemCreate] = Field(default_factory=list)
    initial_payment: Optional[LayawayPaymentCreate] = None


class LayawayExtendRequest(BaseModel):
    expires_at: datetime
    reason: Optional[str] = None


class LayawayCancelRequest(BaseModel):
    reason: Optional[str] = None


def _decimal(value: Any) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(str(value))


def _money(value: Any) -> float:
    return float(_decimal(value).quantize(Decimal("0.0001")))


def _get_or_create_settings(db: Session) -> models.LayawaySetting:
    settings = db.query(models.LayawaySetting).filter(models.LayawaySetting.id == 1).first()
    if settings:
        return settings
    settings = models.LayawaySetting(id=1)
    db.add(settings)
    db.flush()
    return settings


def _validate_settings_payload(payload: LayawaySettingsUpdate) -> Dict[str, Any]:
    data = payload.model_dump(exclude_unset=True)
    if "minimum_down_payment_type" in data and data["minimum_down_payment_type"] not in {"percent", "fixed", "none"}:
        raise HTTPException(status_code=400, detail="Tipo de inicial invalido")
    if "expiration_action" in data and data["expiration_action"] not in {"manual_review", "auto_release", "auto_cancel"}:
        raise HTTPException(status_code=400, detail="Accion de vencimiento invalida")
    if "expired_payment_policy" in data and data["expired_payment_policy"] not in {"refund", "forfeit", "store_credit", "manual_review"}:
        raise HTTPException(status_code=400, detail="Politica de abono vencido invalida")
    if data.get("minimum_down_payment_type") == "percent" and _decimal(data.get("minimum_down_payment_value", 0)) > 100:
        raise HTTPException(status_code=400, detail="La inicial porcentual no puede superar 100%")
    return data


def _minimum_down_payment(settings: models.LayawaySetting, total: Decimal) -> Decimal:
    kind = settings.minimum_down_payment_type or "percent"
    value = _decimal(settings.minimum_down_payment_value)
    if kind == "none":
        return Decimal("0")
    if kind == "fixed":
        return value
    return (total * value / Decimal("100")).quantize(Decimal("0.0001"))


def _active_reserved_quantity(db: Session, product_id: int, warehouse_id: int) -> Decimal:
    reserved = (
        db.query(func.coalesce(func.sum(models.LayawayItem.quantity), 0))
        .join(models.Layaway, models.Layaway.id == models.LayawayItem.layaway_id)
        .filter(
            models.Layaway.status.in_(ACTIVE_LAYAWAY_STATUSES),
            models.LayawayItem.status == "ACTIVE",
            models.LayawayItem.product_id == product_id,
            models.LayawayItem.warehouse_id == warehouse_id,
            models.LayawayItem.product_instance_id.is_(None),
        )
        .scalar()
    )
    return _decimal(reserved)


def _available_quantity(db: Session, product_id: int, warehouse_id: int) -> Decimal:
    stock = (
        db.query(models.ProductStock)
        .filter(
            models.ProductStock.product_id == product_id,
            models.ProductStock.warehouse_id == warehouse_id,
        )
        .first()
    )
    on_hand = _decimal(stock.quantity if stock else 0)
    return on_hand - _active_reserved_quantity(db, product_id, warehouse_id)


def _generate_layaway_code(db: Session) -> str:
    stamp = get_venezuela_now().strftime("%Y%m%d%H%M%S")
    count_today = db.query(func.count(models.Layaway.id)).filter(
        func.date(models.Layaway.created_at) == get_venezuela_now().date()
    ).scalar() or 0
    return f"AP-{stamp}-{int(count_today) + 1:03d}"


def _add_event(db: Session, layaway_id: int, user_id: Optional[int], event_type: str, description: str, payload: Optional[dict] = None):
    db.add(models.LayawayEvent(
        layaway_id=layaway_id,
        user_id=user_id,
        event_type=event_type,
        description=description,
        payload=payload or {},
    ))


def _serialize_payment(payment: models.LayawayPayment) -> Dict[str, Any]:
    return {
        "id": payment.id,
        "amount": _money(payment.amount),
        "currency": payment.currency,
        "exchange_rate": _money(payment.exchange_rate),
        "payment_method": payment.payment_method,
        "reference": payment.reference,
        "session_id": payment.session_id,
        "status": payment.status,
        "notes": payment.notes,
        "created_at": payment.created_at,
        "created_by_user_id": payment.created_by_user_id,
    }


def _serialize_item(item: models.LayawayItem) -> Dict[str, Any]:
    product = item.product
    instance = item.product_instance
    return {
        "id": item.id,
        "product_id": item.product_id,
        "product_name": item.product_name_snapshot or getattr(product, "name", None),
        "sku": getattr(product, "sku", None),
        "warehouse_id": item.warehouse_id,
        "product_instance_id": item.product_instance_id,
        "serial_number": item.serial_number_snapshot or getattr(instance, "serial_number", None),
        "color_name": item.color_name or getattr(instance, "color_name", None),
        "color_hex": item.color_hex or getattr(instance, "color_hex", None),
        "quantity": _money(item.quantity),
        "unit_price": _money(item.unit_price),
        "subtotal": _money(item.subtotal),
        "status": item.status,
    }


def _serialize_layaway(layaway: models.Layaway) -> Dict[str, Any]:
    return {
        "id": layaway.id,
        "code": layaway.code,
        "customer_id": layaway.customer_id,
        "customer_name": getattr(layaway.customer, "name", None),
        "created_by_user_id": layaway.created_by_user_id,
        "warehouse_id": layaway.warehouse_id,
        "warehouse_name": getattr(layaway.warehouse, "name", None),
        "sale_id": layaway.sale_id,
        "status": layaway.status,
        "total_amount": _money(layaway.total_amount),
        "paid_amount": _money(layaway.paid_amount),
        "balance_amount": _money(layaway.balance_amount),
        "currency": layaway.currency,
        "expires_at": layaway.expires_at,
        "completed_at": layaway.completed_at,
        "cancelled_at": layaway.cancelled_at,
        "notes": layaway.notes,
        "cancellation_reason": layaway.cancellation_reason,
        "created_at": layaway.created_at,
        "updated_at": layaway.updated_at,
        "items": [_serialize_item(item) for item in getattr(layaway, "items", [])],
        "payments": [_serialize_payment(payment) for payment in getattr(layaway, "payments", [])],
    }


@router.get("/settings", dependencies=[Depends(require_any_permission(["layaways.view", "layaways.settings.manage"]))])
def read_layaway_settings(db: Session = Depends(get_db)):
    settings = _get_or_create_settings(db)
    db.commit()
    return settings


@router.put("/settings", dependencies=[Depends(require_permission("layaways.settings.manage"))])
def update_layaway_settings(
    payload: LayawaySettingsUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_permission("layaways.settings.manage")),
):
    settings = _get_or_create_settings(db)
    data = _validate_settings_payload(payload)
    if data.get("default_term_days") and data.get("max_term_days") and data["default_term_days"] > data["max_term_days"]:
        raise HTTPException(status_code=400, detail="Los dias por defecto no pueden superar el maximo")
    for key, value in data.items():
        setattr(settings, key, value)
    settings.updated_at = get_venezuela_now()
    db.commit()
    db.refresh(settings)
    return settings


@router.get("", dependencies=[Depends(require_permission("layaways.view"))])
def list_layaways(
    status: Optional[str] = None,
    customer_id: Optional[int] = None,
    skip: int = 0,
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
):
    query = db.query(models.Layaway).options(
        joinedload(models.Layaway.customer),
        joinedload(models.Layaway.warehouse),
        joinedload(models.Layaway.items).joinedload(models.LayawayItem.product),
        joinedload(models.Layaway.items).joinedload(models.LayawayItem.product_instance),
        joinedload(models.Layaway.payments),
    )
    if status:
        query = query.filter(models.Layaway.status == status.upper())
    if customer_id:
        query = query.filter(models.Layaway.customer_id == customer_id)
    total = query.count()
    items = query.order_by(models.Layaway.created_at.desc()).offset(skip).limit(limit).all()
    return {"items": [_serialize_layaway(item) for item in items], "total": total, "has_more": skip + limit < total}


@router.get("/availability/product/{product_id}", dependencies=[Depends(require_any_permission(["layaways.view", "layaways.create"]))])
def read_product_layaway_availability(product_id: int, warehouse_id: int, db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    if product.has_imei:
        available_serials = db.query(func.count(models.ProductInstance.id)).filter(
            models.ProductInstance.product_id == product_id,
            models.ProductInstance.warehouse_id == warehouse_id,
            models.ProductInstance.status == models.ProductInstanceStatus.AVAILABLE,
        ).scalar() or 0
        reserved_serials = db.query(func.count(models.ProductInstance.id)).filter(
            models.ProductInstance.product_id == product_id,
            models.ProductInstance.warehouse_id == warehouse_id,
            models.ProductInstance.status == models.ProductInstanceStatus.RESERVED,
        ).scalar() or 0
        return {
            "product_id": product_id,
            "warehouse_id": warehouse_id,
            "serialized": True,
            "available": int(available_serials),
            "reserved": int(reserved_serials),
        }
    stock = db.query(models.ProductStock).filter(
        models.ProductStock.product_id == product_id,
        models.ProductStock.warehouse_id == warehouse_id,
    ).first()
    on_hand = _decimal(stock.quantity if stock else 0)
    reserved = _active_reserved_quantity(db, product_id, warehouse_id)
    return {
        "product_id": product_id,
        "warehouse_id": warehouse_id,
        "serialized": False,
        "stock": _money(on_hand),
        "reserved": _money(reserved),
        "available": _money(on_hand - reserved),
    }


@router.get("/{layaway_id}", dependencies=[Depends(require_permission("layaways.view"))])
def read_layaway(layaway_id: int, db: Session = Depends(get_db)):
    layaway = db.query(models.Layaway).options(
        joinedload(models.Layaway.customer),
        joinedload(models.Layaway.warehouse),
        joinedload(models.Layaway.items).joinedload(models.LayawayItem.product),
        joinedload(models.Layaway.items).joinedload(models.LayawayItem.product_instance),
        joinedload(models.Layaway.payments),
        joinedload(models.Layaway.events),
    ).filter(models.Layaway.id == layaway_id).first()
    if not layaway:
        raise HTTPException(status_code=404, detail="Apartado no encontrado")
    data = _serialize_layaway(layaway)
    data["events"] = [
        {
            "id": event.id,
            "event_type": event.event_type,
            "description": event.description,
            "payload": event.payload,
            "user_id": event.user_id,
            "created_at": event.created_at,
        }
        for event in layaway.events
    ]
    return data




@router.post("", dependencies=[Depends(require_permission("layaways.create"))])
def create_layaway(
    payload: LayawayCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_permission("layaways.create")),
):
    settings = _get_or_create_settings(db)
    if not settings.enabled:
        raise HTTPException(status_code=400, detail="Los apartados estan desactivados para esta tienda")
    if not payload.items:
        raise HTTPException(status_code=400, detail="Agrega al menos un producto al apartado")
    if settings.require_customer and not payload.customer_id:
        raise HTTPException(status_code=400, detail="Selecciona un cliente para crear el apartado")
    if payload.customer_id:
        customer = db.query(models.Customer).filter(models.Customer.id == payload.customer_id, models.Customer.is_active == True).first()
        if not customer:
            raise HTTPException(status_code=404, detail="Cliente no encontrado o inactivo")

    term_days = payload.term_days or settings.default_term_days
    if term_days > settings.max_term_days:
        raise HTTPException(status_code=400, detail=f"El plazo maximo permitido es de {settings.max_term_days} dias")
    expires_at = payload.expires_at or (get_venezuela_now() + timedelta(days=int(term_days)))
    if expires_at <= get_venezuela_now():
        raise HTTPException(status_code=400, detail="La fecha limite debe ser futura")

    layaway = models.Layaway(
        code=_generate_layaway_code(db),
        customer_id=payload.customer_id,
        created_by_user_id=current_user.id,
        warehouse_id=payload.warehouse_id,
        currency=payload.currency or "USD",
        expires_at=expires_at,
        notes=payload.notes,
    )
    db.add(layaway)
    db.flush()

    total = Decimal("0")
    for requested in payload.items:
        product = db.query(models.Product).filter(models.Product.id == requested.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Producto {requested.product_id} no encontrado")
        warehouse_id = requested.warehouse_id or payload.warehouse_id
        if not warehouse_id:
            raise HTTPException(status_code=400, detail=f"Selecciona almacen para {product.name}")
        warehouse = db.query(models.Warehouse).filter(models.Warehouse.id == warehouse_id, models.Warehouse.is_active == True).first()
        if not warehouse:
            raise HTTPException(status_code=404, detail="Almacen no encontrado o inactivo")

        unit_price = _decimal(requested.unit_price)
        if unit_price <= 0:
            unit_price = _decimal(product.price)

        if product.has_imei:
            if not settings.allow_serialized:
                raise HTTPException(status_code=400, detail="La politica actual no permite apartar productos serializados")
            instance_query = db.query(models.ProductInstance).filter(
                models.ProductInstance.product_id == product.id,
                models.ProductInstance.warehouse_id == warehouse_id,
                models.ProductInstance.status == models.ProductInstanceStatus.AVAILABLE,
            )
            if requested.product_instance_id:
                instance_query = instance_query.filter(models.ProductInstance.id == requested.product_instance_id)
            elif requested.serial_number:
                instance_query = instance_query.filter(models.ProductInstance.serial_number == requested.serial_number.strip())
            else:
                raise HTTPException(status_code=400, detail=f"Selecciona IMEI/serial para {product.name}")
            instance = instance_query.with_for_update().first()
            if not instance:
                raise HTTPException(status_code=400, detail=f"IMEI no disponible para apartar: {product.name}")
            instance.status = models.ProductInstanceStatus.RESERVED
            quantity = Decimal("1")
            subtotal = unit_price
            item = models.LayawayItem(
                layaway_id=layaway.id,
                product_id=product.id,
                warehouse_id=warehouse_id,
                product_instance_id=instance.id,
                quantity=quantity,
                unit_price=unit_price,
                subtotal=subtotal,
                product_name_snapshot=product.name,
                serial_number_snapshot=instance.serial_number,
                color_name=instance.color_name,
                color_hex=instance.color_hex,
            )
        else:
            if not settings.allow_non_serialized:
                raise HTTPException(status_code=400, detail="La politica actual no permite apartar productos no serializados")
            quantity = _decimal(requested.quantity)
            available = _available_quantity(db, product.id, warehouse_id)
            if available < quantity:
                raise HTTPException(
                    status_code=400,
                    detail=f"Stock insuficiente para apartar {product.name}. Disponible real: {_money(available)}",
                )
            subtotal = (quantity * unit_price).quantize(Decimal("0.0001"))
            item = models.LayawayItem(
                layaway_id=layaway.id,
                product_id=product.id,
                warehouse_id=warehouse_id,
                quantity=quantity,
                unit_price=unit_price,
                subtotal=subtotal,
                product_name_snapshot=product.name,
            )
        total += subtotal
        db.add(item)

    min_payment = _minimum_down_payment(settings, total)
    initial_amount = _decimal(payload.initial_payment.amount if payload.initial_payment else 0)
    if initial_amount < min_payment:
        raise HTTPException(status_code=400, detail=f"La inicial minima para este apartado es {_money(min_payment)} {payload.currency}")

    layaway.total_amount = total
    layaway.paid_amount = Decimal("0")
    layaway.balance_amount = total

    if payload.initial_payment and initial_amount > 0:
        payment = models.LayawayPayment(
            layaway_id=layaway.id,
            amount=initial_amount,
            currency=payload.initial_payment.currency,
            exchange_rate=payload.initial_payment.exchange_rate,
            payment_method=payload.initial_payment.payment_method,
            reference=payload.initial_payment.reference,
            session_id=payload.initial_payment.session_id,
            notes=payload.initial_payment.notes,
            created_by_user_id=current_user.id,
        )
        db.add(payment)
        layaway.paid_amount = initial_amount
        layaway.balance_amount = max(total - initial_amount, Decimal("0"))
        if layaway.balance_amount <= Decimal("0.0001"):
            layaway.status = "PAID"

    _add_event(
        db,
        layaway.id,
        current_user.id,
        "CREATED",
        "Apartado creado",
        {"total": str(total), "paid": str(layaway.paid_amount), "expires_at": expires_at.isoformat()},
    )
    db.commit()
    db.refresh(layaway)
    return read_layaway(layaway.id, db)


@router.post("/{layaway_id}/payments", dependencies=[Depends(require_permission("layaways.payments.add"))])
def add_layaway_payment(
    layaway_id: int,
    payload: LayawayPaymentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_permission("layaways.payments.add")),
):
    layaway = db.query(models.Layaway).filter(models.Layaway.id == layaway_id).with_for_update().first()
    if not layaway:
        raise HTTPException(status_code=404, detail="Apartado no encontrado")
    if layaway.status not in ACTIVE_LAYAWAY_STATUSES:
        raise HTTPException(status_code=400, detail="Solo puedes abonar apartados activos")

    amount = _decimal(payload.amount)
    payment = models.LayawayPayment(
        layaway_id=layaway.id,
        amount=amount,
        currency=payload.currency,
        exchange_rate=payload.exchange_rate,
        payment_method=payload.payment_method,
        reference=payload.reference,
        session_id=payload.session_id,
        notes=payload.notes,
        created_by_user_id=current_user.id,
    )
    db.add(payment)
    layaway.paid_amount = _decimal(layaway.paid_amount) + amount
    layaway.balance_amount = max(_decimal(layaway.total_amount) - _decimal(layaway.paid_amount), Decimal("0"))
    if layaway.balance_amount <= Decimal("0.0001"):
        layaway.status = "PAID"
    layaway.updated_at = get_venezuela_now()
    _add_event(db, layaway.id, current_user.id, "PAYMENT_ADDED", "Abono registrado", {"amount": str(amount), "currency": payload.currency})
    db.commit()
    return read_layaway(layaway.id, db)


@router.put("/{layaway_id}/extend", dependencies=[Depends(require_permission("layaways.extend"))])
def extend_layaway(
    layaway_id: int,
    payload: LayawayExtendRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_permission("layaways.extend")),
):
    settings = _get_or_create_settings(db)
    if not settings.allow_extensions:
        raise HTTPException(status_code=400, detail="La politica actual no permite prorrogar apartados")
    layaway = db.query(models.Layaway).filter(models.Layaway.id == layaway_id).first()
    if not layaway:
        raise HTTPException(status_code=404, detail="Apartado no encontrado")
    if layaway.status not in ACTIVE_LAYAWAY_STATUSES:
        raise HTTPException(status_code=400, detail="Solo puedes prorrogar apartados activos")
    if payload.expires_at <= get_venezuela_now():
        raise HTTPException(status_code=400, detail="La nueva fecha debe ser futura")
    layaway.expires_at = payload.expires_at
    layaway.updated_at = get_venezuela_now()
    _add_event(db, layaway.id, current_user.id, "EXTENDED", "Apartado prorrogado", {"expires_at": payload.expires_at.isoformat(), "reason": payload.reason})
    db.commit()
    return read_layaway(layaway.id, db)


@router.put("/{layaway_id}/cancel", dependencies=[Depends(require_permission("layaways.cancel"))])
def cancel_layaway(
    layaway_id: int,
    payload: LayawayCancelRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_permission("layaways.cancel")),
):
    layaway = db.query(models.Layaway).filter(models.Layaway.id == layaway_id).with_for_update().first()
    if not layaway:
        raise HTTPException(status_code=404, detail="Apartado no encontrado")
    if layaway.status in {"CANCELLED", "COMPLETED"}:
        raise HTTPException(status_code=400, detail="Este apartado ya no se puede cancelar")
    items = db.query(models.LayawayItem).options(joinedload(models.LayawayItem.product_instance)).filter(
        models.LayawayItem.layaway_id == layaway.id
    ).all()
    for item in items:
        if item.status == "ACTIVE":
            item.status = "RELEASED"
            if item.product_instance and item.product_instance.status == models.ProductInstanceStatus.RESERVED:
                item.product_instance.status = models.ProductInstanceStatus.AVAILABLE
    layaway.status = "CANCELLED"
    layaway.cancelled_at = get_venezuela_now()
    layaway.cancellation_reason = payload.reason
    layaway.updated_at = get_venezuela_now()
    _add_event(db, layaway.id, current_user.id, "CANCELLED", "Apartado cancelado y productos liberados", {"reason": payload.reason})
    db.commit()
    return read_layaway(layaway.id, db)
