from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from decimal import Decimal
from pydantic import BaseModel

from ....database.db import get_db
from ....dependencies import get_current_active_user, require_restaurant_module
from ....models.restaurant import (
    ProductModifierGroup, ProductModifierOption, SelectionTypeDB
)

# -------- Schemas --------
class ModifierOptionCreate(BaseModel):
    name: str
    price_adjustment: Optional[Decimal] = Decimal("0.00")
    recipe_factor: Optional[Decimal] = Decimal("1.000")
    is_active: Optional[bool] = True

class ModifierOptionRead(BaseModel):
    id: int
    name: str
    price_adjustment: float
    recipe_factor: float
    is_active: bool
    class Config:
        from_attributes = True

class ModifierGroupCreate(BaseModel):
    name: str
    selection_type: str = "SINGLE"   # SINGLE | MULTIPLE
    is_required: Optional[bool] = False
    options: Optional[List[ModifierOptionCreate]] = []

class ModifierGroupRead(BaseModel):
    id: int
    product_id: int
    name: str
    selection_type: str
    is_required: bool
    options: List[ModifierOptionRead] = []
    class Config:
        from_attributes = True

# -------- Router --------
router = APIRouter(
    prefix="/modifiers",
    tags=["Restaurante - Modificadores"],
    dependencies=[Depends(get_current_active_user), Depends(require_restaurant_module)]
)

@router.get("/product/{product_id}", response_model=List[ModifierGroupRead])
def get_product_modifiers(product_id: int, db: Session = Depends(get_db)):
    groups = db.query(ProductModifierGroup).filter(ProductModifierGroup.product_id == product_id).all()
    result = []
    for g in groups:
        opts = [{"id": o.id, "name": o.name, "price_adjustment": float(o.price_adjustment), "recipe_factor": float(o.recipe_factor), "is_active": o.is_active} for o in g.options if o.is_active]
        result.append({"id": g.id, "product_id": g.product_id, "name": g.name, "selection_type": g.selection_type.value if hasattr(g.selection_type, 'value') else g.selection_type, "is_required": g.is_required, "options": opts})
    return result

@router.post("/product/{product_id}", response_model=ModifierGroupRead)
def create_modifier_group(product_id: int, group_in: ModifierGroupCreate, db: Session = Depends(get_db)):
    sel_type = SelectionTypeDB.SINGLE
    if group_in.selection_type == "MULTIPLE": sel_type = SelectionTypeDB.MULTIPLE
    group = ProductModifierGroup(product_id=product_id, name=group_in.name, selection_type=sel_type, is_required=group_in.is_required or False)
    db.add(group)
    db.flush()
    
    created_options = []
    for opt_in in (group_in.options or []):
        option = ProductModifierOption(group_id=group.id, name=opt_in.name, price_adjustment=opt_in.price_adjustment or Decimal("0.00"), recipe_factor=opt_in.recipe_factor or Decimal("1.000"), is_active=opt_in.is_active if opt_in.is_active is not None else True)
        db.add(option)
        created_options.append(option)
    
    db.commit()
    
    # Use the objects directly since expire_on_commit=False
    return {
        "id": group.id,
        "product_id": group.product_id,
        "name": group.name,
        "selection_type": group_in.selection_type,
        "is_required": group.is_required,
        "options": [
            {
                "id": o.id,
                "name": o.name,
                "price_adjustment": float(o.price_adjustment),
                "recipe_factor": float(o.recipe_factor),
                "is_active": o.is_active
            } for o in created_options
        ]
    }

@router.delete("/group/{group_id}")
def delete_modifier_group(group_id: int, db: Session = Depends(get_db)):
    group = db.query(ProductModifierGroup).filter(ProductModifierGroup.id == group_id).first()
    if not group: raise HTTPException(status_code=404, detail="Modifier group not found")
    db.delete(group)
    db.commit()
    return {"status": "ok"}

@router.post("/option/{group_id}", response_model=ModifierOptionRead)
def add_option_to_group(group_id: int, opt_in: ModifierOptionCreate, db: Session = Depends(get_db)):
    option = ProductModifierOption(group_id=group_id, name=opt_in.name, price_adjustment=opt_in.price_adjustment or Decimal("0.00"), recipe_factor=opt_in.recipe_factor or Decimal("1.000"), is_active=opt_in.is_active if opt_in.is_active is not None else True)
    db.add(option)
    db.commit()
    return {"id": option.id, "name": option.name, "price_adjustment": float(option.price_adjustment), "recipe_factor": float(option.recipe_factor), "is_active": option.is_active}

@router.delete("/option/{option_id}")
def delete_option(option_id: int, db: Session = Depends(get_db)):
    option = db.query(ProductModifierOption).filter(ProductModifierOption.id == option_id).first()
    if not option: raise HTTPException(status_code=404, detail="Option not found")
    db.delete(option)
    db.commit()
    return {"status": "ok"}
