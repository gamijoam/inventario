from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional

from ..database.db import get_db
from ..dependencies import get_current_active_user, admin_only
from ..models import models
from .. import schemas

router = APIRouter(prefix="/service-templates", tags=["Plantillas de Servicio"])


def _get_or_404(db: Session, template_id: int) -> models.ServiceTemplate:
    t = (
        db.query(models.ServiceTemplate)
        .options(joinedload(models.ServiceTemplate.items))
        .filter(models.ServiceTemplate.id == template_id)
        .first()
    )
    if not t:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    return t


@router.get("", response_model=List[schemas.ServiceTemplateRead])
def list_active_templates(
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Returns all active templates. Optional filter by category."""
    q = (
        db.query(models.ServiceTemplate)
        .options(joinedload(models.ServiceTemplate.items))
        .filter(models.ServiceTemplate.is_active == True)
    )
    if category:
        q = q.filter(models.ServiceTemplate.category == category)
    return q.order_by(models.ServiceTemplate.name).all()


@router.get("/all", response_model=List[schemas.ServiceTemplateRead])
def list_all_templates(
    db: Session = Depends(get_db),
    current_user=Depends(admin_only),
):
    """Returns all templates (including inactive). Admin only."""
    return (
        db.query(models.ServiceTemplate)
        .options(joinedload(models.ServiceTemplate.items))
        .order_by(models.ServiceTemplate.name)
        .all()
    )


@router.post("", response_model=schemas.ServiceTemplateRead, status_code=201)
def create_template(
    data: schemas.ServiceTemplateCreate,
    db: Session = Depends(get_db),
    current_user=Depends(admin_only),
):
    template = models.ServiceTemplate(
        name=data.name,
        description=data.description,
        category=data.category,
        estimated_days=data.estimated_days,
        is_active=data.is_active,
    )
    db.add(template)
    db.flush()

    for item_data in data.items:
        item = models.ServiceTemplateItem(
            template_id=template.id,
            description=item_data.description,
            unit_price=item_data.unit_price,
            quantity=item_data.quantity,
        )
        db.add(item)

    db.commit()
    return _get_or_404(db, template.id)


@router.put("/{template_id}", response_model=schemas.ServiceTemplateRead)
def update_template(
    template_id: int,
    data: schemas.ServiceTemplateUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(admin_only),
):
    template = _get_or_404(db, template_id)

    if data.name is not None:
        template.name = data.name
    if data.description is not None:
        template.description = data.description
    if data.category is not None:
        template.category = data.category
    if data.estimated_days is not None:
        template.estimated_days = data.estimated_days
    if data.is_active is not None:
        template.is_active = data.is_active

    if data.items is not None:
        # Replace all items
        db.query(models.ServiceTemplateItem).filter(
            models.ServiceTemplateItem.template_id == template_id
        ).delete()
        for item_data in data.items:
            item = models.ServiceTemplateItem(
                template_id=template.id,
                description=item_data.description,
                unit_price=item_data.unit_price,
                quantity=item_data.quantity,
            )
            db.add(item)

    db.commit()
    return _get_or_404(db, template_id)


@router.delete("/{template_id}", status_code=204)
def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(admin_only),
):
    template = _get_or_404(db, template_id)
    db.delete(template)
    db.commit()
