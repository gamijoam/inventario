"""
Router — Transferencias de stock entre empresas del mismo grupo
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text
from typing import List
from datetime import datetime

from ..database.db import get_db, engine
from ..models.organization import (
    Organization, OrganizationUser,
    InterCompanyTransfer, InterCompanyTransferItem
)
from ..models.models import User, Product, Kardex
from ..models.tenant import Tenant
from ..schemas.organization import (
    InterCompanyTransferCreate, InterCompanyTransferOut, TransferItemOut
)
from ..dependencies import get_current_active_user
from ..tenant_context import get_tenant_schema
from ..utils.time_utils import get_venezuela_now

router = APIRouter(prefix="/inter-transfers", tags=["inter-transfers"])


def _build_transfer_out(transfer: InterCompanyTransfer, db: Session) -> InterCompanyTransferOut:
    from_t = db.query(Tenant).filter(Tenant.id == transfer.from_tenant_id).first()
    to_t   = db.query(Tenant).filter(Tenant.id == transfer.to_tenant_id).first()
    return InterCompanyTransferOut(
        id              = transfer.id,
        organization_id = transfer.organization_id,
        from_tenant_id  = transfer.from_tenant_id,
        to_tenant_id    = transfer.to_tenant_id,
        status          = transfer.status,
        notes           = transfer.notes,
        created_at      = transfer.created_at,
        completed_at    = transfer.completed_at,
        from_tenant_name= from_t.name if from_t else None,
        to_tenant_name  = to_t.name  if to_t  else None,
        items           = [TransferItemOut(
            id=i.id, product_sku=i.product_sku, product_name=i.product_name,
            quantity=float(i.quantity), unit_cost=float(i.unit_cost)
        ) for i in transfer.items]
    )


@router.post("", response_model=InterCompanyTransferOut, status_code=201)
def create_transfer(
    data: InterCompanyTransferCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Crear solicitud de transferencia de stock a otra empresa del mismo grupo.
    El tenant de origen es el tenant actual del usuario.
    """
    schema = get_tenant_schema()
    if schema == "public":
        raise HTTPException(status_code=400, detail="Debes estar dentro de una empresa")

    from_tenant = db.query(Tenant).filter(Tenant.schema_name == schema).first()
    if not from_tenant:
        raise HTTPException(status_code=404, detail="Empresa de origen no encontrada")
    if not from_tenant.organization_id:
        raise HTTPException(status_code=400, detail="Esta empresa no pertenece a ninguna organización")

    to_tenant = db.query(Tenant).filter(Tenant.id == data.to_tenant_id).first()
    if not to_tenant:
        raise HTTPException(status_code=404, detail="Empresa de destino no encontrada")
    if to_tenant.organization_id != from_tenant.organization_id:
        raise HTTPException(status_code=400, detail="La empresa de destino no pertenece al mismo grupo")
    if to_tenant.id == from_tenant.id:
        raise HTTPException(status_code=400, detail="No puedes transferir a la misma empresa")
    if not data.items:
        raise HTTPException(status_code=400, detail="Debes incluir al menos un ítem")

    # Verificar stock disponible para cada ítem
    for item in data.items:
        prod = db.query(Product).filter(Product.sku == item.product_sku).first()
        if not prod:
            raise HTTPException(status_code=404, detail=f"Producto '{item.product_sku}' no encontrado")
        if float(prod.stock) < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente para '{prod.name}': disponible {prod.stock}, solicitado {item.quantity}"
            )

    transfer = InterCompanyTransfer(
        organization_id = from_tenant.organization_id,
        from_tenant_id  = from_tenant.id,
        to_tenant_id    = data.to_tenant_id,
        status          = "PENDING",
        notes           = data.notes,
        created_by      = current_user.id
    )
    db.add(transfer)
    db.flush()

    for item in data.items:
        prod = db.query(Product).filter(Product.sku == item.product_sku).first()
        db.add(InterCompanyTransferItem(
            transfer_id  = transfer.id,
            product_sku  = item.product_sku,
            product_name = item.product_name or (prod.name if prod else item.product_sku),
            quantity     = item.quantity,
            unit_cost    = item.unit_cost or float(prod.cost_price or 0)
        ))

    db.commit()
    db.refresh(transfer)
    return _build_transfer_out(transfer, db)


@router.get("", response_model=List[InterCompanyTransferOut])
def list_transfers(
    status: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Listar transferencias de la empresa actual (enviadas y recibidas)."""
    schema = get_tenant_schema()
    tenant = db.query(Tenant).filter(Tenant.schema_name == schema).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    from sqlalchemy import or_
    q = db.query(InterCompanyTransfer).options(
        joinedload(InterCompanyTransfer.items)
    ).filter(
        or_(
            InterCompanyTransfer.from_tenant_id == tenant.id,
            InterCompanyTransfer.to_tenant_id   == tenant.id
        )
    )
    if status:
        q = q.filter(InterCompanyTransfer.status == status.upper())

    transfers = q.order_by(InterCompanyTransfer.created_at.desc()).all()
    return [_build_transfer_out(t, db) for t in transfers]


@router.patch("/{transfer_id}/accept", response_model=InterCompanyTransferOut)
def accept_transfer(
    transfer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Aceptar una transferencia entrante.
    Descuenta stock de la empresa origen, suma en la empresa destino,
    y registra en Kardex de ambas.
    """
    schema = get_tenant_schema()
    tenant = db.query(Tenant).filter(Tenant.schema_name == schema).first()

    transfer = db.query(InterCompanyTransfer).options(
        joinedload(InterCompanyTransfer.items)
    ).filter(InterCompanyTransfer.id == transfer_id).first()

    if not transfer:
        raise HTTPException(status_code=404, detail="Transferencia no encontrada")
    if transfer.to_tenant_id != tenant.id:
        raise HTTPException(status_code=403, detail="Solo la empresa destino puede aceptar")
    if transfer.status != "PENDING":
        raise HTTPException(status_code=400, detail=f"La transferencia está en estado {transfer.status}")

    from_tenant_obj = db.query(Tenant).filter(Tenant.id == transfer.from_tenant_id).first()
    from_schema = from_tenant_obj.schema_name

    # ── Usar conexión directa al engine (sin search_path del tenant) ────────
    # Esto evita que el pool de SQLAlchemy aplique search_path=colaloca2
    # cuando necesitamos modificar restaurante3
    raw_conn = engine.connect()
    raw_tx = raw_conn.begin()
    raw_conn.execute(text('SET search_path TO public'))

    try:
        # ── Verificar stock suficiente en origen ANTES de hacer cambios ────────
        for item in transfer.items:
            qty = float(item.quantity)
            stock_disp = raw_conn.execute(
                text(f'SELECT stock FROM "{from_schema}".products WHERE sku = :sku'),
                {"sku": item.product_sku}
            ).scalar()

            if stock_disp is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"Producto '{item.product_sku}' no encontrado en empresa origen"
                )
            if float(stock_disp) < qty:
                raise HTTPException(
                    status_code=400,
                    detail=f"Stock insuficiente para '{item.product_name}': "
                           f"disponible {float(stock_disp):.0f}, solicitado {qty:.0f}"
                )

        for item in transfer.items:
            qty = float(item.quantity)

            # ── Origen: descontar stock ───────────────────────────────────────
            raw_conn.execute(
                text(f'UPDATE "{from_schema}".products SET stock = stock - :qty WHERE sku = :sku'),
                {"qty": qty, "sku": item.product_sku}
            )
            new_stock_origin = raw_conn.execute(
                text(f'SELECT stock FROM "{from_schema}".products WHERE sku = :sku'),
                {"sku": item.product_sku}
            ).scalar() or 0

            # Kardex origen
            prod_id_origin = raw_conn.execute(
                text(f'SELECT id FROM "{from_schema}".products WHERE sku = :sku'),
                {"sku": item.product_sku}
            ).scalar()
            if prod_id_origin:
                raw_conn.execute(
                    text(f'INSERT INTO "{from_schema}".kardex (product_id, movement_type, quantity, balance_after, description, date) VALUES (:pid, :mtype, :qty, :bal, :desc, NOW())'),
                    {"pid": prod_id_origin, "mtype": "EXTERNAL_TRANSFER_OUT", "qty": -qty, "bal": new_stock_origin, "desc": f"Traslado a {schema} — #{transfer_id}"}
                )

            # ── Destino: sumar stock ──────────────────────────────────────────
            prod_id_dest = raw_conn.execute(
                text(f'SELECT id FROM "{schema}".products WHERE sku = :sku'),
                {"sku": item.product_sku}
            ).scalar()

            if prod_id_dest:
                raw_conn.execute(
                    text(f'UPDATE "{schema}".products SET stock = stock + :qty WHERE sku = :sku'),
                    {"qty": qty, "sku": item.product_sku}
                )
                new_stock_dest = raw_conn.execute(
                    text(f'SELECT stock FROM "{schema}".products WHERE sku = :sku'),
                    {"sku": item.product_sku}
                ).scalar() or 0
                raw_conn.execute(
                    text(f'INSERT INTO "{schema}".kardex (product_id, movement_type, quantity, balance_after, description, date) VALUES (:pid, :mtype, :qty, :bal, :desc, NOW())'),
                    {"pid": prod_id_dest, "mtype": "EXTERNAL_TRANSFER_IN", "qty": qty, "bal": new_stock_dest, "desc": f"Traslado desde {from_schema} — #{transfer_id}"}
                )
            else:
                # Producto nuevo en destino: copiar todo del origen
                raw_conn.execute(text(f"""
                    INSERT INTO "{schema}".products
                        (name, sku, stock, price, cost_price, min_stock, is_active,
                         is_box, is_combo, is_service, is_discount_active,
                         is_barbershop_service, is_commissionable, requires_prescription,
                         is_menu_item, needs_kitchen, has_imei, updated_at)
                    SELECT name, sku, :qty, price, cost_price,
                        COALESCE(min_stock, 0), true, false,
                        COALESCE(is_combo, false), COALESCE(is_service, false),
                        false, false, false, false, false, false,
                        COALESCE(has_imei, false), NOW()
                    FROM "{from_schema}".products WHERE sku = :sku
                    ON CONFLICT (sku) DO UPDATE SET stock = "{schema}".products.stock + EXCLUDED.stock
                """), {"qty": qty, "sku": item.product_sku})

                new_prod_id = raw_conn.execute(
                    text(f'SELECT id FROM "{schema}".products WHERE sku = :sku'),
                    {"sku": item.product_sku}
                ).scalar()
                if new_prod_id:
                    raw_conn.execute(
                        text(f'INSERT INTO "{schema}".kardex (product_id, movement_type, quantity, balance_after, description, date) VALUES (:pid, :mtype, :qty, :bal, :desc, NOW())'),
                        {"pid": new_prod_id, "mtype": "EXTERNAL_TRANSFER_IN", "qty": qty, "bal": qty, "desc": f"Traslado desde {from_schema} — #{transfer_id} (nuevo)"}
                    )

        raw_tx.commit()
    except HTTPException:
        raw_tx.rollback()
        raise
    except Exception as e:
        raw_tx.rollback()
        raise HTTPException(status_code=500, detail=f"Error en traslado: {str(e)}")
    finally:
        raw_conn.close()

    # Marcar transferencia como completada
    transfer.status       = "ACCEPTED"
    transfer.completed_at = get_venezuela_now()
    db.commit()
    db.refresh(transfer)
    return _build_transfer_out(transfer, db)


@router.patch("/{transfer_id}/reject", response_model=InterCompanyTransferOut)
def reject_transfer(
    transfer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Rechazar una transferencia entrante."""
    schema = get_tenant_schema()
    tenant = db.query(Tenant).filter(Tenant.schema_name == schema).first()

    transfer = db.query(InterCompanyTransfer).options(
        joinedload(InterCompanyTransfer.items)
    ).filter(InterCompanyTransfer.id == transfer_id).first()

    if not transfer:
        raise HTTPException(status_code=404, detail="Transferencia no encontrada")
    if transfer.to_tenant_id != tenant.id and transfer.from_tenant_id != tenant.id:
        raise HTTPException(status_code=403, detail="No tienes acceso a esta transferencia")
    if transfer.status != "PENDING":
        raise HTTPException(status_code=400, detail=f"No se puede rechazar una transferencia en estado {transfer.status}")

    transfer.status       = "REJECTED"
    transfer.completed_at = get_venezuela_now()
    db.commit()
    db.refresh(transfer)
    return _build_transfer_out(transfer, db)
