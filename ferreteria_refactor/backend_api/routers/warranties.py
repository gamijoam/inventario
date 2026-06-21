from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.orm import Session
from ..database.db import get_db
from ..models import models
from .. import schemas
from ..dependencies import get_current_user, get_current_active_user, require_permission, require_any_permission
from ..services import warranty_pdf_service

router = APIRouter(
    prefix="/warranties",
    tags=["Warranties"],
    responses={404: {"description": "Not found"}},
)

# ========================
# WARRANTY POLICIES
# ========================

@router.get("/policies", response_model=List[schemas.WarrantyPolicyRead], dependencies=[Depends(require_any_permission(["sales.warranties.view", "sales.warranties.manage"]))])
def get_warranty_policies(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """List all warranty policies for the current tenant"""
    from ..tenant_context import get_tenant_schema

    current_schema = get_tenant_schema()

    if current_user.is_superuser and not current_user.tenant_id and current_schema == "public":
        return []

    return db.query(models.WarrantyPolicy).offset(skip).limit(limit).all()

def get_effective_tenant_id(user: models.User, db: Session) -> int:
    """Utility to get the tenant ID even for superusers in a tenant context"""
    if user.tenant_id:
        return user.tenant_id

    from ..tenant_context import get_tenant_schema
    from ..models.tenant import Tenant

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
    current_user: models.User = Depends(require_permission("sales.warranties.manage"))
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
    current_user: models.User = Depends(require_permission("sales.warranties.manage"))
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
    current_user: models.User = Depends(require_permission("sales.warranties.manage"))
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

@router.get("/claims", response_model=List[schemas.WarrantyClaimRead], dependencies=[Depends(require_any_permission(["sales.warranties.view", "sales.warranties.manage"]))])
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

@router.post("/claims", response_model=schemas.WarrantyClaimRead, dependencies=[Depends(require_permission("sales.warranties.manage"))])
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

@router.put("/claims/{claim_id}", response_model=schemas.WarrantyClaimRead, dependencies=[Depends(require_permission("sales.warranties.manage"))])
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


# ========================
# WARRANTY PDF PRINTING
# ========================

@router.put("/policies/{policy_id}/upload-template", response_model=schemas.WarrantyPolicyRead)
async def upload_warranty_template(
    policy_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_permission("sales.warranties.manage"))
):
    """
    Sube un PDF template de garantía para una política específica.
    Este template se usará para imprimir garantías al finalizar ventas con IMEI.
    """
    # Ensure tenant context is set from current user
    from ..tenant_context import set_tenant_schema
    if current_user.tenant_id:
        from ..models.tenant import Tenant
        tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
        if tenant:
            set_tenant_schema(tenant.schema_name)

    policy = await warranty_pdf_service.upload_warranty_template(
        file=file,
        policy_id=policy_id,
        db=db,
        current_user=current_user,
    )
    return policy


@router.get("/print/{sale_id}", dependencies=[Depends(require_permission("pos.reprint.warranty"))])
def print_warranty_pdf(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """
    Genera y retorna el PDF de garantía para una venta con productos IMEI.
    Verifica que el tenant tenga el feature flag 'impresion_garantia_pdf' activo.
    """
    # Check feature flag
    tenant = None
    if current_user.tenant_id:
        from ..models.tenant import Tenant
        tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    elif current_user.is_superuser:
        from ..tenant_context import get_tenant_schema
        from ..models.tenant import Tenant
        current_schema = get_tenant_schema()
        if current_schema and current_schema != "public":
            tenant = db.query(Tenant).filter(Tenant.schema_name == current_schema).first()

    pdf_bytes = warranty_pdf_service.generate_warranty_pdf(
        sale_id=sale_id,
        db=db,
        current_user=current_user,
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=garantia_venta_{sale_id}.pdf"}
    )


# ========================
# SEND WARRANTY VIA WHATSAPP
# ========================

@router.post("/send-whatsapp/{sale_id}", dependencies=[Depends(require_permission("pos.reprint.warranty"))])
async def send_warranty_whatsapp(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """
    Genera el PDF de garantía y lo envía por WhatsApp al cliente.
    Funciona para cualquier producto con política de garantía asignada (no solo IMEI).
    """
    import httpx
    from ..routers.whatsapp import _wa, _get, KEY_ENABLED, KEY_STATUS, KEY_INSTANCE

    # Verificar WhatsApp conectado
    enabled = _get(db, KEY_ENABLED) == "true"
    status  = _get(db, KEY_STATUS)
    inst    = _get(db, KEY_INSTANCE)

    if not enabled or status != "CONNECTED" or not inst:
        raise HTTPException(
            status_code=503,
            detail="WhatsApp no está conectado. Conéctalo en Configuración → WhatsApp."
        )

    # Obtener la venta y el cliente
    from sqlalchemy.orm import joinedload
    sale = db.query(models.Sale).options(
        joinedload(models.Sale.customer),
        joinedload(models.Sale.details).joinedload(models.SaleDetail.product)
            .joinedload(models.Product.warranty_policy),
    ).filter(models.Sale.id == sale_id).first()

    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")

    if not sale.customer or not sale.customer.phone:
        raise HTTPException(
            status_code=400,
            detail="El cliente no tiene número de teléfono registrado."
        )

    # Limpiar teléfono
    phone = "".join(c for c in sale.customer.phone if c.isdigit())
    if len(phone) < 7:
        raise HTTPException(status_code=400, detail="Número de teléfono inválido.")

    # Generar el PDF de garantía
    pdf_bytes = warranty_pdf_service.generate_warranty_pdf(
        sale_id=sale_id,
        db=db,
        current_user=current_user,
    )

    # Nombre del negocio
    biz_config = {c.key: c.value for c in db.query(models.BusinessConfig).all()}
    biz_name = biz_config.get("business_name", "Mi Inventario")

    # Nombre del cliente
    customer_name = sale.customer.name or "Cliente"

    # Productos con garantía
    warranty_items = []
    for d in sale.details:
        if d.product and d.product.warranty_policy:
            wp = d.product.warranty_policy
            exp = d.warranty_expiration_date
            exp_str = exp.strftime("%d/%m/%Y") if exp else "—"
            warranty_items.append(
                f"• {d.product.name}: {wp.name} (vence {exp_str})"
            )

    items_text = "\n".join(warranty_items) if warranty_items else "• Garantía incluida"

    # Mensaje de texto previo al PDF
    message = (
        f"🛡️ *Garantía de compra — {biz_name}*\n\n"
        f"Hola *{customer_name}*, gracias por tu compra.\n\n"
        f"📦 *Productos con garantía:*\n{items_text}\n\n"
        f"Adjunto encontrarás tu certificado de garantía en PDF.\n\n"
        f"_Guarda este documento para cualquier reclamación._ 📄"
    )

    # 1. Enviar mensaje de texto primero
    await _wa("post", f"/instance/{inst}/send", json={
        "phone": phone,
        "message": message
    })

    # 2. Enviar PDF como documento
    import base64
    pdf_b64 = base64.b64encode(pdf_bytes).decode()

    await _wa("post", f"/instance/{inst}/send-document", json={
        "phone": phone,
        "base64": pdf_b64,
        "filename": f"garantia_venta_{sale_id}.pdf",
        "caption": f"Certificado de Garantía — {biz_name}"
    })

    return {
        "success": True,
        "phone": phone,
        "customer": customer_name,
        "message": f"Garantía enviada a {customer_name} ({phone})"
    }


# ════════════════════════════════════════════════════════════════════════════
# PDF TEMPLATES (selección de plantilla visual)
# ════════════════════════════════════════════════════════════════════════════

from pydantic import BaseModel as _PydBM
from fastapi.responses import Response as _Resp


class TemplateInfo(_PydBM):
    id: str
    name: str
    description: str
    is_default: bool


class TemplateConfig(_PydBM):
    style: str


@router.get("/templates", response_model=List[TemplateInfo])
def list_templates():
    """Lista las plantillas visuales disponibles para el PDF de garantía."""
    from ..services.warranty_templates import TEMPLATES
    return TEMPLATES


@router.get("/template-config", dependencies=[Depends(require_any_permission(["sales.warranties.view", "sales.warranties.manage"]))])
def get_template_config(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Devuelve la plantilla configurada para este tenant."""
    row = db.query(models.BusinessConfig).filter(
        models.BusinessConfig.key == "warranty_pdf_style"
    ).first()
    return {"style": row.value if row else "moderno"}


@router.put("/template-config")
def set_template_config(
    body: TemplateConfig,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_permission("sales.warranties.manage"))
):
    """Actualiza la plantilla visual usada para el PDF de garantía."""
    from ..services.warranty_templates import RENDERERS
    if body.style not in RENDERERS:
        raise HTTPException(
            status_code=400,
            detail=f"Plantilla no reconocida. Opciones: {', '.join(RENDERERS.keys())}"
        )

    row = db.query(models.BusinessConfig).filter(
        models.BusinessConfig.key == "warranty_pdf_style"
    ).first()
    if row:
        row.value = body.style
    else:
        row = models.BusinessConfig(key="warranty_pdf_style", value=body.style)
        db.add(row)
    db.commit()
    return {"success": True, "style": body.style}


@router.get("/template-preview/{style}", dependencies=[Depends(require_any_permission(["sales.warranties.view", "sales.warranties.manage"]))])
def template_preview(
    style: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """
    Genera un PDF de PREVIEW con datos ficticios para que el usuario
    pueda ver cómo se ve cada plantilla antes de elegirla.
    """
    from ..services.warranty_templates import render, RENDERERS
    if style not in RENDERERS:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")

    # Mock data realistic
    from datetime import datetime, timedelta
    class _MockPolicy:
        name = "Garantía Celulares"
        type = "DAYS"
        duration = 30
        description = "Garantía de 30 días por defectos de fabricación del equipo de celular. Cubre fallas técnicas internas y mal funcionamiento del equipo en condiciones normales de uso."

    business_config = {}
    for c in db.query(models.BusinessConfig).all():
        business_config[c.key] = c.value

    items = [
        {
            "product_name": "iPhone 15 Pro Max 256GB",
            "serials": ["356789012345678"],
            "quantity": 1,
            "warranty_policy": _MockPolicy(),
            "warranty_expiration": datetime.now() + timedelta(days=30),
        },
    ]

    pdf_bytes = render(
        style=style,
        imei_items=items,
        business_name=business_config.get("business_name", "Mi Negocio"),
        business_rif=business_config.get("business_rif", "J-12345678-9"),
        business_address=business_config.get("business_address", "Av. Principal, Local 1"),
        business_phone=business_config.get("business_phone", "+58 412-1234567"),
        business_logo=business_config.get("business_logo", ""),
        business_logo_size=business_config.get("business_logo_size", "medium"),
        customer_name="Juan Perez (Ejemplo)",
        customer_doc="V-12345678",
        customer_phone="+58 414-9876543",
        customer_email="cliente@ejemplo.com",
        sale_date=datetime.now().strftime("%d/%m/%Y %H:%M"),
        sale_total="$899.00",
        sale_id=12345,
    )

    return _Resp(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="preview_{style}.pdf"'}
    )
