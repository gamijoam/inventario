from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database.db import get_db
from ..models import models
from .. import schemas
from datetime import datetime

router = APIRouter(
    prefix="/price-lists",
    tags=["Price Lists"]
)

@router.get("/", response_model=List[schemas.PriceListRead])
def get_price_lists(
    skip: int = 0, 
    limit: int = 100, 
    active_only: bool = False,
    db: Session = Depends(get_db)
):
    query = db.query(models.PriceList)
    if active_only:
        query = query.filter(models.PriceList.is_active == True)
    
    # Ensure default sorting by created_at or ID
    return query.order_by(models.PriceList.id.asc()).offset(skip).limit(limit).all()

@router.post("/", response_model=schemas.PriceListRead, status_code=status.HTTP_201_CREATED)
def create_price_list(
    list_data: schemas.PriceListCreate,
    db: Session = Depends(get_db)
):
    # Check duplicate name
    existing = db.query(models.PriceList).filter(models.PriceList.name == list_data.name).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Price list with name '{list_data.name}' already exists"
        )
    
    new_list = models.PriceList(
        name=list_data.name,
        requires_auth=list_data.requires_auth,
        is_active=list_data.is_active
    )
    db.add(new_list)
    db.commit()
    db.refresh(new_list)
    return new_list

@router.put("/{list_id}", response_model=schemas.PriceListRead)
def update_price_list(
    list_id: int,
    list_data: schemas.PriceListCreate,
    db: Session = Depends(get_db)
):
    price_list = db.query(models.PriceList).filter(models.PriceList.id == list_id).first()
    if not price_list:
        raise HTTPException(status_code=404, detail="Price list not found")
    
    # Check name duplicate if changing name
    if list_data.name != price_list.name:
         existing = db.query(models.PriceList).filter(models.PriceList.name == list_data.name).first()
         if existing:
             raise HTTPException(status_code=400, detail="Name already in use")

    price_list.name = list_data.name
    price_list.requires_auth = list_data.requires_auth
    price_list.is_active = list_data.is_active
    
    db.commit()
    db.refresh(price_list)
    return price_list

@router.delete("/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_price_list(list_id: int, db: Session = Depends(get_db)):
    price_list = db.query(models.PriceList).filter(models.PriceList.id == list_id).first()
    if not price_list:
        raise HTTPException(status_code=404, detail="Price list not found")
    
    # Prevent deletion of Base list?
    if price_list.name == "Precio Base (Detal)":
        raise HTTPException(status_code=400, detail="Cannot delete default base price list")
    
    db.delete(price_list)
    db.commit()
    return None
