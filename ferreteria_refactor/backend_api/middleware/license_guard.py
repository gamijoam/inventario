"""
License Guard Middleware
Valida la licencia JWT en cada petición al backend.
Bloquea todas las peticiones si la licencia es inválida o ha expirado.
"""

from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from jose import jwt, JWTError
from pathlib import Path
import uuid
import os
from datetime import datetime


# Clave pública RSA (debe coincidir con la generada por license_generator.py)
# IMPORTANTE: Esta clave se embebe en el código y se distribuye con la aplicación
PUBLIC_KEY = """-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyYt76Z03n6C05tQ/0R
4+ShIUyyVuPiDiBTuWyX585HWa8C6xzeQV/0A88l0GmTyUPDZDg/LC/efvPKh57f
qGpDZKELyDFuWE60d16E5xPjXN4un23+Of7Vrwb4ZCG5guwS3aaVSg7XntnWNH16
a+7jA9G9XHVSgCgwpuMqHPT43cT42IAZm6Q5xr6fku0EmWplOGb+8Dj3jpzvsgQ5
7QIDAQAB
-----END PUBLIC KEY-----"""

# Ruta del archivo de licencia
# Ruta del archivo de licencia
# license_guard.py -> middleware -> backend_api -> ferreteria_refactor -> ferreteria -> license.key
LICENSE_FILE = Path(__file__).parent.parent.parent.parent / "license.key"

# Rutas que NO requieren licencia válida
WHITELIST_PATHS = [
    "/docs",
    "/openapi.json",
    "/redoc",
    "/api/v1/license/activate",
    "/api/v1/license/status",
    "/api/v1/license/machine-id",
    "/assets",
    "/",
    "/api/v1/ws",
]


def get_machine_id():
    """Obtiene el ID de hardware de la máquina actual."""
    return str(uuid.getnode())


def validate_license():
    """
    Valida la licencia JWT.
    
    Returns:
        dict: Payload del token si es válido
        
    Raises:
        HTTPException: Si la licencia es inválida
    """
    # Verificar modo de licencia
    license_mode = os.getenv("LICENSE_MODE", "OFFLINE").upper()
    token = None

    # Prioridad 1: Variable de Entorno Directa (SaaS/Docker)
    env_license_key = os.getenv("LICENSE_KEY")
    if env_license_key:
        token = env_license_key
    elif license_mode == "CLOUD":
        # En modo Cloud, intentamos leer la licencia de la variable de entorno
        token = os.getenv("CLOUD_LICENSE_KEY")
        if not token:
             # Fallback: intentar leer archivo si no hay variable environment
             if LICENSE_FILE.exists():
                try:
                    with open(LICENSE_FILE, 'r') as f:
                        token = f.read().strip()
                except Exception:
                    pass
        
        if not token:
            raise HTTPException(
                status_code=402,
                detail={
                    "error": "NO_CLOUD_LICENSE",
                    "message": "No se encontró configuración de licencia Cloud (CLOUD_LICENSE_KEY).",
                    "machine_id": "CLOUD-INSTANCE"
                }
            )

    else:
        # Modo Offline: Requiere archivo físico
        if not LICENSE_FILE.exists():
            raise HTTPException(
                status_code=402,
                detail={
                    "error": "NO_LICENSE",
                    "message": "No se encontró archivo de licencia. Por favor, active una licencia válida.",
                    "machine_id": get_machine_id()
                }
            )
        
        # Leer el token del archivo
        try:
            with open(LICENSE_FILE, 'r') as f:
                token = f.read().strip()
        except Exception as e:
            raise HTTPException(
                status_code=402,
                detail={
                    "error": "LICENSE_READ_ERROR",
                    "message": f"Error al leer el archivo de licencia: {str(e)}"
                }
            )
    
    # Validar el token JWT
    try:
        payload = jwt.decode(
            token,
            PUBLIC_KEY,
            algorithms=["RS256"]
        )
    except JWTError as e:
        raise HTTPException(
            status_code=402,
            detail={
                "error": "INVALID_LICENSE",
                "message": f"Licencia inválida: {str(e)}"
            }
        )
    
    # Verificar expiración
    exp_timestamp = payload.get("exp")
    if exp_timestamp:
        exp_date = datetime.fromtimestamp(exp_timestamp)
        if datetime.utcnow() > exp_date:
            raise HTTPException(
                status_code=402,
                detail={
                    "error": "LICENSE_EXPIRED",
                    "message": f"La licencia expiró el {exp_date.strftime('%Y-%m-%d %H:%M:%S')}",
                    "expired_date": exp_date.isoformat()
                }
            )
    
    # Lógica Híbrida: CLOUD vs OFFLINE
    license_mode = os.getenv("LICENSE_MODE", "OFFLINE").upper()
    license_type = payload.get("type", "FULL")

    if license_mode == "CLOUD":
        # Validación Modo Cloud (SaaS)
        # En modo cloud, validamos que la licencia autorice este dominio/instancia
        allowed_domain = payload.get("domain")
        current_domain = os.getenv("VIRTUAL_HOST", "unknown")
        
        # Si la licencia tiene restricción de dominio, validarla
        if allowed_domain and allowed_domain not in current_domain:
             raise HTTPException(
                status_code=402,
                detail={
                    "error": "DOMAIN_MISMATCH",
                    "message": "Esta licencia no es válida para este dominio.",
                    "expected_domain": allowed_domain,
                    "current_domain": current_domain
                }
            )
            
    else:
        # Validación Modo Offline (Hardware ID)
        if license_type == "FULL":
            license_hw_id = payload.get("hw_id")
            current_hw_id = get_machine_id()
            
            if license_hw_id and license_hw_id != current_hw_id:
                raise HTTPException(
                    status_code=402,
                    detail={
                        "error": "HARDWARE_MISMATCH",
                        "message": "Esta licencia no es válida para este equipo.",
                        "expected_hw_id": license_hw_id,
                        "current_hw_id": current_hw_id
                    }
                )
    
    return payload


class LicenseGuardMiddleware(BaseHTTPMiddleware):
    """
    Middleware que valida la licencia en cada petición.
    """
    
    async def dispatch(self, request: Request, call_next):
        # Verificar si la ruta está en la whitelist
        path = request.url.path
        
        # Permitir rutas whitelisted
        if any(path.startswith(whitelist_path) for whitelist_path in WHITELIST_PATHS):
            return await call_next(request)
        
        # Validar licencia para todas las demás rutas
        try:
            validate_license()
        except HTTPException as e:
            return JSONResponse(
                status_code=e.status_code,
                content=e.detail
            )
        
        # Si la licencia es válida, continuar con la petición
        response = await call_next(request)
        return response
