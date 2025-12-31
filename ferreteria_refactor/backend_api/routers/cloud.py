from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl
import httpx
from typing import Optional

router = APIRouter(prefix="/cloud", tags=["cloud"])

class CloudURLTest(BaseModel):
    url: str
class CloudURLTestResponse(BaseModel):
    success: bool
    error: Optional[str] = None
    cleaned_url: Optional[str] = None

class ConnectionTestRequest(BaseModel):
    url: str

class SetupCloudRequest(BaseModel):
    cloud_url: str

@router.post("/test-connection")
async def test_connection_proxy(request: ConnectionTestRequest):
    """
    Test connection to cloud server from BACKEND to avoid CORS.
    Checks if /api/v1/health is reachable.
    """
    raw_url = request.url.strip()
    
    # 1. Cleaning URL logic (same as frontend)
    clean_url = raw_url
    if clean_url.endswith("/"):
        clean_url = clean_url[:-1]
    
    # Remove common paths if user included them
    paths_to_remove = ["/login", "/api", "/api/v1"]
    for path in paths_to_remove:
        if clean_url.endswith(path):
            clean_url = clean_url[:-len(path)]
            
    # Ensure protocol
    if not clean_url.startswith("http"):
        clean_url = "https://" + clean_url

    target_health_url = f"{clean_url}/api/v1/health"
    
    print(f"[CLOUD TEST] Testing connection to: {target_health_url}")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(target_health_url)
            
            if response.status_code == 200:
                return {
                    "success": True, 
                    "message": "Conexión exitosa",
                    "cleaned_url": clean_url
                }
            else:
                return {
                    "success": False, 
                    "error": f"El servidor respondió con código {response.status_code}",
                    "cleaned_url": clean_url
                }
                
    except httpx.ConnectError:
        return {"success": False, "error": "No se pudo conectar al servidor (Connection Refused)"}
    except httpx.ConnectTimeout:
        return {"success": False, "error": "Tiempo de espera agotado (Timeout)"}
    except Exception as e:
        print(f"[Cloud Test] ✗ Error: {e}")
        return CloudURLTestResponse(
            success=False,
            error=f"Error al conectar: {str(e)}"
        )
