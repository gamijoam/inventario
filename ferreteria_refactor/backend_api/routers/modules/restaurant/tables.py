from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ....database.db import get_db
from ....dependencies import get_current_active_user, require_restaurant_module
from ....models.restaurant import RestaurantTable
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
    
    order_map = {order.table_id: order.id for order in active_orders}
    
    for table in tables:
        # Dynamically attach attribute for Pydantic schema
        table.current_order_id = order_map.get(table.id)
        
    return tables

@router.post("/", response_model=TableRead, status_code=status.HTTP_201_CREATED)
def create_table(table: TableCreate, db: Session = Depends(get_db)):
    """
    Registrar una nueva mesa en el sistema.
    """
    db_table = RestaurantTable(**table.model_dump())
    db.add(db_table)
    db.commit()
    db.refresh(db_table)
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
