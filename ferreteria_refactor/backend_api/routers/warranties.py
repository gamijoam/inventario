from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database.db import get_db
from ..models import models
from .. import schemas
from ..dependencies import get_current_user, get_current_active_user, admin_only

router = APIRouter(
    prefix="/warranties",
    tags=["Warranties"],
    responses={404: {"description": "Not found"}},
)

# ========================
# WARRANTY POLICIES
# ========================

@router.get("/policies", response_model=List[schemas.WarrantyPolicyRead])
def get_warranty_policies(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """List all warranty policies for the current tenant"""
    # Note: Tenant filtering is handled by the search_path middleware
    return db.query(models.WarrantyPolicy).offset(skip).limit(limit).all()

def get_effective_tenant_id(user: models.User, db: Session) -> int:
    """Utility to get the tenant ID even for superusers in a tenant context"""
    if user.tenant_id:
        return user.tenant_id
    
    from .tenant_context import get_tenant_schema
    from .models.tenant import Tenant
    
    current_schema = get_tenant_schema()
    if current_schema != "public":
        tenant = db.query(Tenant).filter(Tenant.schema_name == current_schema).first()
        if tenant:
            return tenant.id
    
    # Fallback/Error
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="No se pudo determinar el ID de la empresa para esta operación."
    )

@router.post("/policies", response_model=schemas.WarrantyPolicyRead)
def create_warranty_policy(
    policy: schemas.WarrantyPolicyCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_only) 
):
    """Create a new warranty policy (Admin only)"""
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    
    new_policy = models.WarrantyPolicy(
        tenant_id=effective_tenant_id,
        **policy.dict()
    )
    db.add(new_policy)
    db.flush()
    db.commit()
    return new_policy

@router.put("/policies/{policy_id}", response_model=schemas.WarrantyPolicyRead)
def update_warranty_policy(
    policy_id: int,
    policy_update: schemas.WarrantyPolicyCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_only)
):
    db_policy = db.query(models.WarrantyPolicy).filter(models.WarrantyPolicy.id == policy_id).first()
    if not db_policy:
        raise HTTPException(status_code=404, detail="Warranty Policy not found")
    
    for key, value in policy_update.dict().items():
        setattr(db_policy, key, value)
    
    db.commit()
    return db_policy

@router.delete("/policies/{policy_id}")
def delete_warranty_policy(
    policy_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_only)
):
    db_policy = db.query(models.WarrantyPolicy).filter(models.WarrantyPolicy.id == policy_id).first()
    if not db_policy:
        raise HTTPException(status_code=404, detail="Warranty Policy not found")
    
    # Check usage? (Optional safety check)
    
    db.delete(db_policy)
    db.commit()
    return {"message": "Warranty Policy deleted successfully"}


# ========================
# WARRANTY CLAIMS
# ========================

@router.get("/claims", response_model=List[schemas.WarrantyClaimRead])
def get_warranty_claims(
    skip: int = 0, 
    limit: int = 100,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    query = db.query(models.WarrantyClaim)
    if status:
        query = query.filter(models.WarrantyClaim.status == status)
        
    return query.offset(skip).limit(limit).all()

@router.post("/claims", response_model=schemas.WarrantyClaimRead)
def create_warranty_claim(
    claim: schemas.WarrantyClaimCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    # Verify Sale Item exists
    # This is tricky because we stored ID but didn't enforce FK in model due to legacy reasons/archiving
    # Ideally we fetch it.
    
    # Verify Customer
    customer = db.query(models.Customer).filter(models.Customer.id == claim.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    new_claim = models.WarrantyClaim(
        tenant_id=get_effective_tenant_id(current_user, db),
        sale_item_id=claim.sale_item_id,
        customer_id=claim.customer_id,
        reason=claim.reason,
        status=schemas.ClaimStatus.PENDING
    )
    
    # TODO: Fetch policy snapshot from product at time of sale? 
    # Or just current policy? For now, we leave policy_snapshot empty or implement logic later.
    
    db.add(new_claim)
    db.flush()
    db.commit()
    return new_claim

@router.put("/claims/{claim_id}", response_model=schemas.WarrantyClaimRead)
def update_warranty_claim(
    claim_id: int,
    claim_update: schemas.WarrantyClaimUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    db_claim = db.query(models.WarrantyClaim).filter(models.WarrantyClaim.id == claim_id).first()
    if not db_claim:
        raise HTTPException(status_code=404, detail="Warranty Claim not found")
        
    update_data = claim_update.dict(exclude_unset=True)
    
    for key, value in update_data.items():
        setattr(db_claim, key, value)
        
    if claim_update.status == schemas.ClaimStatus.COMPLETED and not db_claim.resolved_at:
        from datetime import datetime
        db_claim.resolved_at = datetime.now()
        
    db.commit()
    return db_claim
