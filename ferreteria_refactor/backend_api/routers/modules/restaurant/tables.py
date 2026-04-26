from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Any

from ....database.db import get_db
from ....dependencies import get_current_active_user, require_restaurant_module
from ....models.restaurant import RestaurantTable, TableStatusDB
from ....schemas.restaurant import TableCreate, TableRead, TableUpdate

# Prefix matches file structure logic, but will be mounted in main with /api/v1/restaurant
router = APIRouter(
    prefix="/tables",
    tags=["Restaurante - Mesas"],
    dependencies=[Depends(get_current_active_user), Depends(require_restaurant_module)]
)

@router.get("/", response_model=List[TableRead])
def get_tables(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Obtener lista de mesas configuradas.
    """
    tables = db.query(RestaurantTable).offset(skip).limit(limit).all()
    
    # Enrich tables with current_order_id if occupied
    # This is a N+1 query problem candidate, but acceptable for MVP with low table count (usually < 50)
    # Optimized approach: Load active orders in one query and map them.
    from ....models.restaurant import RestaurantOrder, OrderStatusDB
    
    active_orders = db.query(RestaurantOrder).filter(
        RestaurantOrder.status.notin_([OrderStatusDB.PAID, OrderStatusDB.CANCELLED])
    ).all()
    
    order_map = {order.table_id: order for order in active_orders}

    for table in tables:
        # Dynamically attach attributes for Pydantic schema
        order = order_map.get(table.id)
        if order:
            table.current_order_id = order.id
            table.current_order_total = order.total_amount
            table.current_order_time = order.created_at
        else:
            table.current_order_id = None
            table.current_order_total = None
            table.current_order_time = None        
    return tables

@router.post("/", response_model=TableRead, status_code=status.HTTP_201_CREATED)
def create_table(table: TableCreate, db: Session = Depends(get_db)):
    """
    Registrar una nueva mesa en el sistema.
    """
    db_table = RestaurantTable(**table.model_dump())
    db.add(db_table)
    db.commit()
    return db_table

@router.put("/{table_id}", response_model=TableRead)
def update_table(table_id: int, table_update: TableUpdate, db: Session = Depends(get_db)):
    """
    Actualizar datos de una mesa (nombre, zona, estado, etc.)
    """
    db_table = db.query(RestaurantTable).filter(RestaurantTable.id == table_id).first()
    if not db_table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    update_data = table_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_table, key, value)
    
    db.commit()
    return db_table

@router.patch("/{table_id}/status", response_model=TableRead)
def update_table_status(
    table_id: int,
    status: str,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """
    Cambiar el estado de una mesa.
    Estados válidos: AVAILABLE, RESERVED, CLEANING
    Para OCCUPIED se debe usar /orders/open/{table_id}
    """
    db_table = db.query(RestaurantTable).filter(RestaurantTable.id == table_id).first()
    if not db_table:
        raise HTTPException(status_code=404, detail="Table not found")

    try:
        new_status = TableStatusDB(status)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Estado inválido. Usar: {[s.value for s in TableStatusDB]}"
        )

    if new_status == TableStatusDB.OCCUPIED:
        raise HTTPException(
            status_code=400,
            detail="Para ocupar una mesa usa el flujo de Abrir Mesa (POST /orders/open/{table_id})"
        )

    db_table.status = new_status
    db.commit()
    db.refresh(db_table)
    return db_table


@router.delete("/{table_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_table(table_id: int, db: Session = Depends(get_db)):
    """
    Eliminar una mesa (o desactivarla lógicamente si se prefiere, aquí es físico).
    """
    db_table = db.query(RestaurantTable).filter(RestaurantTable.id == table_id).first()
    if not db_table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    db.delete(db_table)
    db.commit()
    return None
