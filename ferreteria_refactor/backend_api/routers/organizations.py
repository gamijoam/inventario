"""
Router — Sistema Multi-Empresa
Endpoints para gestión de organizaciones (grupos empresariales)
"""
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text, func
from typing import List, Optional
import re

from ..database.db import get_db
from ..models.organization import (
    Organization, OrganizationUser, SharedProduct,
    InterCompanyTransfer, InterCompanyTransferItem,
    OrganizationChatMessage, OrganizationChatAttachment, OrganizationChatRead
)
from ..models.models import User, UserRole
from ..models.tenant import Tenant
from ..schemas.organization import (
    OrganizationCreate, OrganizationUpdate, OrganizationOut,
    InviteMemberRequest, OrganizationMemberOut, OrganizationTenantOut,
    SharedProductCreate, SharedProductOut, ImportSharedProductRequest, CatalogSyncRequest,
    InterCompanyTransferCreate, InterCompanyTransferOut,
    ConsolidatedSummary, TenantDailySummary, OrgCompanyOut,
    OrgPlanConfig, OrgWhatsAppConfig,
    StockSearchMatch, StockSearchResponse,
    OrganizationChatMessageOut
)
from ..dependencies import get_current_active_user, get_current_superuser, require_permission, require_any_permission
from ..utils.time_utils import get_venezuela_now

router = APIRouter(prefix="/organizations", tags=["organizations"])


ALLOWED_ORG_CHAT_UPLOAD_EXTENSIONS = {"json", "xlsx", "xls", "csv", "txt", "pdf", "png", "jpg", "jpeg", "webp"}
MAX_ORG_CHAT_UPLOAD_BYTES = 10 * 1024 * 1024


def _current_tenant_for_user(db: Session, user: User) -> Optional[Tenant]:
    from ..tenant_context import get_tenant_schema
    schema = get_tenant_schema()
    if schema and schema != "public":
        tenant = db.query(Tenant).filter(Tenant.schema_name == schema).first()
        if tenant:
            return tenant
    if user.tenant_id:
        return db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
    return None


def _save_org_chat_upload(file: UploadFile, org_id: int) -> tuple[str, int]:
    import os
    import uuid
    from ..utils.media_utils import BASE_MEDIA_DIR

    original = file.filename or "archivo"
    extension = original.rsplit('.', 1)[-1].lower() if '.' in original else ''
    if extension not in ALLOWED_ORG_CHAT_UPLOAD_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Tipo de archivo no permitido para el chat")

    target_dir = os.path.join(BASE_MEDIA_DIR, "organizations", str(org_id), "chat")
    os.makedirs(target_dir, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}.{extension}"
    target_path = os.path.join(target_dir, stored_name)

    size = 0
    with open(target_path, "wb") as out:
        while True:
            chunk = file.file.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > MAX_ORG_CHAT_UPLOAD_BYTES:
                out.close()
                try:
                    os.remove(target_path)
                except OSError:
                    pass
                raise HTTPException(status_code=400, detail="El archivo supera el limite de 10 MB")
            out.write(chunk)

    return f"/media/organizations/{org_id}/chat/{stored_name}", size


def _org_chat_message_payload(message: OrganizationChatMessage) -> dict:
    tenant = getattr(message, "tenant", None)
    return {
        "id": message.id,
        "organization_id": message.organization_id,
        "sender_email": message.sender_email,
        "sender_name": message.sender_name,
        "tenant_id": message.tenant_id,
        "tenant_name": tenant.name if tenant else None,
        "tenant_schema": tenant.schema_name if tenant else None,
        "message": message.message,
        "created_at": message.created_at.isoformat() if message.created_at else None,
        "attachments": [
            {
                "id": a.id,
                "organization_id": a.organization_id,
                "message_id": a.message_id,
                "original_filename": a.original_filename,
                "stored_url": a.stored_url,
                "content_type": a.content_type,
                "file_size": a.file_size,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            } for a in getattr(message, "attachments", [])
        ],
    }



def _org_chat_read_state(db: Session, org_id: int, user: User) -> OrganizationChatRead:
    email = (user.email or "").lower().strip()
    read = db.query(OrganizationChatRead).filter(
        OrganizationChatRead.organization_id == org_id,
        OrganizationChatRead.user_email == email,
    ).first()
    if not read:
        read = OrganizationChatRead(
            organization_id=org_id,
            user_email=email,
            last_read_message_id=0,
            last_read_at=get_venezuela_now(),
        )
        db.add(read)
        db.flush()
    return read


def _mark_org_chat_read(db: Session, org_id: int, user: User, message_id: Optional[int] = None) -> OrganizationChatRead:
    read = _org_chat_read_state(db, org_id, user)
    if message_id is None:
        message_id = db.query(func.max(OrganizationChatMessage.id)).filter(
            OrganizationChatMessage.organization_id == org_id
        ).scalar() or 0
    read.last_read_message_id = max(int(read.last_read_message_id or 0), int(message_id or 0))
    read.last_read_at = get_venezuela_now()
    db.flush()
    return read

def _decorate_org_chat_message(message: OrganizationChatMessage) -> OrganizationChatMessageOut:
    tenant = getattr(message, "tenant", None)
    return OrganizationChatMessageOut(
        id=message.id,
        organization_id=message.organization_id,
        sender_email=message.sender_email,
        sender_name=message.sender_name,
        tenant_id=message.tenant_id,
        tenant_name=tenant.name if tenant else None,
        tenant_schema=tenant.schema_name if tenant else None,
        message=message.message,
        created_at=message.created_at,
        attachments=getattr(message, "attachments", []) or [],
    )


def _slug_from_name(name: str) -> str:
    """Genera un slug URL-safe desde el nombre de la organización."""
    slug = re.sub(r'[^a-z0-9]+', '-', name.lower().strip())
    return slug.strip('-')[:80]


def _get_org_or_404(db: Session, org_id: int) -> Organization:
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organización no encontrada")
    return org


def _org_member(org: Organization, user: User):
    email = (user.email or "").lower().strip()
    return next((m for m in org.members if (m.user_email or "").lower().strip() == email), None)


def _is_org_owner_email(org: Organization, user: User) -> bool:
    return (org.owner_email or "").lower().strip() == (user.email or "").lower().strip()


def _assert_org_access(org: Organization, user: User):
    """Verifica que el usuario tiene acceso a esta organizacion."""
    if user.is_superuser or _is_org_owner_email(org, user):
        return None
    member = _org_member(org, user)
    if not member or not member.can_switch:
        raise HTTPException(status_code=403, detail="No tienes acceso a esta organizacion")
    return member


def _assert_org_role(org: Organization, user: User, allowed_roles: set[str], detail: str):
    """Verifica rol dentro de la organizacion: owner, manager o viewer."""
    if user.is_superuser:
        return None
    if _is_org_owner_email(org, user) and "owner" in allowed_roles:
        return None
    member = _assert_org_access(org, user)
    if not member or (member.role or "").lower() not in allowed_roles:
        raise HTTPException(status_code=403, detail=detail)
    return member


def _assert_org_owner(org: Organization, user: User, detail: str = "Solo el owner puede modificar esta configuracion"):
    """Verifica que el usuario sea owner de la organizacion o superadmin."""
    return _assert_org_role(org, user, {"owner"}, detail)


_SAFE_SCHEMA_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_NUMERIC_SKU_RE = re.compile(r"^\d+(?:\.0+)?$")


def _quote_schema(schema: str) -> str:
    schema = (schema or "").strip()
    if not _SAFE_SCHEMA_RE.match(schema):
        raise HTTPException(status_code=400, detail="Schema de empresa invalido")
    return '"' + schema.replace('"', '""') + '"'


def _canonical_catalog_sku(product_id: int, sku: Optional[str]) -> str:
    raw = str(sku or "").strip()
    if raw and _NUMERIC_SKU_RE.match(raw):
        return raw.split(".", 1)[0]
    if raw and raw.upper().startswith("CAT-"):
        return raw.upper()
    return f"CAT-{int(product_id):06d}"


def _money(value) -> float:
    return float(value or 0)


def _org_active_tenants(db: Session, org_id: int) -> list[Tenant]:
    return db.query(Tenant).filter(Tenant.organization_id == org_id, Tenant.is_active == True).order_by(Tenant.name.asc()).all()


def _pick_master_tenant(db: Session, org_id: int, current_user: User, master_schema: Optional[str] = None) -> Tenant:
    tenants = _org_active_tenants(db, org_id)
    if not tenants:
        raise HTTPException(status_code=400, detail="La organizacion no tiene empresas activas")
    by_schema = {t.schema_name: t for t in tenants}
    if master_schema:
        if master_schema not in by_schema:
            raise HTTPException(status_code=400, detail="La empresa maestra no pertenece a esta organizacion")
        return by_schema[master_schema]
    current = _current_tenant_for_user(db, current_user)
    if current and current.schema_name in by_schema:
        return by_schema[current.schema_name]
    return tenants[0]


def _tenant_products(db: Session, schema: str) -> list[dict]:
    qschema = _quote_schema(schema)
    sql = (
        "SELECT id, name, sku, description, price, price_mayor_1, price_mayor_2, "
        "cost_price, stock, is_active, has_imei, image_url "
        f"FROM {qschema}.products "
        "WHERE COALESCE(is_active, true) = true ORDER BY name, id"
    )
    return [dict(r) for r in db.execute(text(sql)).mappings().all()]


def _tenant_price_lists(db: Session, schema: str) -> list[dict]:
    qschema = _quote_schema(schema)
    sql = (
        "SELECT id, name, COALESCE(currency_code, 'FLEX') AS currency_code, "
        "COALESCE(payment_policy, 'flexible') AS payment_policy, "
        "COALESCE(requires_auth, false) AS requires_auth, COALESCE(is_active, true) AS is_active "
        f"FROM {qschema}.price_lists WHERE COALESCE(is_active, true) = true ORDER BY name"
    )
    return [dict(r) for r in db.execute(text(sql)).mappings().all()]


def _tenant_product_prices(db: Session, schema: str) -> list[dict]:
    qschema = _quote_schema(schema)
    sql = (
        "SELECT p.id AS product_id, p.sku, pl.id AS price_list_id, pl.name AS list_name, "
        "pp.price, COALESCE(pl.currency_code, 'FLEX') AS currency_code, "
        "COALESCE(pl.payment_policy, 'flexible') AS payment_policy "
        f"FROM {qschema}.product_prices pp "
        f"JOIN {qschema}.products p ON p.id = pp.product_id "
        f"JOIN {qschema}.price_lists pl ON pl.id = pp.price_list_id "
        "WHERE COALESCE(p.is_active, true) = true AND COALESCE(pl.is_active, true) = true"
    )
    return [dict(r) for r in db.execute(text(sql)).mappings().all()]


def _catalog_maps(db: Session, schema: str) -> dict:
    products = _tenant_products(db, schema)
    price_lists = _tenant_price_lists(db, schema)
    product_prices = _tenant_product_prices(db, schema)
    by_sku = {}
    duplicates = {}
    blank_sku = 0
    for product in products:
        sku = _canonical_catalog_sku(product["id"], product.get("sku"))
        if not str(product.get("sku") or "").strip():
            blank_sku += 1
        product["catalog_sku"] = sku
        if sku in by_sku:
            duplicates.setdefault(sku, 1)
            duplicates[sku] += 1
        else:
            by_sku[sku] = product
    list_by_name = {pl["name"]: pl for pl in price_lists}
    sku_by_product_id = {product["id"]: product["catalog_sku"] for product in products}
    price_by_sku_list = {}
    for price in product_prices:
        sku = sku_by_product_id.get(price.get("product_id"))
        if not sku:
            continue
        price_by_sku_list[(sku, price["list_name"])] = price
    return {"products": products, "by_sku": by_sku, "price_lists": price_lists, "list_by_name": list_by_name, "prices": product_prices, "price_by_sku_list": price_by_sku_list, "blank_sku": blank_sku, "duplicate_sku_groups": len(duplicates)}


def _catalog_tenant_summary(master: dict, target: dict) -> dict:
    master_skus = set(master["by_sku"].keys())
    target_skus = set(target["by_sku"].keys())
    common = master_skus & target_skus
    missing = master_skus - target_skus
    extra = target_skus - master_skus
    product_diffs = 0
    for sku in common:
        mp = master["by_sku"][sku]
        tp = target["by_sku"][sku]
        if (str(mp.get("name") or "").strip() != str(tp.get("name") or "").strip()
            or round(_money(mp.get("price")), 4) != round(_money(tp.get("price")), 4)
            or round(_money(mp.get("cost_price")), 4) != round(_money(tp.get("cost_price")), 4)
            or round(_money(mp.get("price_mayor_1")), 4) != round(_money(tp.get("price_mayor_1")), 4)
            or round(_money(mp.get("price_mayor_2")), 4) != round(_money(tp.get("price_mayor_2")), 4)):
            product_diffs += 1
    master_lists = set(master["list_by_name"].keys())
    target_lists = set(target["list_by_name"].keys())
    missing_lists = master_lists - target_lists
    price_missing = 0
    price_diffs = 0
    for sku in common:
        for list_name in master_lists:
            mp = master["price_by_sku_list"].get((sku, list_name))
            if not mp:
                continue
            tp = target["price_by_sku_list"].get((sku, list_name))
            if not tp:
                price_missing += 1
            elif round(_money(mp.get("price")), 4) != round(_money(tp.get("price")), 4):
                price_diffs += 1
    return {"products": len(target["products"]), "matched": len(common), "missing": len(missing), "extra": len(extra), "product_diffs": product_diffs, "price_lists": len(target_lists), "missing_price_lists": len(missing_lists), "price_missing": price_missing, "price_diffs": price_diffs, "blank_sku": target["blank_sku"], "duplicate_sku_groups": target["duplicate_sku_groups"], "healthy": not (missing or product_diffs or missing_lists or price_missing or price_diffs or target["duplicate_sku_groups"])}


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

    # Si se proporcionó contraseña, crear el usuario dueño en cada tenant de la org
    # (los tenants se agregan después, pero si ya están asignados se crea inmediatamente)
    if data.owner_password:
        try:
            from passlib.context import CryptContext as _Crypt
            from ..models.models import User as _User, UserRole as _Role
            _ctx  = _Crypt(schemes=["bcrypt"], deprecated="auto")
            _hash = _ctx.hash(data.owner_password)

            # Crear en todos los tenants que ya pertenezcan a la org
            _org_tenants = db.query(Tenant).filter(
                Tenant.organization_id == org.id,
                Tenant.is_active == True
            ).all()
            for _t in _org_tenants:
                _exists = db.query(_User).filter(
                    _User.email == data.owner_email.lower().strip(),
                    _User.tenant_id == _t.id
                ).first()
                if not _exists:
                    _u = _User(
                        email         = data.owner_email.lower().strip(),
                        username      = data.owner_name or data.owner_email.split("@")[0],
                        password_hash = _hash,
                        role          = _Role.ADMIN,
                        tenant_id     = _t.id,
                        is_active     = True,
                        is_superuser  = False,
                    )
                    db.add(_u)
            db.commit()
        except Exception as _e:
            print(f"[Org] ⚠️ No se pudo crear usuario dueño: {_e}")

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


@router.get("/my-org", dependencies=[Depends(require_permission("org.panel.view"))])
def get_my_organization(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Devuelve la organización del usuario actual con sus tenants."""
    memberships = db.query(OrganizationUser).filter(
        OrganizationUser.user_email == current_user.email,
        OrganizationUser.can_switch == True
    ).all()

    if not memberships:
        return []

    result = []
    seen_orgs = set()
    for m in memberships:
        if m.organization_id in seen_orgs:
            continue
        seen_orgs.add(m.organization_id)

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

        tenant_count = len(tenants)
        result.append({
            "id": org.id,
            "name": org.name,
            "slug": org.slug,
            "owner_email": org.owner_email,
            "plan": org.plan,
            "max_tenants": org.max_tenants,
            "primary_color": org.primary_color,
            "logo_url": org.logo_url,
            "member_count": len(org.members) if hasattr(org, "members") else 0,
            "tenant_count": tenant_count,
            "my_role": m.role,
        })
    return result


@router.get("/mine", response_model=List[OrgCompanyOut], dependencies=[Depends(require_permission("org.panel.view"))])
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


@router.get("/consolidated-mine", response_model=ConsolidatedSummary, dependencies=[Depends(require_permission("org.panel.view"))])
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


@router.get("/my-org/stock-search", response_model=StockSearchResponse, dependencies=[Depends(require_permission("org.panel.view"))])
def stock_search_my_org(
    q: str = Query(..., min_length=2, description="Buscar por SKU o nombre (mín. 2 caracteres)"),
    limit_per_tenant: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Busca un producto por SKU o nombre en TODAS las empresas de la organización
    del usuario actual. Devuelve dónde hay stock y cuánto.

    - Match: SKU ILIKE 'q%' (prefijo) OR name ILIKE '%q%' (contiene).
    - Solo tenants activos y productos activos.
    - Resultados ordenados por stock desc.

    Permisos: cualquier miembro de la organización (con can_switch=true).
    TODO: en una fase posterior, gate por role (owner/manager/viewer).
    """
    # Localizar la organización del usuario por su email
    membership = db.query(OrganizationUser).filter(
        OrganizationUser.user_email == current_user.email,
        OrganizationUser.can_switch == True
    ).first()
    if not membership:
        raise HTTPException(status_code=404, detail="No perteneces a ninguna organización")

    org = db.query(Organization).filter(
        Organization.id == membership.organization_id,
        Organization.is_active == True
    ).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organización inactiva o no encontrada")

    tenants = db.query(Tenant).filter(
        Tenant.organization_id == org.id,
        Tenant.is_active == True
    ).all()

    q_clean   = q.strip()
    sku_like  = f"{q_clean}%"
    name_like = f"%{q_clean}%"
    member_role = (membership.role or "").lower()
    can_view_cost = current_user.is_superuser or member_role in {"owner", "manager"}

    results: List[StockSearchMatch] = []
    for t in tenants:
        try:
            rows = db.execute(text(
                f'SELECT id, sku, name, stock, COALESCE(min_stock,0) AS min_stock, '
                f'       COALESCE(price,0) AS price, COALESCE(cost_price,0) AS cost_price, '
                f'       is_active '
                f'FROM "{t.schema_name}".products '
                f'WHERE is_active = true '
                f'  AND (sku ILIKE :sku_like OR name ILIKE :name_like) '
                f'ORDER BY stock DESC, name ASC '
                f'LIMIT :lim'
            ), {"sku_like": sku_like, "name_like": name_like, "lim": limit_per_tenant}).fetchall()

            for r in rows:
                stk = float(r.stock or 0)
                ms  = float(r.min_stock or 0)
                results.append(StockSearchMatch(
                    tenant_id     = t.id,
                    tenant_name   = t.name,
                    tenant_schema = t.schema_name,
                    product_id    = int(r.id),
                    sku           = r.sku,
                    name          = r.name,
                    stock         = stk,
                    min_stock     = ms,
                    price         = float(r.price or 0),
                    cost_price    = float(r.cost_price or 0) if can_view_cost else 0,
                    is_active     = bool(r.is_active),
                    low_stock     = (ms > 0 and stk <= ms)
                ))
        except Exception:
            # Schema sin tabla products todavía (tenant recén creado) -> ignorar
            continue

    # Re-ordenar globalmente por stock desc para que las mejores filas suban
    results.sort(key=lambda x: (-x.stock, x.name or ""))

    return StockSearchResponse(
        query             = q_clean,
        organization_id   = org.id,
        organization_name = org.name,
        tenants_searched  = len(tenants),
        total_matches     = len(results),
        results           = results
    )


@router.get("/{org_id}", response_model=OrganizationOut, dependencies=[Depends(require_permission("org.panel.view"))])
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

@router.get("/{org_id}/tenants", response_model=List[OrganizationTenantOut], dependencies=[Depends(require_permission("org.panel.view"))])
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


@router.post("/{org_id}/tenants/{tenant_id}", status_code=200, dependencies=[Depends(require_permission("org.tenants.manage"))])
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
    db.flush()

    # Crear el usuario dueño de la org en este tenant si tiene contraseña definida
    # (la contraseña la tiene el org owner si fue creada con owner_password)
    # Usamos oprcanhash si existe, o buscamos el usuario del dueño en otro tenant
    try:
        from ..models.models import User as _User, UserRole as _Role
        owner_email = org.owner_email.lower().strip()
        # Buscar si ya existe en algún tenant de la org para obtener su hash
        existing_owner = db.query(_User).filter(
            _User.email == owner_email,
        ).first()
        
        if existing_owner:
            # Verificar que no exista ya en este tenant
            already = db.query(_User).filter(
                _User.email == owner_email,
                _User.tenant_id == tenant_id
            ).first()
            if not already:
                new_user = _User(
                    email         = owner_email,
                    username      = existing_owner.username or owner_email.split("@")[0],
                    password_hash = existing_owner.password_hash,
                    role          = _Role.ADMIN,
                    tenant_id     = tenant_id,
                    is_active     = True,
                    is_superuser  = False,
                )
                db.add(new_user)
    except Exception as _e:
        print(f"[Org] ⚠️ No se pudo crear usuario dueño en tenant {tenant_id}: {_e}")

    db.commit()
    return {"message": f"Empresa '{tenant.name}' agregada a '{org.name}'", "tenant_id": tenant_id}


@router.delete("/{org_id}/tenants/{tenant_id}", status_code=200, dependencies=[Depends(require_permission("org.tenants.manage"))])
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
# TRANSFERENCIA DE EMPRESAS ENTRE ORGANIZACIONES
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/{org_id}/tenants/{tenant_id}/transfer", status_code=200, dependencies=[Depends(require_permission("org.tenants.manage"))])
def transfer_tenant_to_org(
    org_id: int,
    tenant_id: int,
    target_org_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """
    Transferir una empresa de una organización a otra.
    Solo superadmin. La empresa sale de org_id y entra a target_org_id.
    """
    # Verificar org origen
    org_origen = _get_org_or_404(db, org_id)

    # Verificar org destino
    org_destino = db.query(Organization).filter(Organization.id == target_org_id).first()
    if not org_destino:
        raise HTTPException(status_code=404, detail="Organización destino no encontrada")
    if not org_destino.is_active:
        raise HTTPException(status_code=400, detail="La organización destino está inactiva")

    # Verificar que la empresa existe y pertenece a org_origen
    tenant = db.query(Tenant).filter(
        Tenant.id == tenant_id,
        Tenant.organization_id == org_id
    ).first()
    if not tenant:
        raise HTTPException(
            status_code=404,
            detail=f"La empresa no existe o no pertenece a la organización '{org_origen.name}'"
        )

    # Verificar límite en la org destino
    destino_count = db.execute(
        text("SELECT COUNT(*) FROM public.tenants WHERE organization_id = :id"),
        {"id": target_org_id}
    ).scalar() or 0
    if destino_count >= org_destino.max_tenants:
        raise HTTPException(
            status_code=400,
            detail=f"La organización destino ya tiene {destino_count}/{org_destino.max_tenants} empresas. Actualiza el plan."
        )

    # Ejecutar la transferencia
    nombre_tenant = tenant.name
    tenant.organization_id = target_org_id
    db.commit()

    return {
        "ok"           : True,
        "mensaje"      : f"'{nombre_tenant}' transferida de '{org_origen.name}' → '{org_destino.name}'",
        "tenant_id"    : tenant_id,
        "org_origen_id": org_id,
        "org_destino_id": target_org_id,
    }


# ══════════════════════════════════════════════════════════════════════════════
# GESTIÓN DE MIEMBROS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/{org_id}/members", response_model=List[OrganizationMemberOut], dependencies=[Depends(require_permission("org.panel.view"))])
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


@router.post("/{org_id}/members", response_model=OrganizationMemberOut, status_code=201, dependencies=[Depends(require_permission("org.members.manage"))])
def invite_member(
    org_id: int,
    data: InviteMemberRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Invitar a un usuario a la organización (solo owner o superadmin)."""
    org = _get_org_or_404(db, org_id)
    _assert_org_owner(org, current_user, "Solo el owner puede invitar miembros")
    if data.role not in {"owner", "manager", "viewer"}:
        raise HTTPException(status_code=400, detail="Rol invalido para miembro de organizacion")

    member_email = data.user_email.lower().strip()
    existing = db.query(OrganizationUser).filter(
        OrganizationUser.organization_id == org_id,
        OrganizationUser.user_email == member_email
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Este usuario ya es miembro de la organización")

    member = OrganizationUser(
        organization_id = org_id,
        user_email      = member_email,
        role            = data.role,
        can_switch      = data.can_switch,
        accepted_at     = get_venezuela_now()  # auto-aceptar (sin flujo de email por ahora)
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


@router.delete("/{org_id}/members/{member_id}", status_code=200, dependencies=[Depends(require_permission("org.members.manage"))])
def remove_member(
    org_id: int, member_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Eliminar un miembro de la organización."""
    org = _get_org_or_404(db, org_id)
    _assert_org_owner(org, current_user, "Solo el owner puede eliminar miembros")
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


@router.get("/{org_id}/activity", dependencies=[Depends(require_permission("org.panel.view"))])
def get_org_activity(
    org_id: int,
    limit: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Actividad reciente del portal empresarial sin depender de migraciones."""
    org = db.query(Organization).options(joinedload(Organization.members)).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organizacion no encontrada")
    _assert_org_owner(org, current_user, "Solo el owner puede ver la actividad empresarial")

    tenants = db.query(Tenant).filter(Tenant.organization_id == org_id).all()
    events = []

    def add_event(event_type, title, detail, occurred_at=None, actor=None, severity="info", meta=None):
        events.append({
            "type"       : event_type,
            "title"      : title,
            "detail"     : detail,
            "actor"      : actor,
            "severity"   : severity,
            "occurred_at": occurred_at.isoformat() if occurred_at else None,
            "meta"       : meta or {},
        })

    add_event(
        "organization.created",
        "Organizacion creada",
        f"{org.name} quedo registrada como grupo empresarial.",
        org.created_at,
        org.owner_email,
        "success",
        {"plan": org.plan, "max_tenants": org.max_tenants},
    )

    add_event(
        "whatsapp.status",
        "WhatsApp compartido",
        "Activo para el grupo." if org.use_shared_whatsapp else "Cada empresa usa su configuracion individual.",
        org.created_at,
        "Configuracion",
        "success" if org.use_shared_whatsapp else "info",
        {"instance": org.whatsapp_instance, "shared": bool(org.use_shared_whatsapp)},
    )

    for tenant in tenants:
        add_event(
            "tenant.linked",
            "Empresa en el grupo",
            f"{tenant.name} forma parte de la organizacion.",
            tenant.created_at,
            tenant.schema_name,
            "success" if tenant.is_active else "warning",
            {
                "tenant_id": tenant.id,
                "schema_name": tenant.schema_name,
                "license_type": tenant.license_type,
                "active": tenant.is_active,
            },
        )

    for member in org.members:
        add_event(
            "member.invited",
            "Miembro agregado",
            f"{member.user_email} tiene rol {member.role}.",
            member.invited_at,
            member.user_email,
            "success" if member.can_switch else "warning",
            {"role": member.role, "can_switch": member.can_switch},
        )
        if member.accepted_at and member.accepted_at != member.invited_at:
            add_event(
                "member.accepted",
                "Acceso aceptado",
                f"{member.user_email} quedo activo en el grupo.",
                member.accepted_at,
                member.user_email,
                "success",
                {"role": member.role},
            )

    def sort_key(event):
        return event["occurred_at"] or ""

    events = sorted(events, key=sort_key, reverse=True)[:limit]
    return {
        "organization_id"   : org.id,
        "organization_name" : org.name,
        "total_events"      : len(events),
        "members_count"     : len(org.members),
        "tenants_count"     : len(tenants),
        "events"            : events,
    }


@router.get("/{org_id}/catalog", response_model=List[SharedProductOut], dependencies=[Depends(require_permission("org.panel.view"))])
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


@router.post("/{org_id}/catalog", response_model=SharedProductOut, status_code=201, dependencies=[Depends(require_permission("org.tenants.manage"))])
def add_to_catalog(
    org_id: int,
    data: SharedProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Agregar producto al catálogo compartido."""
    org = _get_org_or_404(db, org_id)
    _assert_org_role(org, current_user, {"owner", "manager"}, "Solo owner o manager puede modificar el catalogo compartido")

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


@router.post("/{org_id}/catalog/import", dependencies=[Depends(require_permission("org.tenants.manage"))])
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
    _assert_org_role(org, current_user, {"owner", "manager"}, "Solo owner o manager puede importar catalogo compartido")

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


@router.get("/{org_id}/catalog/health", dependencies=[Depends(require_permission("org.panel.view"))])
def catalog_health(
    org_id: int,
    master_schema: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    org = _get_org_or_404(db, org_id)
    _assert_org_access(org, current_user)
    tenants = _org_active_tenants(db, org_id)
    master_tenant = _pick_master_tenant(db, org_id, current_user, master_schema)
    master_maps = _catalog_maps(db, master_tenant.schema_name)

    tenant_summaries = []
    totals = {"products": 0, "missing": 0, "product_diffs": 0, "missing_price_lists": 0, "price_missing": 0, "price_diffs": 0, "duplicate_sku_groups": 0}
    for tenant in tenants:
        maps = master_maps if tenant.schema_name == master_tenant.schema_name else _catalog_maps(db, tenant.schema_name)
        summary = _catalog_tenant_summary(master_maps, maps)
        summary.update({"tenant_id": tenant.id, "tenant_name": tenant.name, "schema_name": tenant.schema_name, "is_master": tenant.schema_name == master_tenant.schema_name})
        tenant_summaries.append(summary)
        for key in totals:
            totals[key] += int(summary.get(key) or 0)

    return {
        "organization_id": org.id,
        "organization_name": org.name,
        "master": {"tenant_id": master_tenant.id, "tenant_name": master_tenant.name, "schema_name": master_tenant.schema_name, "products": len(master_maps["products"]), "price_lists": len(master_maps["price_lists"])},
        "totals": totals,
        "tenants": tenant_summaries,
    }


@router.post("/{org_id}/catalog/sync", dependencies=[Depends(require_permission("org.tenants.manage"))])
def sync_catalog_between_tenants(
    org_id: int,
    data: CatalogSyncRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    org = _get_org_or_404(db, org_id)
    _assert_org_role(org, current_user, {"owner", "manager"}, "Solo owner o manager puede sincronizar catalogos")
    tenants = _org_active_tenants(db, org_id)
    master_tenant = _pick_master_tenant(db, org_id, current_user, data.master_schema)
    master_maps = _catalog_maps(db, master_tenant.schema_name)
    master_lists = master_maps["price_lists"]
    master_prices = master_maps["price_by_sku_list"]

    results = []
    for tenant in tenants:
        if tenant.schema_name == master_tenant.schema_name:
            continue
        qschema = _quote_schema(tenant.schema_name)
        target = _catalog_maps(db, tenant.schema_name)
        result = {"tenant_id": tenant.id, "tenant_name": tenant.name, "schema_name": tenant.schema_name, "updated": 0, "created": 0, "price_lists_created": 0, "prices_upserted": 0, "skipped_missing": 0}

        if data.sync_price_lists:
            for price_list in master_lists:
                target_list = target["list_by_name"].get(price_list["name"])
                params = {"name": price_list["name"], "currency_code": price_list.get("currency_code") or "FLEX", "payment_policy": price_list.get("payment_policy") or "flexible", "requires_auth": bool(price_list.get("requires_auth") or False)}
                if target_list:
                    if not data.dry_run:
                        db.execute(text(f"UPDATE {qschema}.price_lists SET currency_code = :currency_code, payment_policy = :payment_policy, requires_auth = :requires_auth WHERE id = :id"), {**params, "id": target_list["id"]})
                else:
                    result["price_lists_created"] += 1
                    if not data.dry_run:
                        new_id = db.execute(text(f"INSERT INTO {qschema}.price_lists (name, currency_code, payment_policy, requires_auth, is_active, created_at) VALUES (:name, :currency_code, :payment_policy, :requires_auth, true, now()) RETURNING id"), params).scalar()
                    else:
                        new_id = -result["price_lists_created"]
                    target["list_by_name"][price_list["name"]] = {**params, "id": new_id, "is_active": True}

        for sku, master_product in master_maps["by_sku"].items():
            target_product = target["by_sku"].get(sku)
            params = {"name": master_product.get("name"), "sku": sku, "description": master_product.get("description"), "price": _money(master_product.get("price")), "price_mayor_1": _money(master_product.get("price_mayor_1")), "price_mayor_2": _money(master_product.get("price_mayor_2")), "cost_price": _money(master_product.get("cost_price")), "has_imei": bool(master_product.get("has_imei") or False), "image_url": master_product.get("image_url")}
            if target_product:
                if data.update_existing:
                    result["updated"] += 1
                    if not data.dry_run:
                        db.execute(text(f"UPDATE {qschema}.products SET name = :name, sku = :sku, description = :description, price = :price, price_mayor_1 = :price_mayor_1, price_mayor_2 = :price_mayor_2, cost_price = :cost_price, has_imei = :has_imei, image_url = COALESCE(:image_url, image_url), updated_at = now() WHERE id = :id"), {**params, "id": target_product["id"]})
                product_id = target_product["id"]
            elif data.create_missing:
                result["created"] += 1
                if not data.dry_run:
                    product_id = db.execute(text(f"INSERT INTO {qschema}.products (name, sku, description, price, price_mayor_1, price_mayor_2, cost_price, stock, min_stock, is_active, has_imei, is_box, is_combo, is_service, is_discount_active, image_url, updated_at) VALUES (:name, :sku, :description, :price, :price_mayor_1, :price_mayor_2, :cost_price, 0, 5, true, :has_imei, false, false, false, false, :image_url, now()) RETURNING id"), params).scalar()
                else:
                    product_id = -result["created"]
            else:
                result["skipped_missing"] += 1
                continue

            if data.sync_price_lists and product_id:
                for (price_sku, list_name), master_price in master_prices.items():
                    if price_sku != sku:
                        continue
                    target_list = target["list_by_name"].get(list_name)
                    if not target_list:
                        continue
                    result["prices_upserted"] += 1
                    if data.dry_run:
                        continue
                    exists = db.execute(text(f"SELECT id FROM {qschema}.product_prices WHERE product_id = :product_id AND price_list_id = :price_list_id LIMIT 1"), {"product_id": product_id, "price_list_id": target_list["id"]}).scalar()
                    price_params = {"product_id": product_id, "price_list_id": target_list["id"], "price": _money(master_price.get("price"))}
                    if exists:
                        db.execute(text(f"UPDATE {qschema}.product_prices SET price = :price WHERE id = :id"), {"price": price_params["price"], "id": exists})
                    else:
                        db.execute(text(f"INSERT INTO {qschema}.product_prices (product_id, price_list_id, price) VALUES (:product_id, :price_list_id, :price)"), price_params)

        results.append(result)

    if data.dry_run:
        db.rollback()
    else:
        db.commit()

    return {"ok": True, "dry_run": data.dry_run, "master": {"tenant_id": master_tenant.id, "tenant_name": master_tenant.name, "schema_name": master_tenant.schema_name}, "results": results, "message": "Simulacion completada" if data.dry_run else "Catalogo sincronizado"}


# ══════════════════════════════════════════════════════════════════════════════
# CHAT ORGANIZACIONAL
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/{org_id}/chat/unread-count", dependencies=[Depends(require_permission("org.chat.use"))])
def get_org_chat_unread_count(
    org_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    org = db.query(Organization).options(joinedload(Organization.members)).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organizacion no encontrada")
    _assert_org_access(org, current_user)

    read = _org_chat_read_state(db, org_id, current_user)
    email = (current_user.email or "").lower().strip()
    count = db.query(OrganizationChatMessage).filter(
        OrganizationChatMessage.organization_id == org_id,
        OrganizationChatMessage.id > int(read.last_read_message_id or 0),
        OrganizationChatMessage.sender_email != email,
    ).count()
    return {"count": count, "last_read_message_id": int(read.last_read_message_id or 0)}


@router.post("/{org_id}/chat/mark-read", dependencies=[Depends(require_permission("org.chat.use"))])
def mark_org_chat_read(
    org_id: int,
    message_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    org = db.query(Organization).options(joinedload(Organization.members)).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organizacion no encontrada")
    _assert_org_access(org, current_user)
    read = _mark_org_chat_read(db, org_id, current_user, message_id)
    db.commit()
    return {"ok": True, "last_read_message_id": int(read.last_read_message_id or 0)}


@router.get("/{org_id}/chat/messages", response_model=List[OrganizationChatMessageOut], dependencies=[Depends(require_permission("org.chat.use"))])
def list_org_chat_messages(
    org_id: int,
    limit: int = Query(80, ge=1, le=200),
    before_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    org = db.query(Organization).options(joinedload(Organization.members)).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organizacion no encontrada")
    _assert_org_access(org, current_user)

    q = db.query(OrganizationChatMessage).options(
        joinedload(OrganizationChatMessage.attachments),
        joinedload(OrganizationChatMessage.tenant),
    ).filter(OrganizationChatMessage.organization_id == org_id)
    if before_id:
        q = q.filter(OrganizationChatMessage.id < before_id)
    rows = q.order_by(OrganizationChatMessage.id.desc()).limit(limit).all()
    rows.reverse()
    if rows:
        _mark_org_chat_read(db, org_id, current_user, rows[-1].id)
        db.commit()
    return [_decorate_org_chat_message(row) for row in rows]


@router.post("/{org_id}/chat/messages", response_model=OrganizationChatMessageOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_permission("org.chat.use"))])
async def send_org_chat_message(
    org_id: int,
    message: str = Form(""),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    org = db.query(Organization).options(joinedload(Organization.members)).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organizacion no encontrada")
    _assert_org_access(org, current_user)

    clean_message = (message or "").strip()
    if not clean_message and not file:
        raise HTTPException(status_code=400, detail="Escribe un mensaje o adjunta un archivo")

    current_tenant = _current_tenant_for_user(db, current_user)
    if current_tenant and current_tenant.organization_id != org_id:
        current_tenant = None

    chat_message = OrganizationChatMessage(
        organization_id=org_id,
        sender_email=(current_user.email or "").lower().strip(),
        sender_name=current_user.username,
        tenant_id=current_tenant.id if current_tenant else None,
        message=clean_message,
    )
    db.add(chat_message)
    db.flush()

    if file:
        stored_url, size = _save_org_chat_upload(file, org_id)
        attachment = OrganizationChatAttachment(
            organization_id=org_id,
            message_id=chat_message.id,
            original_filename=file.filename or "archivo",
            stored_url=stored_url,
            content_type=file.content_type,
            file_size=size,
        )
        db.add(attachment)
        db.flush()

    _mark_org_chat_read(db, org_id, current_user, chat_message.id)
    db.commit()
    db.refresh(chat_message)
    chat_message = db.query(OrganizationChatMessage).options(
        joinedload(OrganizationChatMessage.attachments),
        joinedload(OrganizationChatMessage.tenant),
    ).filter(OrganizationChatMessage.id == chat_message.id).first()

    payload = _org_chat_message_payload(chat_message)
    try:
        from ..websocket.manager import manager
        from ..websocket.events import WebSocketEvents
        await manager.broadcast(WebSocketEvents.ORG_CHAT_MESSAGE_CREATED, payload, tenant_id=f"org:{org_id}")
        # Fallback: tambien enviamos a cada empresa del grupo por si hay usuarios dentro del sistema operativo.
        tenants = db.query(Tenant).filter(Tenant.organization_id == org_id, Tenant.is_active == True).all()
        for tenant in tenants:
            await manager.broadcast(WebSocketEvents.ORG_CHAT_MESSAGE_CREATED, payload, tenant_id=tenant.schema_name)
    except Exception:
        pass

    return _decorate_org_chat_message(chat_message)


# ══════════════════════════════════════════════════════════════════════════════
# DASHBOARD CONSOLIDADO
# ══════════════════════════════════════════════════════════════════════════════

# ══════════════════════════════════════════════════════════════════════════════
# CONFIGURACIÓN DE PLAN — Sprint 6
# ══════════════════════════════════════════════════════════════════════════════

@router.patch("/{org_id}/plan", response_model=OrganizationOut, dependencies=[Depends(require_permission("org.tenants.manage"))])
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

@router.patch("/{org_id}/whatsapp", response_model=OrganizationOut, dependencies=[Depends(require_permission("org.tenants.manage"))])
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

    _assert_org_owner(org, current_user, "Solo el owner puede configurar WhatsApp compartido")

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

@router.get("/{org_id}/plan-info", dependencies=[Depends(require_permission("org.panel.view"))])
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


@router.get("/{org_id}/consolidated", response_model=ConsolidatedSummary, dependencies=[Depends(require_permission("org.panel.view"))])
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
