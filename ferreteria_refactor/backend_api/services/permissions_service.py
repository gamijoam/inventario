from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Sequence, Set

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from ..models.models import User
from ..models.tenant import Tenant
from ..tenant_context import get_tenant_schema


@dataclass(frozen=True)
class PermissionSeed:
    code: str
    module: str
    label: str
    risk_level: str = "basic"


PERMISSION_SEEDS: Sequence[PermissionSeed] = (
    PermissionSeed("dashboard.view", "dashboard", "Ver dashboard"),
    PermissionSeed("dashboard.financials.view", "dashboard", "Ver metricas financieras", "sensitive"),
    PermissionSeed("pos.access", "pos", "Entrar al POS"),
    PermissionSeed("pos.sell", "pos", "Facturar ventas", "sensitive"),
    PermissionSeed("pos.discount.apply", "pos", "Aplicar descuentos", "sensitive"),
    PermissionSeed("pos.discount.authorize", "pos", "Autorizar descuentos", "critical"),
    PermissionSeed("pos.price.override", "pos", "Cambiar precio en venta", "critical"),
    PermissionSeed("pos.reprint.ticket", "pos", "Reimprimir ticket", "sensitive"),
    PermissionSeed("pos.reprint.warranty", "pos", "Reimprimir garantia", "sensitive"),
    PermissionSeed("pos.void_sale", "pos", "Anular venta", "critical"),
    PermissionSeed("cash.view", "cash", "Ver caja"),
    PermissionSeed("cash.open", "cash", "Abrir caja", "sensitive"),
    PermissionSeed("cash.close.blind", "cash", "Cerrar caja ciega", "sensitive"),
    PermissionSeed("cash.movements.create", "cash", "Registrar movimientos de caja", "sensitive"),
    PermissionSeed("cash.audit.view", "cash", "Ver arqueo detallado", "critical"),
    PermissionSeed("cash.audit.pdf", "cash", "Generar PDF de arqueo", "sensitive"),
    PermissionSeed("cash.force_close", "cash", "Forzar cierre de caja", "critical"),
    PermissionSeed("inventory.products.view", "inventory", "Ver productos"),
    PermissionSeed("inventory.products.create", "inventory", "Crear productos", "sensitive"),
    PermissionSeed("inventory.products.edit", "inventory", "Editar productos", "sensitive"),
    PermissionSeed("inventory.products.delete", "inventory", "Eliminar productos", "critical"),
    PermissionSeed("inventory.stock.adjust", "inventory", "Ajustar stock", "critical"),
    PermissionSeed("inventory.serials.view", "inventory", "Ver seriales/IMEI"),
    PermissionSeed("inventory.serials.receive", "inventory", "Recibir seriales/IMEI", "sensitive"),
    PermissionSeed("inventory.serials.delete", "inventory", "Eliminar seriales/IMEI", "critical"),
    PermissionSeed("inventory.kardex.view", "inventory", "Ver kardex"),
    PermissionSeed("inventory.categories.manage", "inventory", "Gestionar categorias", "sensitive"),
    PermissionSeed("inventory.warehouses.manage", "inventory", "Gestionar almacenes", "sensitive"),
    PermissionSeed("inventory.transfers.export", "inventory", "Exportar traslados", "sensitive"),
    PermissionSeed("inventory.transfers.import", "inventory", "Importar traslados", "sensitive"),
    PermissionSeed("sales.quotes.view", "sales", "Ver cotizaciones"),
    PermissionSeed("sales.quotes.manage", "sales", "Gestionar cotizaciones", "sensitive"),
    PermissionSeed("sales.customers.manage", "sales", "Gestionar clientes", "sensitive"),
    PermissionSeed("sales.returns.create", "sales", "Procesar devoluciones", "critical"),
    PermissionSeed("sales.returns.exchange", "sales", "Procesar canjes", "critical"),
    PermissionSeed("sales.warranties.view", "sales", "Ver garantias"),
    PermissionSeed("sales.warranties.manage", "sales", "Gestionar garantias", "sensitive"),
    PermissionSeed("sales.credits.view", "sales", "Ver cuentas por cobrar", "sensitive"),
    PermissionSeed("sales.credits.pay", "sales", "Registrar abonos CxC", "critical"),
    PermissionSeed("purchases.view", "purchases", "Ver compras"),
    PermissionSeed("purchases.create", "purchases", "Crear compras", "sensitive"),
    PermissionSeed("purchases.pay", "purchases", "Registrar pagos de compras", "critical"),
    PermissionSeed("purchases.suppliers.manage", "purchases", "Gestionar proveedores", "sensitive"),
    PermissionSeed("reports.view", "reports", "Ver reportes", "sensitive"),
    PermissionSeed("reports.sales.view", "reports", "Ver reportes de ventas", "sensitive"),
    PermissionSeed("reports.profit.view", "reports", "Ver ganancias", "critical"),
    PermissionSeed("reports.inventory.view", "reports", "Ver reportes de inventario", "sensitive"),
    PermissionSeed("reports.commissions.view", "reports", "Ver reportes de comisiones", "sensitive"),
    PermissionSeed("config.business.manage", "config", "Configurar negocio", "critical"),
    PermissionSeed("config.users.manage", "config", "Gestionar usuarios", "critical"),
    PermissionSeed("config.permissions.manage", "config", "Gestionar permisos", "critical"),
    PermissionSeed("config.prices.manage", "config", "Configurar precios", "critical"),
    PermissionSeed("config.payment_methods.manage", "config", "Configurar metodos de pago", "critical"),
    PermissionSeed("config.printing.manage", "config", "Configurar impresion", "critical"),
    PermissionSeed("config.integrations.manage", "config", "Configurar integraciones", "critical"),
    PermissionSeed("support.chat.use", "support", "Usar chat de soporte"),
    PermissionSeed("support.tickets.manage", "support", "Gestionar tickets de soporte", "sensitive"),
    PermissionSeed("org.panel.view", "organization", "Ver panel empresarial", "sensitive"),
    PermissionSeed("org.tenants.manage", "organization", "Gestionar empresas", "critical"),
    PermissionSeed("org.members.manage", "organization", "Gestionar miembros de organizacion", "critical"),
    PermissionSeed("org.chat.use", "organization", "Usar chat de organizacion"),
    PermissionSeed("restaurant.orders.manage", "restaurant", "Gestionar ordenes restaurante", "sensitive"),
    PermissionSeed("restaurant.kitchen.view", "restaurant", "Ver cocina"),
    PermissionSeed("services.orders.manage", "services", "Gestionar servicios tecnicos", "sensitive"),
    PermissionSeed("services.technician.view", "services", "Ver trabajos tecnicos"),
)

ALL_PERMISSION_CODES: Set[str] = {seed.code for seed in PERMISSION_SEEDS}

DEFAULT_ROLE_PERMISSIONS: Dict[str, Set[str]] = {
    "ADMIN": set(ALL_PERMISSION_CODES),
    "CASHIER": {
        "pos.access",
        "pos.sell",
        "pos.reprint.ticket",
        "pos.reprint.warranty",
        "cash.view",
        "cash.open",
        "cash.close.blind",
        "cash.movements.create",
        "sales.customers.manage",
        "sales.quotes.view",
        "sales.credits.pay",
        "support.chat.use",
    },
    "WAREHOUSE": {
        "dashboard.view",
        "inventory.products.view",
        "inventory.products.create",
        "inventory.products.edit",
        "inventory.stock.adjust",
        "inventory.serials.view",
        "inventory.serials.receive",
        "inventory.kardex.view",
        "inventory.categories.manage",
        "inventory.warehouses.manage",
        "inventory.transfers.export",
        "inventory.transfers.import",
        "purchases.view",
        "purchases.create",
        "purchases.suppliers.manage",
        "reports.inventory.view",
        "support.chat.use",
    },
    "WAITER": {
        "pos.access",
        "restaurant.orders.manage",
        "sales.customers.manage",
        "support.chat.use",
    },
    "KITCHEN": {
        "restaurant.kitchen.view",
        "support.chat.use",
    },
}


def normalize_role(role) -> str:
    return getattr(role, "value", role) or "CASHIER"


def fallback_permissions_for_user(user: User) -> Set[str]:
    role = normalize_role(user.role)
    if user.is_superuser:
        return set(ALL_PERMISSION_CODES)
    return set(DEFAULT_ROLE_PERMISSIONS.get(role, set()))


def resolve_tenant_id(db: Session, user: User, explicit_tenant_id: Optional[int] = None) -> Optional[int]:
    if explicit_tenant_id is not None:
        return explicit_tenant_id
    if user.tenant_id:
        return user.tenant_id

    current_schema = get_tenant_schema()
    if not current_schema or current_schema == "public":
        return None

    tenant = db.query(Tenant).filter(Tenant.schema_name == current_schema).first()
    return tenant.id if tenant else None


def permissions_tables_available(db: Session) -> bool:
    result = db.execute(text("SELECT to_regclass('public.permissions') IS NOT NULL")).scalar()
    return bool(result)


def list_permission_catalog(db: Session) -> List[dict]:
    try:
        if permissions_tables_available(db):
            rows = db.execute(text("""
                SELECT code, module, resource, action, label, description, risk_level, sort_order
                FROM public.permissions
                WHERE is_active = TRUE
                ORDER BY sort_order, code
            """)).mappings().all()
            return [dict(row) for row in rows]
    except SQLAlchemyError:
        db.rollback()

    return [
        {
            "code": seed.code,
            "module": seed.module,
            "resource": seed.code.split(".")[1] if "." in seed.code else seed.module,
            "action": seed.code.split(".")[-1],
            "label": seed.label,
            "description": None,
            "risk_level": seed.risk_level,
            "sort_order": index,
        }
        for index, seed in enumerate(PERMISSION_SEEDS, start=1)
    ]


def build_permission_tree(catalog: Iterable[dict]) -> List[dict]:
    grouped: Dict[str, List[dict]] = defaultdict(list)
    for permission in catalog:
        grouped[permission["module"]].append(permission)

    tree = []
    for module, permissions in sorted(grouped.items()):
        tree.append({
            "module": module,
            "label": module.replace("_", " ").title(),
            "permissions": sorted(permissions, key=lambda item: (item.get("sort_order") or 0, item["code"])),
        })
    return tree


def get_user_permissions(db: Session, user: User, tenant_id: Optional[int] = None) -> Set[str]:
    fallback = fallback_permissions_for_user(user)

    try:
        if not permissions_tables_available(db):
            return fallback

        resolved_tenant_id = resolve_tenant_id(db, user, tenant_id)

        if user.is_superuser and resolved_tenant_id is None:
            rows = db.execute(text("SELECT code FROM public.permissions WHERE is_active = TRUE")).scalars().all()
            return set(rows)

        if resolved_tenant_id is None:
            return fallback

        rows = db.execute(text("""
            SELECT DISTINCT rpp.permission_code
            FROM public.user_role_profiles urp
            JOIN public.role_profile_permissions rpp
              ON rpp.role_profile_id = urp.role_profile_id
             AND rpp.allowed = TRUE
            JOIN public.permissions p
              ON p.code = rpp.permission_code
             AND p.is_active = TRUE
            WHERE urp.user_id = :user_id
              AND urp.tenant_id = :tenant_id
        """), {"user_id": user.id, "tenant_id": resolved_tenant_id}).scalars().all()

        permissions = set(rows) if rows else set(fallback)

        overrides = db.execute(text("""
            SELECT permission_code, effect
            FROM public.user_permission_overrides
            WHERE user_id = :user_id
              AND tenant_id = :tenant_id
        """), {"user_id": user.id, "tenant_id": resolved_tenant_id}).mappings().all()

        for override in overrides:
            if override["effect"] == "allow":
                permissions.add(override["permission_code"])
            elif override["effect"] == "deny":
                permissions.discard(override["permission_code"])

        return permissions
    except SQLAlchemyError:
        db.rollback()
        return fallback


def user_has_permission(db: Session, user: User, permission_code: str, tenant_id: Optional[int] = None) -> bool:
    return permission_code in get_user_permissions(db, user, tenant_id)


def user_has_any_permission(db: Session, user: User, permission_codes: Sequence[str], tenant_id: Optional[int] = None) -> bool:
    permissions = get_user_permissions(db, user, tenant_id)
    return any(code in permissions for code in permission_codes)


def user_has_all_permissions(db: Session, user: User, permission_codes: Sequence[str], tenant_id: Optional[int] = None) -> bool:
    permissions = get_user_permissions(db, user, tenant_id)
    return all(code in permissions for code in permission_codes)

