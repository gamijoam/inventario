"""
Router — Sistema Multi-Empresa
Endpoints para gestión de organizaciones (grupos empresariales)
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text
from typing import List, Optional
import re

from ..database.db import get_db
from ..models.organization import (
    Organization, OrganizationUser, SharedProduct,
    InterCompanyTransfer, InterCompanyTransferItem
)
from ..models.models import User, UserRole
from ..models.tenant import Tenant
from ..schemas.organization import (
    OrganizationCreate, OrganizationUpdate, OrganizationOut,
    InviteMemberRequest, OrganizationMemberOut, OrganizationTenantOut,
    SharedProductCreate, SharedProductOut, ImportSharedProductRequest,
    InterCompanyTransferCreate, InterCompanyTransferOut,
    ConsolidatedSummary, TenantDailySummary, OrgCompanyOut,
    OrgPlanConfig, OrgWhatsAppConfig
)
from ..dependencies import get_current_active_user, get_current_superuser
from ..utils.time_utils import get_venezuela_now

router = APIRouter(prefix="/organizations", tags=["organizations"])


def _slug_from_name(name: str) -> str:
    """Genera un slug URL-safe desde el nombre de la organización."""
    slug = re.sub(r'[^a-z0-9]+', '-', name.lower().strip())
    return slug.strip('-')[:80]


def _get_org_or_404(db: Session, org_id: int) -> Organization:
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organización no encontrada")
    return org


def _assert_org_access(org: Organization, user: User):
    """Verifica que el usuario tiene acceso a esta organización."""
    if user.is_superuser:
        return
    member = next((m for m in org.members if m.user_email == user.email), None)
    if not member:
        raise HTTPException(status_code=403, detail="No tienes acceso a esta organización")


# ══════════════════════════════════════════════════════════════════════════════
# CRUD DE ORGANIZACIONES
# ══════════════════════════════════════════════════════════════════════════════

@router.post("", response_model=OrganizationOut, status_code=201)
def create_organization(
    data: OrganizationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Crear un grupo empresarial. Solo superadmin."""
    # Generar slug único
    base_slug = _slug_from_name(data.name)
    slug = base_slug
    i = 1
    while db.query(Organization).filter(Organization.slug == slug).first():
        slug = f"{base_slug}-{i}"
        i += 1

    org = Organization(
        name          = data.name.strip(),
        slug          = slug,
        owner_email   = data.owner_email.lower().strip(),
        owner_name    = data.owner_name,
        plan          = data.plan,
        max_tenants   = data.max_tenants,
        primary_color = data.primary_color,
        logo_url      = data.logo_url,
    )
    db.add(org)
    db.flush()

    # Agregar al dueño como miembro owner automáticamente
    db.add(OrganizationUser(
        organization_id = org.id,
        user_email      = data.owner_email.lower().strip(),
        role            = "owner",
        can_switch      = True,
        accepted_at     = get_venezuela_now()
    ))

    db.commit()
    db.refresh(org)

    return OrganizationOut(
        **{c.name: getattr(org, c.name) for c in org.__table__.columns},
        member_count = 1,
        tenant_count = 0
    )


@router.get("", response_model=List[OrganizationOut])
def list_organizations(
    skip: int = 0, limit: int = 50,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Listar todas las organizaciones. Solo superadmin."""
    q = db.query(Organization)
    if is_active is not None:
        q = q.filter(Organization.is_active == is_active)
    orgs = q.order_by(Organization.created_at.desc()).offset(skip).limit(limit).all()

    result = []
    for org in orgs:
        tenant_count = db.execute(
            text("SELECT COUNT(*) FROM public.tenants WHERE organization_id = :id"),
            {"id": org.id}
        ).scalar() or 0
        result.append(OrganizationOut(
            **{c.name: getattr(org, c.name) for c in org.__table__.columns},
            member_count = len(org.members),
            tenant_count = tenant_count
        ))
    return result


@router.get("/mine", response_model=List[OrgCompanyOut])
def my_companies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Empresas a las que puede cambiar el usuario actual.
    Se usa en el selector de empresa al hacer login.
    """
    # Buscar organizaciones donde el email del usuario es miembro
    memberships = db.query(OrganizationUser).filter(
        OrganizationUser.user_email == current_user.email,
        OrganizationUser.can_switch == True
    ).all()

    companies = []
    for m in memberships:
        org = db.query(Organization).filter(
            Organization.id == m.organization_id,
            Organization.is_active == True
        ).first()
        if not org:
            continue

        tenants = db.query(Tenant).filter(
            Tenant.organization_id == org.id,
            Tenant.is_active == True
        ).all()

        for t in tenants:
            companies.append(OrgCompanyOut(
                tenant_id   = t.id,
                schema_name = t.schema_name,
                name        = t.name,
                is_active   = t.is_active,
                switch_url  = f"https://{t.schema_name}.miinventariofacil.com"
            ))

    return companies


@router.get("/consolidated-mine", response_model=ConsolidatedSummary)
def consolidated_mine(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Dashboard consolidado para el usuario actual.
    Detecta automáticamente la organización del usuario usando su email,
    sin necesitar que el frontend pase el org_id.
    Ideal para el CompanySwitcher y el portal multi-empresa.
    """
    from ..tenant_context import get_tenant_schema as _gts

    # Buscar la organización del usuario por su email
    membership = db.query(OrganizationUser).filter(
        OrganizationUser.user_email == current_user.email,
        OrganizationUser.can_switch == True
    ).first()

    if not membership:
        # Sin organización → devolver resumen vacío con la empresa actual
        schema = _gts()
        tenant = db.query(Tenant).filter(Tenant.schema_name == schema).first()
        return ConsolidatedSummary(
            organization_id    = 0,
            organization_name  = tenant.name if tenant else "Mi Empresa",
            total_sales_today  = 0,
            total_transactions = 0,
            best_tenant_name   = None,
            best_tenant_sales  = 0,
            total_low_stock    = 0,
            tenants            = []
        )

    # Llamar al endpoint consolidado con el org_id detectado
    return consolidated_dashboard(membership.organization_id, db, current_user)


@router.get("/{org_id}", response_model=OrganizationOut)
def get_organization(
    org_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    org = db.query(Organization).options(
        joinedload(Organization.members)
    ).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organización no encontrada")
    _assert_org_access(org, current_user)

    tenant_count = db.execute(
        text("SELECT COUNT(*) FROM public.tenants WHERE organization_id = :id"),
        {"id": org.id}
    ).scalar() or 0

    return OrganizationOut(
        **{c.name: getattr(org, c.name) for c in org.__table__.columns},
        member_count = len(org.members),
        tenant_count = tenant_count
    )


@router.patch("/{org_id}", response_model=OrganizationOut)
def update_organization(
    org_id: int,
    data: OrganizationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Actualizar datos de una organización. Solo superadmin."""
    org = _get_org_or_404(db, org_id)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(org, field, value)
    db.commit()
    db.refresh(org)

    tenant_count = db.execute(
        text("SELECT COUNT(*) FROM public.tenants WHERE organization_id = :id"),
        {"id": org.id}
    ).scalar() or 0

    return OrganizationOut(
        **{c.name: getattr(org, c.name) for c in org.__table__.columns},
        member_count = len(org.members),
        tenant_count = tenant_count
    )


# ══════════════════════════════════════════════════════════════════════════════
# GESTIÓN DE EMPRESAS (TENANTS) EN LA ORGANIZACIÓN
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/{org_id}/tenants", response_model=List[OrganizationTenantOut])
def list_org_tenants(
    org_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Listar las empresas de una organización."""
    org = _get_org_or_404(db, org_id)
    _assert_org_access(org, current_user)
    tenants = db.query(Tenant).filter(Tenant.organization_id == org_id).all()
    return [OrganizationTenantOut(
        id           = t.id,
        schema_name  = t.schema_name,
        name         = t.name,
        is_active    = t.is_active,
        license_type = t.license_type,
        trial_ends_at= t.trial_ends_at
    ) for t in tenants]


@router.post("/{org_id}/tenants/{tenant_id}", status_code=200)
def add_tenant_to_org(
    org_id: int, tenant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Agregar una empresa existente a una organización. Solo superadmin."""
    org = _get_org_or_404(db, org_id)

    # Verificar límite de empresas
    current_count = db.execute(
        text("SELECT COUNT(*) FROM public.tenants WHERE organization_id = :id"),
        {"id": org_id}
    ).scalar() or 0
    if current_count >= org.max_tenants:
        raise HTTPException(
            status_code=400,
            detail=f"La organización ya tiene {current_count}/{org.max_tenants} empresas. Actualiza el plan."
        )

    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    if tenant.organization_id and tenant.organization_id != org_id:
        raise HTTPException(status_code=400, detail="Esta empresa ya pertenece a otra organización")

    tenant.organization_id = org_id
    db.commit()
    return {"message": f"Empresa '{tenant.name}' agregada a '{org.name}'", "tenant_id": tenant_id}


@router.delete("/{org_id}/tenants/{tenant_id}", status_code=200)
def remove_tenant_from_org(
    org_id: int, tenant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Quitar una empresa de la organización. Solo superadmin."""
    tenant = db.query(Tenant).filter(
        Tenant.id == tenant_id,
        Tenant.organization_id == org_id
    ).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Empresa no encontrada en esta organización")
    tenant.organization_id = None
    db.commit()
    return {"message": f"Empresa '{tenant.name}' removida de la organización"}


# ══════════════════════════════════════════════════════════════════════════════
# GESTIÓN DE MIEMBROS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/{org_id}/members", response_model=List[OrganizationMemberOut])
def list_members(
    org_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    org = db.query(Organization).options(joinedload(Organization.members)).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organización no encontrada")
    _assert_org_access(org, current_user)
    return org.members


@router.post("/{org_id}/members", response_model=OrganizationMemberOut, status_code=201)
def invite_member(
    org_id: int,
    data: InviteMemberRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Invitar a un usuario a la organización (solo owner o superadmin)."""
    org = _get_org_or_404(db, org_id)
    _assert_org_access(org, current_user)

    # Solo owner puede invitar
    if not current_user.is_superuser:
        me = next((m for m in org.members if m.user_email == current_user.email), None)
        if not me or me.role != "owner":
            raise HTTPException(status_code=403, detail="Solo el owner puede invitar miembros")

    existing = db.query(OrganizationUser).filter(
        OrganizationUser.organization_id == org_id,
        OrganizationUser.user_email == data.user_email.lower()
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Este usuario ya es miembro de la organización")

    member = OrganizationUser(
        organization_id = org_id,
        user_email      = data.user_email.lower().strip(),
        role            = data.role,
        can_switch      = data.can_switch,
        accepted_at     = get_venezuela_now()  # auto-aceptar (sin flujo de email por ahora)
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


@router.delete("/{org_id}/members/{member_id}", status_code=200)
def remove_member(
    org_id: int, member_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Eliminar un miembro de la organización."""
    org = _get_org_or_404(db, org_id)
    _assert_org_access(org, current_user)
    member = db.query(OrganizationUser).filter(
        OrganizationUser.id == member_id,
        OrganizationUser.organization_id == org_id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Miembro no encontrado")
    if member.role == "owner":
        raise HTTPException(status_code=400, detail="No se puede eliminar al owner de la organización")
    db.delete(member)
    db.commit()
    return {"message": "Miembro eliminado"}


# ══════════════════════════════════════════════════════════════════════════════
# CATÁLOGO COMPARTIDO
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/{org_id}/catalog", response_model=List[SharedProductOut])
def list_shared_catalog(
    org_id: int,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Ver el catálogo compartido de la organización."""
    org = _get_org_or_404(db, org_id)
    _assert_org_access(org, current_user)
    q = db.query(SharedProduct).filter(
        SharedProduct.organization_id == org_id,
        SharedProduct.is_active == True
    )
    if search:
        q = q.filter(SharedProduct.name.ilike(f"%{search}%"))
    return q.order_by(SharedProduct.name).all()


@router.post("/{org_id}/catalog", response_model=SharedProductOut, status_code=201)
def add_to_catalog(
    org_id: int,
    data: SharedProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Agregar producto al catálogo compartido."""
    org = _get_org_or_404(db, org_id)
    _assert_org_access(org, current_user)

    product = SharedProduct(
        organization_id = org_id,
        name            = data.name.strip(),
        sku             = data.sku.strip() if data.sku else None,
        description     = data.description,
        cost_price      = data.cost_price,
        suggested_price = data.suggested_price,
        category_name   = data.category_name,
        image_url       = data.image_url
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.post("/{org_id}/catalog/import")
def import_catalog_to_tenant(
    org_id: int,
    data: ImportSharedProductRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Importar productos del catálogo compartido a la empresa actual del usuario.
    Crea los productos en el schema del tenant si no existen (por SKU).
    """
    from ..models.models import Product
    from ..tenant_context import get_tenant_schema

    org = _get_org_or_404(db, org_id)
    _assert_org_access(org, current_user)

    schema = get_tenant_schema()
    if schema == "public":
        raise HTTPException(status_code=400, detail="Debes estar dentro de una empresa para importar")

    shared_prods = db.query(SharedProduct).filter(
        SharedProduct.organization_id == org_id,
        SharedProduct.id.in_(data.product_ids),
        SharedProduct.is_active == True
    ).all()

    imported = skipped = 0
    for sp in shared_prods:
        # Verificar si ya existe por SKU
        existing = None
        if sp.sku:
            existing = db.query(Product).filter(Product.sku == sp.sku).first()
        if existing:
            skipped += 1
            continue

        new_prod = Product(
            name               = sp.name,
            sku                = sp.sku,
            description        = sp.description,
            cost_price         = float(sp.cost_price or 0),
            price              = float(sp.suggested_price if data.use_suggested_price else sp.cost_price or 0),
            stock              = data.initial_stock,
            is_active          = True,
            is_box             = False,
            is_combo           = False,
            is_service         = False,
            is_discount_active = False,
        )
        db.add(new_prod)
        imported += 1

    db.commit()
    return {
        "imported": imported,
        "skipped" : skipped,
        "message" : f"{imported} productos importados, {skipped} ya existían"
    }


# ══════════════════════════════════════════════════════════════════════════════
# DASHBOARD CONSOLIDADO
# ══════════════════════════════════════════════════════════════════════════════

# ══════════════════════════════════════════════════════════════════════════════
# CONFIGURACIÓN DE PLAN — Sprint 6
# ══════════════════════════════════════════════════════════════════════════════

@router.patch("/{org_id}/plan", response_model=OrganizationOut)
def update_org_plan(
    org_id: int,
    config: OrgPlanConfig,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """
    Actualizar el plan de una organización.
    Solo superadmin. Usado desde el panel SaaS y el bot de Telegram.
    Planes disponibles: duo (2 empresas), multi (5), enterprise (ilimitadas).
    """
    org = _get_org_or_404(db, org_id)

    # Actualizar campos del plan
    org.plan            = config.plan
    org.max_tenants     = config.max_tenants
    org.plan_price      = config.plan_price
    org.plan_notes      = config.plan_notes
    org.plan_expires_at = config.plan_expires_at

    db.commit()
    db.refresh(org)

    tenant_count = db.execute(
        text("SELECT COUNT(*) FROM public.tenants WHERE organization_id = :id"),
        {"id": org.id}
    ).scalar() or 0

    return OrganizationOut(
        **{c.name: getattr(org, c.name) for c in org.__table__.columns},
        member_count = len(org.members),
        tenant_count = tenant_count
    )


# ══════════════════════════════════════════════════════════════════════════════
# CONFIGURACIÓN DE WHATSAPP COMPARTIDO — Sprint 6
# ══════════════════════════════════════════════════════════════════════════════

@router.patch("/{org_id}/whatsapp", response_model=OrganizationOut)
def update_org_whatsapp(
    org_id: int,
    config: OrgWhatsAppConfig,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Configurar WhatsApp compartido para la organización.
    Cuando está activo, todas las empresas del grupo usan la misma
    instancia de Baileys para enviar mensajes a clientes.
    Solo owner de la organización o superadmin puede modificar.
    """
    org = db.query(Organization).options(
        joinedload(Organization.members)
    ).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organización no encontrada")

    # Verificar permiso: owner o superadmin
    if not current_user.is_superuser:
        member = next((m for m in org.members if m.user_email == current_user.email), None)
        if not member or member.role != "owner":
            raise HTTPException(status_code=403, detail="Solo el owner puede configurar WhatsApp compartido")

    org.use_shared_whatsapp = config.use_shared_whatsapp
    org.whatsapp_instance   = config.whatsapp_instance if config.use_shared_whatsapp else None

    db.commit()
    db.refresh(org)

    tenant_count = db.execute(
        text("SELECT COUNT(*) FROM public.tenants WHERE organization_id = :id"),
        {"id": org.id}
    ).scalar() or 0

    status = "activado" if config.use_shared_whatsapp else "desactivado"
    print(f"[ORG] WhatsApp compartido {status} para org '{org.name}' (instancia: {org.whatsapp_instance})")

    return OrganizationOut(
        **{c.name: getattr(org, c.name) for c in org.__table__.columns},
        member_count = len(org.members),
        tenant_count = tenant_count
    )


# ══════════════════════════════════════════════════════════════════════════════
# RESUMEN DEL PLAN — info pública del plan de la organización
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/{org_id}/plan-info")
def get_plan_info(
    org_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Obtener información del plan actual de la organización.
    Incluye límites, uso actual y estado de expiración.
    """
    org = _get_org_or_404(db, org_id)
    _assert_org_access(org, current_user)

    # Conteo actual de empresas
    tenant_count = db.execute(
        text("SELECT COUNT(*) FROM public.tenants WHERE organization_id = :id"),
        {"id": org.id}
    ).scalar() or 0

    # Calcular si el plan ha vencido
    from datetime import datetime as _dt
    expired = False
    days_left = None
    if org.plan_expires_at:
        delta = org.plan_expires_at - _dt.now()
        expired   = delta.days < 0
        days_left = max(0, delta.days)

    # Definición de planes
    plan_limits = {
        "duo"       : {"label": "Dúo",        "max": 2,  "desc": "Hasta 2 empresas"},
        "multi"     : {"label": "Multi",       "max": 5,  "desc": "Hasta 5 empresas"},
        "enterprise": {"label": "Enterprise",  "max": 999,"desc": "Empresas ilimitadas"},
    }
    plan_info = plan_limits.get(org.plan, {"label": org.plan, "max": org.max_tenants, "desc": ""})

    return {
        "organization_id"     : org.id,
        "organization_name"   : org.name,
        "plan"                : org.plan,
        "plan_label"          : plan_info["label"],
        "plan_description"    : plan_info["desc"],
        "max_tenants"         : org.max_tenants,
        "current_tenants"     : tenant_count,
        "slots_available"     : max(0, org.max_tenants - tenant_count),
        "plan_price"          : float(org.plan_price or 0),
        "plan_expires_at"     : org.plan_expires_at.isoformat() if org.plan_expires_at else None,
        "is_expired"          : expired,
        "days_left"           : days_left,
        "use_shared_whatsapp" : org.use_shared_whatsapp or False,
        "whatsapp_instance"   : org.whatsapp_instance,
        "is_active"           : org.is_active,
    }


@router.get("/{org_id}/consolidated", response_model=ConsolidatedSummary)
def consolidated_dashboard(
    org_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Dashboard consolidado: ventas del día, stock bajo y mejor empresa del grupo.
    """
    from datetime import date

    org = db.query(Organization).options(joinedload(Organization.members)).filter(
        Organization.id == org_id
    ).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organización no encontrada")
    _assert_org_access(org, current_user)

    tenants = db.query(Tenant).filter(
        Tenant.organization_id == org_id,
        Tenant.is_active == True
    ).all()

    summaries      = []
    total_sales    = 0.0
    total_txns     = 0
    total_low_stock= 0
    best_tenant    = None
    best_sales     = 0.0

    for t in tenants:
        try:
            today_str = date.today().isoformat()
            # Ventas del día en el schema del tenant
            sales_row = db.execute(text(
                f'SELECT COALESCE(SUM(total_amount),0), COUNT(*) '
                f'FROM "{t.schema_name}".sales '
                f'WHERE date::date = :today'
            ), {"today": today_str}).fetchone()
            sales_today = float(sales_row[0]) if sales_row else 0.0
            sales_count = int(sales_row[1])   if sales_row else 0

            # Productos bajo stock mínimo
            low_row = db.execute(text(
                f'SELECT COUNT(*) FROM "{t.schema_name}".products '
                f'WHERE is_active=true AND min_stock IS NOT NULL '
                f'AND min_stock > 0 AND stock <= min_stock'
            )).scalar() or 0

            total_sales    += sales_today
            total_txns     += sales_count
            total_low_stock+= int(low_row)

            if sales_today > best_sales:
                best_sales  = sales_today
                best_tenant = t.name

            summaries.append(TenantDailySummary(
                tenant_id   = t.id,
                schema_name = t.schema_name,
                name        = t.name,
                sales_today = sales_today,
                sales_count = sales_count,
                low_stock   = int(low_row)
            ))
        except Exception as ex:
            # Si el schema no tiene la tabla (tenant reciente) — ignorar
            summaries.append(TenantDailySummary(
                tenant_id=t.id, schema_name=t.schema_name, name=t.name
            ))

    return ConsolidatedSummary(
        organization_id    = org.id,
        organization_name  = org.name,
        total_sales_today  = total_sales,
        total_transactions = total_txns,
        best_tenant_name   = best_tenant,
        best_tenant_sales  = best_sales,
        total_low_stock    = total_low_stock,
        tenants            = sorted(summaries, key=lambda x: x.sales_today, reverse=True)
    )
