from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session, joinedload
from typing import List

from ....database.db import get_db
from ....dependencies import get_current_active_user, require_admin_role
from ....models.restaurant import RestaurantMenuSection, RestaurantMenuItem, RestaurantRecipe
from ....models.models import Product
from ....schemas import restaurant_ext as schemas

router = APIRouter(
    prefix="/menu",
    tags=["Restaurante - Menú y Recetas"],
    dependencies=[Depends(get_current_active_user)]
)

# ===========================
# MENU SECTIONS
# ===========================

@router.get("/full", response_model=schemas.FullMenu)
def get_full_menu(db: Session = Depends(get_db)):
    """Get complete menu tree for POS"""
    sections = db.query(RestaurantMenuSection).filter(
        RestaurantMenuSection.is_active == True
    ).order_by(RestaurantMenuSection.sort_order).all()
    
    # Enrich simple objects for response
    # Real implementation might need careful query opt, especially for prices
    result_sections = []
    for sec in sections:
        items_data = []
        for item in sec.items:
            if not item.is_active: 
                continue
                
            prod_name = item.product.name if item.product else "Unknown"
            final_price = item.price_override if item.price_override else (item.product.price if item.product else 0)
            
            items_data.append(schemas.MenuItemRead(
                id=item.id,
                section_id=sec.id,
                product_id=item.product_id,
                alias=item.alias or prod_name,
                price=final_price,
                product_name=prod_name,
                sort_order=item.sort_order,
                is_active=item.is_active
            ))
        
        # Sort items in Python (simple enough for small menus)
        items_data.sort(key=lambda x: x.sort_order)
        
        result_sections.append(schemas.MenuSectionRead(
            id=sec.id,
            name=sec.name,
            sort_order=sec.sort_order,
            is_active=sec.is_active,
            items=items_data
        ))
        
    return {"sections": result_sections}

@router.post("/sections", response_model=schemas.MenuSectionRead)
def create_section(section: schemas.MenuSectionCreate, db: Session = Depends(get_db)):
    new_sec = RestaurantMenuSection(**section.dict())
    db.add(new_sec)
    db.commit()
    db.refresh(new_sec)
    return new_sec

@router.delete("/sections/{id}")
def delete_section(id: int, db: Session = Depends(get_db)):
    sec = db.query(RestaurantMenuSection).get(id)
    if not sec: raise HTTPException(404, "Section not found")
    db.delete(sec)
    db.commit()
    return {"message": "Section deleted"}


# ===========================
# MENU ITEMS
# ===========================

@router.post("/items", response_model=schemas.MenuItemRead)
def add_menu_item(item: schemas.MenuItemCreate, db: Session = Depends(get_db)):
    db_item = RestaurantMenuItem(**item.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item # Minimal return, client usually re-fetches full menu

@router.delete("/items/{id}")
def remove_menu_item(id: int, db: Session = Depends(get_db)):
    item = db.query(RestaurantMenuItem).get(id)
    if not item: raise HTTPException(404, "Item not found")
    db.delete(item)
    db.commit()
    return {"message": "Item removed"}

# ===========================
# RECIPES
# ===========================

@router.get("/recipes/{product_id}", response_model=List[schemas.RecipeRead])
def get_product_recipe(product_id: int, db: Session = Depends(get_db)):
    recipes = db.query(RestaurantRecipe).filter(RestaurantRecipe.product_id == product_id).all()
    return recipes

@router.post("/recipes", response_model=schemas.RecipeRead)
def add_ingredient_to_recipe(recipe: schemas.RecipeCreate, db: Session = Depends(get_db)):
    # Check if exists
    existing = db.query(RestaurantRecipe).filter(
        RestaurantRecipe.product_id == recipe.product_id,
        RestaurantRecipe.ingredient_id == recipe.ingredient_id
    ).first()
    
    if existing:
        existing.quantity = recipe.quantity
        db.commit()
        db.refresh(existing)
        return existing
    
    new_recipe = RestaurantRecipe(**recipe.dict())
    db.add(new_recipe)
    db.commit()
    db.refresh(new_recipe)
    return new_recipe

@router.delete("/recipes/{id}")
def remove_ingredient_from_recipe(id: int, db: Session = Depends(get_db)):
    rec = db.query(RestaurantRecipe).get(id)
    if not rec: raise HTTPException(404, "Recipe item not found")
    db.delete(rec)
    db.commit()
    return {"message": "Ingredient removed"}
