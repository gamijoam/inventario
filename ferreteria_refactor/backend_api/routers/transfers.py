from fastapi import APIRouter, Depends, HTTPException, status
from collections import OrderedDict
import re
from sqlalchemy.orm import Session, joinedload, selectinload
from typing import List
from ..database.db import get_db
from ..models import models
from .. import schemas
from ..models.models import ProductInstanceStatus
from ..dependencies import require_any_permission
from ..models.tenant import Tenant
from ..tenant_context import get_tenant_schema
from ..services.serialized_stock_service import reconcile_serialized_product_stock

router = APIRouter(prefix="/transfers", tags=["transfers"])


def _is_flag_enabled(db: Session, flag_name: str) -> bool:
    """Lee el flag desde public.tenants.feature_flags del tenant actual."""
    schema = get_tenant_schema()
    if schema == "public":
        return False
    tenant = db.query(Tenant).filter(Tenant.schema_name == schema).first()
    if not tenant:
        return False
    return bool((tenant.feature_flags or {}).get(flag_name, False))


def _validate_and_collect_imeis(
    db: Session,
    item: schemas.TransferDetailCreate,
    source_warehouse_id: int,
    product_name: str,
):
    """
    Valida que cada product_instance_id:
      - existe
      - su product_id coincide con item.product_id
      - su warehouse_id == source_warehouse_id
      - su status == AVAILABLE
    Y que len(instances) == item.quantity.
    Devuelve la lista de ORM ProductInstance ya cargadas (en el mismo orden).
    Lanza HTTPException 400 si algo falla.
    """
    if len(item.instances) != item.quantity:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Para el producto '{product_name}' (has_imei=true) la cantidad de "
                f"IMEIs enviados ({len(item.instances)}) debe coincidir con la "
                f"cantidad a trasladar ({item.quantity})."
            ),
        )

    # Detectar duplicados en el mismo payload
    seen = set()
    dups = []
    for inst in item.instances:
        if inst.product_instance_id in seen:
            dups.append(inst.product_instance_id)
        seen.add(inst.product_instance_id)
    if dups:
        raise HTTPException(
            status_code=400,
            detail=(
                f"IMEIs duplicados en el mismo item: {dups}. Cada IMEI puede "
                f"aparecer una sola vez por linea."
            ),
        )

    # Cargar todas las ProductInstance de una
    ids = [inst.product_instance_id for inst in item.instances]
    db_instances = db.query(models.ProductInstance).filter(
        models.ProductInstance.id.in_(ids)
    ).all()
    by_id = {pi.id: pi for pi in db_instances}

    # Validar cada una
    for inst_id in ids:
        pi = by_id.get(inst_id)
        if not pi:
            raise HTTPException(
                status_code=400,
                detail=f"IMEI/serial con id={inst_id} no existe.",
            )
        if pi.product_id != item.product_id:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"IMEI '{pi.serial_number}' (id={inst_id}) pertenece al producto "
                    f"id={pi.product_id}, no al producto id={item.product_id} ({product_name})."
                ),
            )
        if pi.warehouse_id != source_warehouse_id:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"IMEI '{pi.serial_number}' (id={inst_id}) esta en la bodega "
                    f"id={pi.warehouse_id}, no en la bodega origen id={source_warehouse_id}."
                ),
            )
        if pi.status != ProductInstanceStatus.AVAILABLE:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"IMEI '{pi.serial_number}' (id={inst_id}) no esta AVAILABLE "
                    f"(status actual: {pi.status.value}). Solo se pueden trasladar "
                    f"IMEIs con status AVAILABLE."
                ),
            )

    return db_instances


def _movement_value(value):
    return getattr(value, "value", str(value))


def _extract_transfer_meta(description: str):
    text = description or ""
    package_match = re.search(r"package\s+(trf-[\w-]+)", text, re.IGNORECASE)
    guide_match = re.search(r"guide\s+([A-Z0-9-]+)", text, re.IGNORECASE)
    to_match = re.search(r"\s+to\s+(.+)$", text, re.IGNORECASE)
    from_match = re.search(r"\s+from\s+(.+)$", text, re.IGNORECASE)
    return {
        "package_id": package_match.group(1) if package_match else None,
        "dispatch_guide_number": guide_match.group(1) if guide_match else None,
        "company": (to_match.group(1) if to_match else from_match.group(1) if from_match else None),
    }


@router.get("/external/history", dependencies=[Depends(require_any_permission(["inventory.transfers.export", "inventory.transfers.import", "inventory.kardex.view"]))])
def read_external_transfer_history(direction: str = "all", limit: int = 200, db: Session = Depends(get_db)):
    """Historial unificado de salidas/entradas externas basado en Kardex."""
    from sqlalchemy.orm import joinedload

    allowed = {
        models.MovementType.EXTERNAL_TRANSFER_OUT,
        models.MovementType.EXTERNAL_TRANSFER_IN,
    }
    query = db.query(models.Kardex).options(joinedload(models.Kardex.product)).filter(
        models.Kardex.movement_type.in_(list(allowed))
    )
    if direction == "out":
        query = query.filter(models.Kardex.movement_type == models.MovementType.EXTERNAL_TRANSFER_OUT)
    elif direction == "in":
        query = query.filter(models.Kardex.movement_type == models.MovementType.EXTERNAL_TRANSFER_IN)

    movements = query.order_by(models.Kardex.date.desc()).limit(max(1, min(limit, 500))).all()
    warehouse_ids = {m.warehouse_id for m in movements if m.warehouse_id}
    warehouses = {}
    if warehouse_ids:
        warehouses = {
            w.id: w.name for w in db.query(models.Warehouse).filter(models.Warehouse.id.in_(warehouse_ids)).all()
        }

    groups = OrderedDict()
    for movement in movements:
        movement_type = _movement_value(movement.movement_type)
        meta = _extract_transfer_meta(movement.description)
        movement_direction = "out" if movement_type == "EXTERNAL_TRANSFER_OUT" else "in"
        package_id = meta["package_id"]
        if package_id:
            key = f"{movement_direction}:{package_id}"
        else:
            minute = movement.date.strftime("%Y-%m-%d %H:%M") if movement.date else "sin-fecha"
            key = f"{movement_direction}:{minute}:{movement.description or ''}"

        if key not in groups:
            groups[key] = {
                "id": key,
                "direction": movement_direction,
                "movement_type": movement_type,
                "package_id": package_id,
                "dispatch_guide_number": meta["dispatch_guide_number"],
                "company": meta["company"],
                "date": movement.date,
                "warehouse_id": movement.warehouse_id,
                "warehouse_name": warehouses.get(movement.warehouse_id),
                "models_count": 0,
                "units_count": 0.0,
                "items": [],
                "description": movement.description,
            }
        group = groups[key]
        qty = abs(float(movement.quantity or 0))
        group["models_count"] += 1
        group["units_count"] += qty
        if movement.date and movement.date > group["date"]:
            group["date"] = movement.date
        group["items"].append({
            "movement_id": movement.id,
            "product_id": movement.product_id,
            "product_name": movement.product.name if movement.product else "Producto",
            "sku": movement.product.sku if movement.product else None,
            "quantity": qty,
            "balance_after": float(movement.balance_after or 0),
            "warehouse_id": movement.warehouse_id,
            "warehouse_name": warehouses.get(movement.warehouse_id),
            "description": movement.description,
        })

    return list(groups.values())


@router.get("", response_model=List[schemas.InventoryTransferRead], dependencies=[Depends(require_any_permission(["inventory.transfers.export", "inventory.transfers.import", "inventory.stock.adjust"]))])
def read_transfers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """List all inventory transfers."""
    transfers = db.query(models.InventoryTransfer)\
        .options(
            joinedload(models.InventoryTransfer.source_warehouse),
            joinedload(models.InventoryTransfer.target_warehouse),
            selectinload(models.InventoryTransfer.details).joinedload(models.TransferDetail.product),
            selectinload(models.InventoryTransfer.details).selectinload(models.TransferDetail.instances).joinedload(models.TransferDetailInstance.product_instance),
        )\
        .order_by(models.InventoryTransfer.date.desc())\
        .offset(skip).limit(limit).all()
    return transfers


@router.post("", response_model=schemas.InventoryTransferRead, dependencies=[Depends(require_any_permission(["inventory.transfers.export", "inventory.transfers.import", "inventory.stock.adjust"]))])
def create_transfer(transfer_data: schemas.InventoryTransferCreate, db: Session = Depends(get_db)):
    """Create and execute an inventory transfer.
    Si el feature flag 'traslados_con_imei' esta ON, valida y mueve los
    ProductInstance (IMEIs/seriales) especificados. Si esta OFF, comportamiento
    legacy (solo cantidad)."""

    # 1. Validacion de bodegas
    source_wh = db.query(models.Warehouse).filter(models.Warehouse.id == transfer_data.source_warehouse_id).first()
    target_wh = db.query(models.Warehouse).filter(models.Warehouse.id == transfer_data.target_warehouse_id).first()

    if not source_wh or not target_wh:
        raise HTTPException(status_code=404, detail="Source or Target Warehouse not found")

    if source_wh.id == target_wh.id:
        raise HTTPException(status_code=400, detail="Cannot transfer to the same warehouse")

    # 2. Feature flag: si OFF, comportamiento legacy (no exigir ni mover IMEIs)
    imei_enabled = _is_flag_enabled(db, 'traslados_con_imei')

    # 3. Pre-validacion de IMEIs por item (solo si flag ON)
    #    Tambien decidimos aca si el producto tiene has_imei=true para exigir instances.
    pre_validated_imeis = {}  # {item_index: list[ProductInstance]}
    if imei_enabled:
        for idx, item in enumerate(transfer_data.items):
            product = db.query(models.Product).get(item.product_id)
            if not product:
                raise HTTPException(status_code=404, detail=f"Producto id={item.product_id} no existe")
            if product.has_imei:
                # El producto tiene IMEI: exigir instances y validar
                pre_validated_imeis[idx] = _validate_and_collect_imeis(
                    db, item, source_wh.id, product.name
                )
            else:
                # El producto no tiene IMEI: instances debe estar vacio (defensivo)
                if item.instances:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"El producto '{product.name}' (has_imei=false) no acepta "
                            f"IMEIs en este traslado, pero se enviaron {len(item.instances)}."
                        ),
                    )

    # 4. Check Stock Availability. For serialized products, IMEIs are the source of truth.
    for idx, item in enumerate(transfer_data.items):
        product = db.query(models.Product).get(item.product_id)
        if imei_enabled and product and product.has_imei:
            current_qty = len(pre_validated_imeis.get(idx, []))
        else:
            stock_record = db.query(models.ProductStock).filter(
                models.ProductStock.warehouse_id == source_wh.id,
                models.ProductStock.product_id == item.product_id
            ).first()
            current_qty = stock_record.quantity if stock_record else 0

        if current_qty < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente para el producto '{product.name}'. Disponible: {current_qty}, Solicitado: {item.quantity}"
            )

    # 5. Create Transfer Record
    new_transfer = models.InventoryTransfer(
        source_warehouse_id=transfer_data.source_warehouse_id,
        target_warehouse_id=transfer_data.target_warehouse_id,
        date=transfer_data.date,
        notes=transfer_data.notes,
        status="COMPLETED"
    )
    db.add(new_transfer)
    db.flush()

    # 6. Execute Movement, Create Details, and (if flag ON) Move IMEIs
    for idx, item in enumerate(transfer_data.items):
        # 6a) Create Detail
        detail = models.TransferDetail(
            transfer_id=new_transfer.id,
            product_id=item.product_id,
            quantity=item.quantity
        )
        db.add(detail)
        db.flush()  # get detail.id for TransferDetailInstance rows

        # 6b) DECREASE Source stock
        source_stock = db.query(models.ProductStock).filter(
            models.ProductStock.warehouse_id == source_wh.id,
            models.ProductStock.product_id == item.product_id
        ).first()
        source_stock.quantity -= item.quantity

        # 6c) INCREASE Target stock
        target_stock = db.query(models.ProductStock).filter(
            models.ProductStock.warehouse_id == target_wh.id,
            models.ProductStock.product_id == item.product_id
        ).first()
        if not target_stock:
            target_stock = models.ProductStock(
                warehouse_id=target_wh.id,
                product_id=item.product_id,
                quantity=0
            )
            db.add(target_stock)
        target_stock.quantity += item.quantity

        # 6d) Si flag ON y el producto tiene IMEI, mover las ProductInstance
        if imei_enabled and idx in pre_validated_imeis:
            for pi in pre_validated_imeis[idx]:
                # Cambiar warehouse_id (la instancia se "mueve" entre bodegas)
                pi.warehouse_id = target_wh.id
                # Crear el link transfer_detail_instance (audit trail)
                tdi = models.TransferDetailInstance(
                    transfer_detail_id=detail.id,
                    product_instance_id=pi.id
                )
                db.add(tdi)
            reconcile_serialized_product_stock(db, item.product_id)

    try:
        db.commit()
        return db.query(models.InventoryTransfer).options(
            joinedload(models.InventoryTransfer.source_warehouse),
            joinedload(models.InventoryTransfer.target_warehouse),
            selectinload(models.InventoryTransfer.details).joinedload(models.TransferDetail.product),
            selectinload(models.InventoryTransfer.details).selectinload(models.TransferDetail.instances).joinedload(models.TransferDetailInstance.product_instance),
        ).get(new_transfer.id)

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Transfer failed: {str(e)}")
