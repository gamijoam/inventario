"""
System Router
Endpoints para gestión de licencias y información del sistema.
"""

from fastapi import APIRouter, HTTPException
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
from ..schemas.system_messages import SystemMessageResponse
from typing import List
from sqlalchemy import or_, desc, case, cast, String
from ..database.db import get_db
from sqlalchemy.orm import Session
from fastapi import Depends
from ..utils.time_utils import get_venezuela_now

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

    messages = db.query(SystemMessage).filter(
        SystemMessage.is_active == True,
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
