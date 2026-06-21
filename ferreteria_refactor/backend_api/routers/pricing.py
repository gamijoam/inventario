"""
Router — Cambios masivos de precios (Margen Global)

Permite aplicar un margen porcentual a TODOS los productos de un tenant,
actualizando price_lists (recomendado), products.price o ambos.
Mantiene historial en price_change_log para auditoría y posible reversión.
"""
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP, ROUND_CEILING
from typing import List, Optional, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database.db import get_db
from ..dependencies import has_role
from ..models.models import User, UserRole
from ..tenant_context import get_tenant_schema
from ..cache import invalidate_resource

router = APIRouter(prefix="/pricing", tags=["pricing"])


# ── Pydantic ──────────────────────────────────────────────────────────────────

class PriceListOut(BaseModel):
    id: int
    name: str
    is_active: bool
    currency_code: str = "FLEX"
    payment_policy: str = "flexible"


class BulkMarginRequest(BaseModel):
    margin_percent: Decimal = Field(..., ge=-99, le=10000, description="Margen porcentual a aplicar (ej. 45)")
    target: Literal["price_list", "product_price", "both"] = "price_list"
    price_list_id: Optional[int] = None  # requerido si target incluye price_list
    rounding: Literal["none", "integer", "multiple_5", "smart"] = "smart"
    notes: Optional[str] = None
    limit_preview: int = Field(10, ge=1, le=50)


class PreviewItem(BaseModel):
    product_id: int
    product_name: str
    cost_price: float
    price_before: float
    price_after: float
    diff: float


class PreviewResponse(BaseModel):
    margin_percent: float
    target: str
    total_products: int
    sample: List[PreviewItem]
    total_value_before: float
    total_value_after: float


class ApplyResponse(BaseModel):
    log_id: int
    margin_percent: float
    target: str
    total_products: int
    total_value_before: float
    total_value_after: float
    applied_at: datetime


class HistoryItem(BaseModel):
    id: int
    applied_at: datetime
    user_email: Optional[str]
    margin_percent: float
    target: str
    price_list_id: Optional[int]
    rounding: str
    total_products: int
    total_value_before: float
    total_value_after: float
    notes: Optional[str]
    reverted_at: Optional[datetime]
    reverted_by: Optional[str]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _apply_rounding(value: Decimal, mode: str) -> Decimal:
    if mode == "integer":
        return value.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    if mode == "multiple_5":
        # Redondear al múltiplo de 5 más cercano
        return (value / Decimal(5)).quantize(Decimal("1"), rounding=ROUND_HALF_UP) * Decimal(5)
    if mode == "smart":
        # Replica de la fórmula del botón "Calcular" en ProductForm.jsx:
        #   si value <= 20 → entero más cercano (HALF_UP)
        #   si value >  20 → múltiplo de 5 hacia ARRIBA (CEILING)
        if value <= 0:
            return value.quantize(Decimal("0.01"))
        if value <= Decimal(20):
            return value.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        return (value / Decimal(5)).quantize(Decimal("1"), rounding=ROUND_CEILING) * Decimal(5)
    return value.quantize(Decimal("0.0001"))


def _compute_new_price(cost: Decimal, margin: Decimal, rounding: str) -> Decimal:
    raw = cost * (Decimal(1) + margin / Decimal(100))
    rounded = _apply_rounding(raw, rounding)
    # Seguro: si el redondeo lo dejó en 0 pero el costo es > 0,
    # no perdemos el precio — usamos al menos el costo (NUNCA vender bajo costo).
    if rounded <= 0 and cost > 0:
        return cost.quantize(Decimal("0.01"))
    return rounded


def _schema(db: Session) -> str:
    s = get_tenant_schema()
    if s == "public":
        raise HTTPException(status_code=400, detail="Debes estar dentro de una empresa")
    return s


def _invalidate_pricing_cache(schema: str) -> None:
    for resource in ("catalog", "price_lists", "pos_init", "pos-init"):
        try:
            invalidate_resource(schema, resource)
        except Exception:
            pass


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/price-lists", response_model=List[PriceListOut])
def list_price_lists(db: Session = Depends(get_db),
                     _: User = Depends(has_role([UserRole.ADMIN]))):
    """Lista de price lists del tenant actual."""
    s = _schema(db)
    rows = db.execute(text(
        f"SELECT id, name, is_active, COALESCE(currency_code, 'FLEX') AS currency_code, "
        f"COALESCE(payment_policy, 'flexible') AS payment_policy "
        f"FROM \"{s}\".price_lists ORDER BY id"
    )).fetchall()
    return [PriceListOut(
        id=r.id, name=r.name, is_active=bool(r.is_active),
        currency_code=r.currency_code or "FLEX",
        payment_policy=r.payment_policy or "flexible"
    ) for r in rows]


def _compute_preview(db: Session, schema: str, req: BulkMarginRequest):
    """Calcula la lista completa de productos afectados y devuelve (todos, sample, totales)."""
    if req.target in ("price_list", "both") and not req.price_list_id:
        raise HTTPException(status_code=400, detail="price_list_id es requerido para este target")

    # Obtener todos los productos del tenant (solo activos y con cost > 0)
    products = db.execute(text(
        f'SELECT id, name, cost_price FROM "{schema}".products '
        f'WHERE is_active = true AND COALESCE(cost_price, 0) > 0 '
        f'ORDER BY id'
    )).fetchall()

    if not products:
        raise HTTPException(status_code=400, detail="No hay productos activos con costo definido")

    # Obtener precios actuales según target
    price_map = {}  # product_id -> precio actual (Decimal)
    if req.target == "product_price":
        for p in products:
            row = db.execute(text(f'SELECT price FROM "{schema}".products WHERE id = :id'),
                             {"id": p.id}).first()
            price_map[p.id] = Decimal(str(row.price or 0))
    elif req.target == "price_list":
        for p in products:
            row = db.execute(text(
                f'SELECT price FROM "{schema}".product_prices '
                f'WHERE product_id = :pid AND price_list_id = :lid'
            ), {"pid": p.id, "lid": req.price_list_id}).first()
            price_map[p.id] = Decimal(str(row.price)) if row else Decimal(0)
    else:  # both → tomamos product_prices como referencia visual
        for p in products:
            row = db.execute(text(
                f'SELECT price FROM "{schema}".product_prices '
                f'WHERE product_id = :pid AND price_list_id = :lid'
            ), {"pid": p.id, "lid": req.price_list_id}).first()
            price_map[p.id] = Decimal(str(row.price)) if row else Decimal(0)

    margin = Decimal(str(req.margin_percent))
    items = []
    total_before = Decimal(0)
    total_after = Decimal(0)
    for p in products:
        cost = Decimal(str(p.cost_price))
        before = price_map.get(p.id, Decimal(0))
        after = _compute_new_price(cost, margin, req.rounding)
        items.append({
            "product_id": p.id, "product_name": p.name,
            "cost_price": float(cost), "price_before": float(before),
            "price_after": float(after), "diff": float(after - before)
        })
        total_before += before
        total_after  += after

    return items, total_before, total_after


@router.delete("/price-lists/{list_id}")
def delete_price_list(list_id: int,
                      db: Session = Depends(get_db),
                      current_user: User = Depends(has_role([UserRole.ADMIN]))):
    """
    Elimina una lista de precios y todos sus product_prices asociados.
    Restricciones:
      - No se puede eliminar si es la única lista activa (debe quedar al menos una).
      - Cualquier acción es irreversible (no hay restore).
    """
    s = _schema(db)
    # Verificar existencia
    lst = db.execute(text(
        f'SELECT id, name, is_active FROM "{s}".price_lists WHERE id = :id'
    ), {"id": list_id}).first()
    if not lst:
        raise HTTPException(status_code=404, detail="Lista de precios no encontrada")

    # Contar listas activas restantes
    other_active = db.execute(text(
        f'SELECT COUNT(*) FROM "{s}".price_lists WHERE id != :id AND is_active = true'
    ), {"id": list_id}).scalar() or 0

    if lst.is_active and other_active == 0:
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar: es la única lista de precios activa. "
                   "Crea otra primero o desactivala manualmente."
        )

    try:
        # Borrar dependencias primero (product_prices)
        deleted_prices = db.execute(text(
            f'DELETE FROM "{s}".product_prices WHERE price_list_id = :id'
        ), {"id": list_id}).rowcount

        # Borrar la lista
        db.execute(text(
            f'DELETE FROM "{s}".price_lists WHERE id = :id'
        ), {"id": list_id})

        db.commit()
        _invalidate_pricing_cache(s)
        return {
            "success": True,
            "message": f"Lista \"{lst.name}\" eliminada",
            "deleted_product_prices": deleted_prices
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al eliminar: {e}")


@router.post("/bulk-margin-preview", response_model=PreviewResponse)
def preview_bulk_margin(req: BulkMarginRequest,
                       db: Session = Depends(get_db),
                       _: User = Depends(has_role([UserRole.ADMIN]))):
    """Devuelve una vista previa del cambio masivo sin aplicarlo."""
    s = _schema(db)
    items, total_before, total_after = _compute_preview(db, s, req)

    sample = [PreviewItem(**x) for x in items[:req.limit_preview]]
    return PreviewResponse(
        margin_percent=float(req.margin_percent),
        target=req.target,
        total_products=len(items),
        sample=sample,
        total_value_before=float(total_before),
        total_value_after=float(total_after),
    )


@router.post("/bulk-margin-apply", response_model=ApplyResponse)
def apply_bulk_margin(req: BulkMarginRequest,
                      db: Session = Depends(get_db),
                      current_user: User = Depends(has_role([UserRole.ADMIN]))):
    """
    Aplica el margen masivo dentro de una transacción atómica.
    Registra el cambio en price_change_log + items.
    """
    s = _schema(db)
    items, total_before, total_after = _compute_preview(db, s, req)
    margin = Decimal(str(req.margin_percent))

    try:
        # 1) INSERT log header
        log_row = db.execute(text(f'''
            INSERT INTO "{s}".price_change_log
                (applied_at, user_email, margin_percent, target, price_list_id, rounding,
                 total_products, total_value_before, total_value_after, notes)
            VALUES
                (NOW(), :email, :m, :tgt, :plid, :r, :tp, :tvb, :tva, :n)
            RETURNING id
        '''), {
            "email": current_user.email,
            "m": float(margin), "tgt": req.target,
            "plid": req.price_list_id, "r": req.rounding,
            "tp": len(items), "tvb": float(total_before), "tva": float(total_after),
            "n": req.notes
        }).first()
        log_id = log_row.id

        # 2) Aplicar cambios + INSERT items
        for it in items:
            pid = it["product_id"]
            new_price = Decimal(str(it["price_after"]))

            if req.target in ("price_list", "both") and req.price_list_id:
                # UPSERT en product_prices
                upd = db.execute(text(
                    f'UPDATE "{s}".product_prices SET price = :p '
                    f'WHERE product_id = :pid AND price_list_id = :lid'
                ), {"p": float(new_price), "pid": pid, "lid": req.price_list_id})
                if upd.rowcount == 0:
                    db.execute(text(
                        f'INSERT INTO "{s}".product_prices (product_id, price_list_id, price) '
                        f'VALUES (:pid, :lid, :p)'
                    ), {"pid": pid, "lid": req.price_list_id, "p": float(new_price)})

            if req.target in ("product_price", "both"):
                db.execute(text(
                    f'UPDATE "{s}".products SET price = :p, profit_margin = :m WHERE id = :pid'
                ), {"p": float(new_price), "m": float(margin), "pid": pid})

            db.execute(text(f'''
                INSERT INTO "{s}".price_change_log_items
                    (log_id, product_id, product_name, cost_price, price_before, price_after)
                VALUES (:lid, :pid, :pn, :cp, :pb, :pa)
            '''), {
                "lid": log_id, "pid": pid, "pn": it["product_name"],
                "cp": it["cost_price"], "pb": it["price_before"], "pa": it["price_after"]
            })

        db.commit()
        _invalidate_pricing_cache(s)
        return ApplyResponse(
            log_id=log_id,
            margin_percent=float(margin),
            target=req.target,
            total_products=len(items),
            total_value_before=float(total_before),
            total_value_after=float(total_after),
            applied_at=datetime.now()
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error aplicando margen: {e}")


@router.get("/history", response_model=List[HistoryItem])
def get_history(limit: int = 30,
                db: Session = Depends(get_db),
                _: User = Depends(has_role([UserRole.ADMIN]))):
    """Historial de cambios masivos de precios."""
    s = _schema(db)
    rows = db.execute(text(
        f'SELECT id, applied_at, user_email, margin_percent, target, price_list_id, '
        f'       rounding, total_products, total_value_before, total_value_after, '
        f'       notes, reverted_at, reverted_by '
        f'FROM "{s}".price_change_log '
        f'ORDER BY applied_at DESC LIMIT :lim'
    ), {"lim": limit}).fetchall()
    return [HistoryItem(
        id=r.id, applied_at=r.applied_at, user_email=r.user_email,
        margin_percent=float(r.margin_percent), target=r.target,
        price_list_id=r.price_list_id, rounding=r.rounding,
        total_products=r.total_products,
        total_value_before=float(r.total_value_before),
        total_value_after=float(r.total_value_after),
        notes=r.notes,
        reverted_at=r.reverted_at, reverted_by=r.reverted_by
    ) for r in rows]


@router.post("/history/{log_id}/revert", response_model=ApplyResponse)
def revert_change(log_id: int,
                  db: Session = Depends(get_db),
                  current_user: User = Depends(has_role([UserRole.ADMIN]))):
    """Revierte un cambio anterior: restaura los precios previos por producto."""
    s = _schema(db)
    log = db.execute(text(
        f'SELECT id, target, price_list_id, reverted_at FROM "{s}".price_change_log WHERE id = :id'
    ), {"id": log_id}).first()
    if not log:
        raise HTTPException(status_code=404, detail="Cambio no encontrado")
    if log.reverted_at:
        raise HTTPException(status_code=400, detail="Este cambio ya fue revertido")

    items = db.execute(text(
        f'SELECT product_id, price_before FROM "{s}".price_change_log_items WHERE log_id = :id'
    ), {"id": log_id}).fetchall()

    try:
        for it in items:
            if log.target in ("price_list", "both") and log.price_list_id:
                db.execute(text(
                    f'UPDATE "{s}".product_prices SET price = :p '
                    f'WHERE product_id = :pid AND price_list_id = :lid'
                ), {"p": float(it.price_before), "pid": it.product_id, "lid": log.price_list_id})
            if log.target in ("product_price", "both"):
                db.execute(text(
                    f'UPDATE "{s}".products SET price = :p WHERE id = :pid'
                ), {"p": float(it.price_before), "pid": it.product_id})

        db.execute(text(
            f'UPDATE "{s}".price_change_log SET reverted_at = NOW(), reverted_by = :u WHERE id = :id'
        ), {"u": current_user.email, "id": log_id})

        db.commit()
        _invalidate_pricing_cache(s)
        return ApplyResponse(
            log_id=log_id, margin_percent=0, target=log.target,
            total_products=len(items),
            total_value_before=0, total_value_after=0,
            applied_at=datetime.now()
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error revirtiendo: {e}")
