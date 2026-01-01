from pydantic import BaseModel
from typing import List, Optional
from decimal import Decimal

# --- Recipes ---
class RecipeBase(BaseModel):
    product_id: int
    ingredient_id: int
    quantity: float

class RecipeCreate(RecipeBase):
    pass

class RecipeRead(RecipeBase):
    id: int
    product_name: Optional[str] = None
    ingredient_name: Optional[str] = None

    class Config:
        from_attributes = True

# --- Menu Items ---
class MenuItemBase(BaseModel):
    product_id: int
    alias: Optional[str] = None
    price_override: Optional[float] = None
    sort_order: Optional[int] = 0
    is_active: Optional[bool] = True

class MenuItemCreate(MenuItemBase):
    section_id: int

class MenuItemRead(MenuItemBase):
    id: int
    section_id: int
    product_name: Optional[str] = None
    price: Optional[float] = None # Calculated (Override or Product Price)

    class Config:
        from_attributes = True

# --- Menu Sections ---
class MenuSectionBase(BaseModel):
    name: str
    sort_order: Optional[int] = 0
    is_active: Optional[bool] = True

class MenuSectionCreate(MenuSectionBase):
    pass

class MenuSectionRead(MenuSectionBase):
    id: int
    items: List[MenuItemRead] = []

    class Config:
        from_attributes = True

class FullMenu(BaseModel):
    sections: List[MenuSectionRead]
