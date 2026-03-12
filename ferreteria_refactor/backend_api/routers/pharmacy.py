from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_
from typing import List, Optional
from datetime import date, timedelta
from pydantic import BaseModel

from ..database.db import get_db
from ..models.models import ProductLot, Prescription, Product, Sale, SaleDetail
from ..dependencies import cashier_or_admin, admin_only

router = APIRouter(prefix="/pharmacy", tags=["pharmacy"])


# ==========================================
# SCHEMAS
# ==========================================

class LotCreate(BaseModel):
    product_id: int
    lot_number: str
    expiry_date: date
    quantity: float
    received_date: Optional[date] = None
    supplier_id: Optional[int] = None
    notes: Optional[str] = ""


class LotUpdate(BaseModel):
    status: Optional[str] = None      # ACTIVE, EXPIRED, RECALLED, QUARANTINE
    quantity: Optional[float] = None
    notes: Optional[str] = None


class PrescriptionCreate(BaseModel):
    sale_id: Optional[int] = None
    patient_name: str
    patient_cedula: str
    doctor_name: str
    doctor_mpps: Optional[str] = None
    prescription_date: Optional[date] = None
    notes: Optional[str] = ""


# ==========================================
# HELPER
# ==========================================

def _lot_to_dict(lot: ProductLot) -> dict:
    today = date.today()
    days_until_expiry = (lot.expiry_date - today).days if lot.expiry_date else None
    return {
        "id": lot.id,
        "product_id": lot.product_id,
        "product_name": lot.product.name if lot.product else None,
        "lot_number": lot.lot_number,
        "expiry_date": lot.expiry_date.isoformat() if lot.expiry_date else None,
        "quantity": float(lot.quantity),
        "status": lot.status,
        "received_date": lot.received_date.isoformat() if lot.received_date else None,
        "days_until_expiry": days_until_expiry,
    }


# ==========================================
# ENDPOINTS — LOTS
# ==========================================

@router.get("/lots", dependencies=[Depends(cashier_or_admin)])
def list_lots(
    status: Optional[str] = Query(default=None, description="ACTIVE, EXPIRED, RECALLED, QUARANTINE"),
    expiring_in_days: Optional[int] = Query(default=None, description="Filter lots expiring within N days"),
    product_id: Optional[int] = Query(default=None),
    skip: int = 0,
    limit: int = Query(default=200, le=2000),
    db: Session = Depends(get_db),
):
    """List all product lots for the tenant, with optional filters."""
    query = db.query(ProductLot).options(joinedload(ProductLot.product))

    if status:
        query = query.filter(ProductLot.status == status)

    if product_id:
        query = query.filter(ProductLot.product_id == product_id)

    if expiring_in_days is not None:
        today = date.today()
        cutoff = today + timedelta(days=expiring_in_days)
        query = query.filter(
            and_(ProductLot.expiry_date >= today, ProductLot.expiry_date <= cutoff)
        )

    total = query.count()
    lots = query.order_by(ProductLot.expiry_date.asc()).offset(skip).limit(limit).all()

    return {
        "items": [_lot_to_dict(lot) for lot in lots],
        "total": total,
        "has_more": (skip + limit) < total,
    }


@router.post("/lots", dependencies=[Depends(admin_only)])
def receive_lot(payload: LotCreate, db: Session = Depends(get_db)):
    """Receive new stock with lot info. Also increases product.stock by the quantity received."""
    product = db.query(Product).filter(Product.id == payload.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    lot = ProductLot(
        product_id=payload.product_id,
        lot_number=payload.lot_number,
        expiry_date=payload.expiry_date,
        quantity=payload.quantity,
        received_date=payload.received_date or date.today(),
        supplier_id=payload.supplier_id,
        notes=payload.notes,
        status="ACTIVE",
    )
    db.add(lot)
    db.flush()  # Get lot.id before commit

    # Increase product stock
    current_stock = float(product.stock or 0)
    product.stock = current_stock + payload.quantity

    db.commit()

    return {
        "id": lot.id,
        "product_id": lot.product_id,
        "lot_number": lot.lot_number,
        "expiry_date": lot.expiry_date.isoformat(),
        "quantity": float(lot.quantity),
        "status": lot.status,
        "received_date": lot.received_date.isoformat() if lot.received_date else None,
        "new_product_stock": float(product.stock),
    }


@router.put("/lots/{lot_id}", dependencies=[Depends(admin_only)])
def update_lot(lot_id: int, payload: LotUpdate, db: Session = Depends(get_db)):
    """Update lot status (ACTIVE -> RECALLED, QUARANTINE, etc.) or quantity."""
    lot = db.query(ProductLot).filter(ProductLot.id == lot_id).first()
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")

    valid_statuses = {"ACTIVE", "EXPIRED", "RECALLED", "QUARANTINE"}
    if payload.status is not None:
        if payload.status not in valid_statuses:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
            )
        lot.status = payload.status

    if payload.quantity is not None:
        if payload.quantity < 0:
            raise HTTPException(status_code=400, detail="Quantity cannot be negative")
        lot.quantity = payload.quantity

    if payload.notes is not None:
        lot.notes = payload.notes

    db.commit()

    return {
        "id": lot.id,
        "product_id": lot.product_id,
        "lot_number": lot.lot_number,
        "status": lot.status,
        "quantity": float(lot.quantity),
        "notes": lot.notes,
    }


# ==========================================
# ENDPOINTS — ALERTS
# ==========================================

@router.get("/alerts", dependencies=[Depends(cashier_or_admin)])
def get_pharmacy_alerts(db: Session = Depends(get_db)):
    """
    Returns a summary of pharmacy alerts:
    - Lots expiring in <= 30 days
    - Lots expiring in 31-90 days
    - Lots already expired
    - Products below min_stock
    """
    today = date.today()
    day30 = today + timedelta(days=30)
    day90 = today + timedelta(days=90)

    all_lots = (
        db.query(ProductLot)
        .options(joinedload(ProductLot.product))
        .filter(ProductLot.status == "ACTIVE")
        .all()
    )

    expiring_30 = []
    expiring_90 = []
    expired = []

    for lot in all_lots:
        if lot.expiry_date is None:
            continue
        if lot.expiry_date < today:
            expired.append(_lot_to_dict(lot))
        elif lot.expiry_date <= day30:
            expiring_30.append(_lot_to_dict(lot))
        elif lot.expiry_date <= day90:
            expiring_90.append(_lot_to_dict(lot))

    # Low stock products
    low_stock_products = (
        db.query(Product)
        .filter(
            Product.is_active == True,
            Product.stock <= Product.min_stock,
        )
        .all()
    )

    low_stock = [
        {
            "product_id": p.id,
            "product_name": p.name,
            "stock": float(p.stock or 0),
            "min_stock": float(p.min_stock or 0),
        }
        for p in low_stock_products
    ]

    total_alerts = len(expiring_30) + len(expired) + len(low_stock)

    return {
        "expiring_30": expiring_30,
        "expiring_90": expiring_90,
        "expired": expired,
        "low_stock": low_stock,
        "total_alerts": total_alerts,
    }


# ==========================================
# ENDPOINTS — PRESCRIPTIONS
# ==========================================

@router.post("/prescriptions", dependencies=[Depends(cashier_or_admin)])
def create_prescription(payload: PrescriptionCreate, db: Session = Depends(get_db)):
    """Save prescription data linked to a sale."""
    if payload.sale_id:
        sale = db.query(Sale).filter(Sale.id == payload.sale_id).first()
        if not sale:
            raise HTTPException(status_code=404, detail="Sale not found")

    rx = Prescription(
        sale_id=payload.sale_id,
        patient_name=payload.patient_name,
        patient_cedula=payload.patient_cedula,
        doctor_name=payload.doctor_name,
        doctor_mpps=payload.doctor_mpps,
        prescription_date=payload.prescription_date,
        notes=payload.notes,
    )
    db.add(rx)
    db.flush()
    db.commit()

    return {
        "id": rx.id,
        "sale_id": rx.sale_id,
        "patient_name": rx.patient_name,
        "patient_cedula": rx.patient_cedula,
        "doctor_name": rx.doctor_name,
        "doctor_mpps": rx.doctor_mpps,
        "prescription_date": rx.prescription_date.isoformat() if rx.prescription_date else None,
        "notes": rx.notes,
        "created_at": rx.created_at.isoformat() if rx.created_at else None,
    }


@router.get("/prescriptions", dependencies=[Depends(cashier_or_admin)])
def list_prescriptions(
    patient_cedula: Optional[str] = Query(default=None),
    sale_id: Optional[int] = Query(default=None),
    skip: int = 0,
    limit: int = Query(default=100, le=1000),
    db: Session = Depends(get_db),
):
    """List prescriptions with optional filter by patient_cedula or sale_id."""
    query = db.query(Prescription)

    if patient_cedula:
        query = query.filter(Prescription.patient_cedula.ilike(f"%{patient_cedula}%"))

    if sale_id:
        query = query.filter(Prescription.sale_id == sale_id)

    total = query.count()
    items = query.order_by(Prescription.created_at.desc()).offset(skip).limit(limit).all()

    return {
        "items": [
            {
                "id": rx.id,
                "sale_id": rx.sale_id,
                "patient_name": rx.patient_name,
                "patient_cedula": rx.patient_cedula,
                "doctor_name": rx.doctor_name,
                "doctor_mpps": rx.doctor_mpps,
                "prescription_date": rx.prescription_date.isoformat() if rx.prescription_date else None,
                "notes": rx.notes,
                "created_at": rx.created_at.isoformat() if rx.created_at else None,
            }
            for rx in items
        ],
        "total": total,
        "has_more": (skip + limit) < total,
    }


# ==========================================
# ENDPOINT — CONTROLLED SUBSTANCE LOG
# ==========================================

@router.get("/control-log", dependencies=[Depends(cashier_or_admin)])
def get_control_log(
    skip: int = 0,
    limit: int = Query(default=100, le=1000),
    db: Session = Depends(get_db),
):
    """
    Controlled substance log — all sales that included CONTROLLED drugs.
    Returns: sale_id, date, patient (from prescription), product, quantity, cashier.
    """
    # Find all sale_details where the product is classified as CONTROLLED
    controlled_details = (
        db.query(SaleDetail)
        .options(
            joinedload(SaleDetail.sale),
            joinedload(SaleDetail.product),
            joinedload(SaleDetail.salesperson),
        )
        .join(Product, SaleDetail.product_id == Product.id)
        .filter(Product.drug_classification == "CONTROLLED")
        .order_by(SaleDetail.sale_id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    # Build a lookup of prescriptions indexed by sale_id for efficient access
    sale_ids = list({d.sale_id for d in controlled_details if d.sale_id})
    prescriptions_by_sale: dict = {}
    if sale_ids:
        rxs = db.query(Prescription).filter(Prescription.sale_id.in_(sale_ids)).all()
        for rx in rxs:
            prescriptions_by_sale[rx.sale_id] = rx

    log_entries = []
    for detail in controlled_details:
        sale = detail.sale
        rx = prescriptions_by_sale.get(detail.sale_id) if detail.sale_id else None
        cashier = detail.salesperson

        log_entries.append({
            "sale_id": detail.sale_id,
            "date": sale.date.isoformat() if sale and sale.date else None,
            "patient_name": rx.patient_name if rx else None,
            "patient_cedula": rx.patient_cedula if rx else None,
            "doctor_name": rx.doctor_name if rx else None,
            "product_id": detail.product_id,
            "product_name": detail.product.name if detail.product else None,
            "quantity": float(detail.quantity),
            "cashier_id": detail.salesperson_id,
            "cashier_name": cashier.full_name or cashier.username if cashier else None,
            "prescription_id": rx.id if rx else None,
        })

    total = (
        db.query(SaleDetail)
        .join(Product, SaleDetail.product_id == Product.id)
        .filter(Product.drug_classification == "CONTROLLED")
        .count()
    )

    return {
        "items": log_entries,
        "total": total,
        "has_more": (skip + limit) < total,
    }
