from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database.db import get_db
from ..models import models
from .. import schemas

router = APIRouter(
    prefix="/categories",
    tags=["categories"]
)

@router.get("/", response_model=List[schemas.CategoryResponse])
@router.get("", response_model=List[schemas.CategoryResponse], include_in_schema=False)
def get_categories(tree: bool = False, db: Session = Depends(get_db)):
    """
    Get all categories.
    - tree=false (default): Returns flat list
    - tree=true: Returns only root categories (parent_id=None)
    """
    if tree:
        # Return only root categories (no parent)
        categories = db.query(models.Category).filter(models.Category.parent_id == None).all()
    else:
        # Return all categories (flat list)
        categories = db.query(models.Category).all()
    
    return categories

@router.get("/{category_id}", response_model=schemas.CategoryResponse)
def get_category(category_id: int, db: Session = Depends(get_db)):
    """Get a single category by ID"""
    category = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category

@router.post("/", response_model=schemas.CategoryResponse)
@router.post("", response_model=schemas.CategoryResponse, include_in_schema=False)
def create_category(category: schemas.CategoryCreate, db: Session = Depends(get_db)):
    """Create a new category or subcategory"""
    
    # Check if parent exists if parent_id is provided
    if category.parent_id:
        parent = db.query(models.Category).filter(models.Category.id == category.parent_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent category not found")
    
    # Check for duplicate name
    existing = db.query(models.Category).filter(models.Category.name == category.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category with this name already exists")
    
    new_category = models.Category(
        name=category.name,
        description=category.description,
        parent_id=category.parent_id
    )
    
    db.add(new_category)
    db.commit()
    db.refresh(new_category)
    return new_category

@router.put("/{category_id}", response_model=schemas.CategoryResponse)
def update_category(category_id: int, category: schemas.CategoryUpdate, db: Session = Depends(get_db)):
    """Update a category"""
    db_category = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not db_category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Check if parent exists if parent_id is being updated
    if category.parent_id is not None:
        # Prevent self-reference
        if category.parent_id == category_id:
            raise HTTPException(status_code=400, detail="Category cannot be its own parent")
        
        parent = db.query(models.Category).filter(models.Category.id == category.parent_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent category not found")
    
    # Update fields
    if category.name is not None:
        # Check for duplicate name
        existing = db.query(models.Category).filter(
            models.Category.name == category.name,
            models.Category.id != category_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Category with this name already exists")
        db_category.name = category.name
    
    if category.description is not None:
        db_category.description = category.description
    
    if category.parent_id is not None:
        db_category.parent_id = category.parent_id
    
    db.commit()
    db.refresh(db_category)
    return db_category

@router.delete("/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db)):
    """Delete a category"""
    category = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Check if category has products
    products_count = db.query(models.Product).filter(models.Product.category_id == category_id).count()
    if products_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete category. It has {products_count} products assigned."
        )
    
    # Check if category has subcategories
    children_count = db.query(models.Category).filter(models.Category.parent_id == category_id).count()
    if children_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete category. It has {children_count} subcategories."
        )
    
    db.delete(category)
    db.commit()
    return {"message": "Category deleted successfully"}
