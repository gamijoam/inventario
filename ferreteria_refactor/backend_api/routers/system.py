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


router = APIRouter(
    prefix="/license",
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


@router.get("/machine-id")
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


@router.get("/status", response_model=LicenseStatusResponse)
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


@router.post("/activate")
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
