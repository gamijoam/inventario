"""
System Router
Endpoints para gestión de licencias y información del sistema.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from pathlib import Path
from jose import jwt, JWTError
from datetime import datetime
import uuid
from typing import List, Optional, Dict, Any


router = APIRouter(
    tags=["system"]
)

# Importar la clave pública del middleware
from ..middleware.license_guard import PUBLIC_KEY, LICENSE_FILE, get_machine_id


class LicenseActivationRequest(BaseModel):
    """Request para activar una licencia."""
    license_key: str


class LicenseStatusResponse(BaseModel):
    """Response con el estado de la licencia."""
    active: bool
    client_name: str = None
    license_type: str = None
    expires_at: str = None
    days_remaining: int = None
    hardware_locked: bool = False
    error: str = None


@router.get("/license/machine-id")
def get_machine_hardware_id():
    """
    Obtiene el ID de hardware de la máquina actual.
    El cliente debe proporcionar este ID al admin para obtener una licencia FULL.
    """
    machine_id = get_machine_id()
    return {
        "machine_id": machine_id,
        "message": "Proporcione este ID al administrador para obtener su licencia."
    }


@router.get("/license/status", response_model=LicenseStatusResponse)
def get_license_status():
    """
    Obtiene el estado actual de la licencia.
    """
    # Verificar si existe el archivo
    if not LICENSE_FILE.exists():
        return LicenseStatusResponse(
            active=False,
            error="No se encontró archivo de licencia"
        )
    
    # Leer y validar el token
    try:
        with open(LICENSE_FILE, 'r') as f:
            token = f.read().strip()
        
        payload = jwt.decode(token, PUBLIC_KEY, algorithms=["RS256"])
        
        # Calcular días restantes
        exp_timestamp = payload.get("exp")
        days_remaining = None
        expires_at = None
        
        if exp_timestamp:
            exp_date = datetime.fromtimestamp(exp_timestamp)
            expires_at = exp_date.isoformat()
            time_remaining = exp_date - datetime.utcnow()
            days_remaining = max(0, time_remaining.days)
            
            # Verificar si expiró
            if time_remaining.total_seconds() <= 0:
                return LicenseStatusResponse(
                    active=False,
                    client_name=payload.get("sub"),
                    license_type=payload.get("type"),
                    expires_at=expires_at,
                    days_remaining=0,
                    error="Licencia expirada"
                )
        
        return LicenseStatusResponse(
            active=True,
            client_name=payload.get("sub"),
            license_type=payload.get("type"),
            expires_at=expires_at,
            days_remaining=days_remaining,
            hardware_locked=payload.get("type") == "FULL" and "hw_id" in payload
        )
        
    except JWTError as e:
        return LicenseStatusResponse(
            active=False,
            error=f"Licencia inválida: {str(e)}"
        )
    except Exception as e:
        return LicenseStatusResponse(
            active=False,
            error=f"Error al leer licencia: {str(e)}"
        )


@router.post("/license/activate")
def activate_license(request: LicenseActivationRequest):
    """
    Activa una nueva licencia.
    Valida el token JWT y lo guarda en el archivo license.key.
    """
    token = request.license_key.strip()
    
    # Validar el token
    try:
        payload = jwt.decode(token, PUBLIC_KEY, algorithms=["RS256"])
    except JWTError as e:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "INVALID_TOKEN",
                "message": f"Token JWT inválido: {str(e)}"
            }
        )
    
    # Verificar expiración
    exp_timestamp = payload.get("exp")
    if exp_timestamp:
        exp_date = datetime.fromtimestamp(exp_timestamp)
        if datetime.utcnow() > exp_date:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "EXPIRED_TOKEN",
                    "message": f"Esta licencia expiró el {exp_date.strftime('%Y-%m-%d %H:%M:%S')}"
                }
            )
    
    # Verificar hardware ID (solo para FULL)
    license_type = payload.get("type", "FULL")
    if license_type == "FULL":
        license_hw_id = payload.get("hw_id")
        current_hw_id = get_machine_id()
        
        if license_hw_id and license_hw_id != current_hw_id:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "HARDWARE_MISMATCH",
                    "message": "Esta licencia no es válida para este equipo.",
                    "expected_hw_id": license_hw_id,
                    "current_hw_id": current_hw_id,
                    "hint": "Solicite una licencia con el Machine ID correcto."
                }
            )
    
    # Guardar la licencia
    try:
        LICENSE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(LICENSE_FILE, 'w') as f:
            f.write(token)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "SAVE_ERROR",
                "message": f"Error al guardar la licencia: {str(e)}"
            }
        )
    
    # Calcular días restantes
    days_remaining = None
    if exp_timestamp:
        exp_date = datetime.fromtimestamp(exp_timestamp)
        time_remaining = exp_date - datetime.utcnow()
        days_remaining = max(0, time_remaining.days)
    
    return {
        "success": True,
        "message": "Licencia activada exitosamente",
        "client_name": payload.get("sub"),
        "license_type": license_type,
        "expires_at": datetime.fromtimestamp(exp_timestamp).isoformat() if exp_timestamp else None,
        "days_remaining": days_remaining,
        "hardware_locked": license_type == "FULL" and "hw_id" in payload
    }


# --- System Messages (Public/Auth) ---

from ..models.system_messages import SystemMessage, MessageLevel
from ..schemas.system_messages import SystemMessageCreate, SystemMessageUpdate, SystemMessageResponse
from typing import List
from sqlalchemy import or_, desc, case, cast, String
from ..database.db import get_db
from sqlalchemy.orm import Session
from fastapi import Depends
from ..utils.time_utils import get_venezuela_now
from ..tenant_context import get_tenant_schema
from ..dependencies import has_role
from ..models.models import User, UserRole

@router.get("/system/messages/active", response_model=List[SystemMessageResponse])
def get_active_system_messages(
    db: Session = Depends(get_db)
):
    """
    Get all currently ACTIVE system messages for the global banner.
    Path: /api/v1/system/messages/active
    Filter: is_active=True AND starts_at <= Now AND (expires_at > Now OR expires_at is None)
    """
    now = get_venezuela_now()
    
    # Sort Priority: Critical > Warning > Info
    priority_case = case(
        (SystemMessage.level == MessageLevel.CRITICAL, 1),
        (SystemMessage.level == MessageLevel.WARNING, 2),
        (SystemMessage.level == MessageLevel.INFO, 3),
        else_=4
    )

    current_schema = get_tenant_schema() or "public"
    scope_filter = SystemMessage.target_tenant_schema == None
    if current_schema != "public":
        scope_filter = or_(scope_filter, SystemMessage.target_tenant_schema == current_schema)

    messages = db.query(SystemMessage).filter(
        SystemMessage.is_active == True,
        scope_filter,
        or_(
            SystemMessage.starts_at <= now,
            SystemMessage.starts_at == None
        ),
        or_(
            SystemMessage.expires_at > now,
            SystemMessage.expires_at == None
        )
    ).order_by(priority_case, SystemMessage.starts_at.desc()).all()
    
    return messages


def _tenant_message_to_dict(message: SystemMessage) -> Dict[str, Any]:
    return {
        "id": message.id,
        "title": message.title,
        "content": message.content,
        "level": message.level.value if hasattr(message.level, "value") else message.level,
        "message_type": message.message_type or "banner",
        "version_tag": message.version_tag,
        "target_tenant_schema": message.target_tenant_schema,
        "starts_at": message.starts_at.isoformat() if message.starts_at else None,
        "expires_at": message.expires_at.isoformat() if message.expires_at else None,
        "is_active": message.is_active,
    }


def _is_message_visible_now(message: SystemMessage) -> bool:
    now = get_venezuela_now()
    return bool(
        message.is_active
        and (message.starts_at is None or message.starts_at <= now)
        and (message.expires_at is None or message.expires_at > now)
    )


def _queue_tenant_notification(background_tasks: BackgroundTasks, tenant_schema: str, message: Dict[str, Any]) -> None:
    from ..services.websocket_manager import manager
    background_tasks.add_task(manager.broadcast_to_tenant, message, tenant_schema)


def _queue_tenant_messages_refresh(background_tasks: BackgroundTasks, tenant_schema: str, action: str, message_id: Optional[int]) -> None:
    from ..websocket.events import WebSocketEvents
    _queue_tenant_notification(background_tasks, tenant_schema, {
        "type": WebSocketEvents.SYSTEM_NOTIFICATION,
        "data": {"refresh": True, "action": action, "id": message_id},
        "timestamp": datetime.now().isoformat(),
    })


def _require_tenant_schema() -> str:
    tenant_schema = (get_tenant_schema() or "public").strip().lower()
    if tenant_schema == "public":
        raise HTTPException(status_code=400, detail="No hay empresa activa para gestionar avisos internos")
    return tenant_schema


@router.get("/system/messages/internal", response_model=List[SystemMessageResponse])
def list_internal_system_messages(
    db: Session = Depends(get_db),
    current_user: User = Depends(has_role([UserRole.ADMIN]))
):
    tenant_schema = _require_tenant_schema()
    return db.query(SystemMessage).filter(
        SystemMessage.target_tenant_schema == tenant_schema
    ).order_by(SystemMessage.created_at.desc()).limit(100).all()


@router.post("/system/messages/internal", response_model=SystemMessageResponse)
def create_internal_system_message(
    message: SystemMessageCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(has_role([UserRole.ADMIN]))
):
    tenant_schema = _require_tenant_schema()
    payload = message.model_dump()
    payload["target_tenant_schema"] = tenant_schema
    payload["created_by_user_id"] = current_user.id
    db_message = SystemMessage(**payload)
    db.add(db_message)
    db.commit()
    db.refresh(db_message)

    from ..websocket.events import WebSocketEvents
    if _is_message_visible_now(db_message):
        _queue_tenant_notification(background_tasks, tenant_schema, {
            "type": WebSocketEvents.SYSTEM_NOTIFICATION,
            "data": _tenant_message_to_dict(db_message),
            "timestamp": datetime.now().isoformat(),
        })
    else:
        _queue_tenant_messages_refresh(background_tasks, tenant_schema, "scheduled", db_message.id)
    return db_message


@router.put("/system/messages/internal/{message_id}", response_model=SystemMessageResponse)
def update_internal_system_message(
    message_id: int,
    message_update: SystemMessageUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(has_role([UserRole.ADMIN]))
):
    tenant_schema = _require_tenant_schema()
    db_message = db.query(SystemMessage).filter(
        SystemMessage.id == message_id,
        SystemMessage.target_tenant_schema == tenant_schema
    ).first()
    if not db_message:
        raise HTTPException(status_code=404, detail="Aviso interno no encontrado")

    update_data = message_update.model_dump(exclude_unset=True)
    update_data.pop("target_tenant_schema", None)
    for key, value in update_data.items():
        setattr(db_message, key, value)
    db.commit()
    db.refresh(db_message)
    _queue_tenant_messages_refresh(background_tasks, tenant_schema, "updated", db_message.id)
    return db_message


@router.delete("/system/messages/internal/{message_id}")
def delete_internal_system_message(
    message_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(has_role([UserRole.ADMIN]))
):
    tenant_schema = _require_tenant_schema()
    db_message = db.query(SystemMessage).filter(
        SystemMessage.id == message_id,
        SystemMessage.target_tenant_schema == tenant_schema
    ).first()
    if not db_message:
        raise HTTPException(status_code=404, detail="Aviso interno no encontrado")

    db_message.is_active = False
    db.commit()
    _queue_tenant_messages_refresh(background_tasks, tenant_schema, "deleted", db_message.id)
    return {"status": "success", "message": "Aviso interno desactivado"}

# --- Global Search ---

class SearchResult(BaseModel):
    id: Any
    title: str
    subtitle: Optional[str] = None
    type: str  # 'product', 'customer', 'sale', 'quote', 'service_order', 'nav'
    url: str
    metadata: Optional[Dict[str, Any]] = None

@router.get("/system/search", response_model=Dict[str, List[SearchResult]])
def global_search(
    q: str,
    db: Session = Depends(get_db)
):
    """
    Search across multiple entities and provide navigation suggestions.
    """
    if not q or len(q) < 2:
        return {
            "products": [],
            "customers": [],
            "sales": [],
            "quotes": [],
            "service_orders": [],
            "navigation": []
        }

    search_term = f"%{q}%"
    results = {
        "products": [],
        "customers": [],
        "sales": [],
        "quotes": [],
        "service_orders": [],
        "navigation": []
    }

    # 1. Products
    from ..models.models import Product
    products = db.query(Product).filter(
        Product.is_active == True,
        or_(
            Product.name.ilike(search_term),
            Product.sku.ilike(search_term)
        )
    ).limit(5).all()
    results["products"] = [
        SearchResult(
            id=p.id,
            title=p.name,
            subtitle=f"SKU: {p.sku} | Precio: ${p.price}",
            type="product",
            url=f"/inventory",
            metadata={"sku": p.sku}
        ) for p in products
    ]

    # 2. Customers
    from ..models.models import Customer
    customers = db.query(Customer).filter(
        Customer.is_active == True,
        or_(
            Customer.name.ilike(search_term),
            Customer.identification.ilike(search_term),
            Customer.phone.ilike(search_term)
        )
    ).limit(5).all()
    results["customers"] = [
        SearchResult(
            id=c.id,
            title=c.name,
            subtitle=f"ID: {c.identification} | Tel: {c.phone}",
            type="customer",
            url=f"/customers",
            metadata={"identification": c.identification}
        ) for c in customers
    ]

    # 3. Sales
    from ..models.models import Sale
    sales = db.query(Sale).filter(
        or_(
            Sale.ticket_number.ilike(search_term),
            cast(Sale.id, String).ilike(search_term)
        )
    ).limit(5).all()
    results["sales"] = [
        SearchResult(
            id=s.id,
            title=f"Venta #{s.ticket_number or s.id}",
            subtitle=f"Total: ${s.total_amount} | Fecha: {s.created_at.strftime('%Y-%m-%d') if s.created_at else ''}",
            type="sale",
            url=f"/reports/sales",
            metadata={"ticket": s.ticket_number}
        ) for s in sales
    ]

    # 4. Quotes
    from ..models.models import Quote
    quotes = db.query(Quote).filter(
        or_(
            cast(Quote.id, String).ilike(search_term)
        )
    ).limit(5).all()
    results["quotes"] = [
        SearchResult(
            id=q_item.id,
            title=f"Cotización #{q_item.id}",
            subtitle=f"Total: ${q_item.total_amount}",
            type="quote",
            url=f"/quotes",
            metadata={}
        ) for q_item in quotes
    ]
    
    # 5. Service Orders (if module enabled - simplified check for model existence)
    try:
        from ..models.support import ServiceOrder
        orders = db.query(ServiceOrder).filter(
            or_(
                ServiceOrder.ticket_number.ilike(search_term),
                ServiceOrder.client_name.ilike(search_term)
            )
        ).limit(5).all()
        results["service_orders"] = [
            SearchResult(
                id=o.id,
                title=f"Orden #{o.ticket_number}",
                subtitle=f"Cliente: {o.client_name} | Estado: {o.status}",
                type="service_order",
                url=f"/services",
                metadata={"ticket": o.ticket_number}
            ) for o in orders
        ]
    except (ImportError, Exception):
        pass

    # 6. Navigation / Menu Hits
    nav_options = [
        {"title": "Punto de Venta (Caja)", "keywords": ["venta", "caja", "pos", "facturar"], "url": "/pos"},
        {"title": "Inventario de Productos", "keywords": ["productos", "stock", "inventario", "almacen"], "url": "/inventory"},
        {"title": "Listado de Clientes", "keywords": ["clientes", "directorio", "personas"], "url": "/customers"},
        {"title": "Reportes de Ventas", "keywords": ["reportes", "estadisticas", "ventas", "ganancias"], "url": "/reports/sales"},
        {"title": "Gestión de Cotizaciones", "keywords": ["cotizaciones", "presupuestos"], "url": "/quotes"},
        {"title": "Configuración del Sistema", "keywords": ["configuracion", "ajustes", "tasa"], "url": "/settings"},
    ]
    
    q_lower = q.lower()
    results["navigation"] = [
        SearchResult(
            id=idx,
            title=nav["title"],
            subtitle="Ir a sección",
            type="nav",
            url=nav["url"]
        ) for idx, nav in enumerate(nav_options) if any(k in q_lower for k in nav["keywords"]) or q_lower in nav["title"].lower()
    ]

    return results
