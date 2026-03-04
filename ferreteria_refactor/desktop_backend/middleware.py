"""
desktop_backend/middleware.py

DesktopTenantMiddleware: reemplaza al TenantMiddleware del SaaS.
En el desktop siempre hay un solo tenant ('desktop_local'),
no hay subdomains ni headers dinámicos que resolver.
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from .config import DESKTOP_SCHEMA

# Importar las funciones del contexto compartido
from backend_api.tenant_context import set_tenant_schema


class DesktopTenantMiddleware(BaseHTTPMiddleware):
    """
    Middleware que inyecta siempre el schema 'desktop_local'.
    Reemplaza completamente el TenantMiddleware del SaaS.
    """

    async def dispatch(self, request: Request, call_next):
        # Siempre fijar el schema al del desktop — sin leer headers ni subdomain
        set_tenant_schema(DESKTOP_SCHEMA)
        request.state.tenant_schema = DESKTOP_SCHEMA
        request.state.tenant_id = DESKTOP_SCHEMA

        response = await call_next(request)
        return response
