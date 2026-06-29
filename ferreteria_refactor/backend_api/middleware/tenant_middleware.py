from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.types import ASGIApp
from starlette.responses import JSONResponse
import re
import time
from ..tenant_context import set_tenant_schema
from ..config import settings

class TenantMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp):
        super().__init__(app)
        # Regex to validate safe schema names (alphanumeric + underscore + dash)
        # Prevents SQL Injection via Host header
        self.schema_validator = re.compile(r'^[a-z0-9_-]+$')
        self._tenant_cache = {}
        self._tenant_cache_ttl = 60

    async def dispatch(self, request: Request, call_next):

        # Single-tenant mode: skip all detection, use fixed schema
        if settings.SINGLE_TENANT:
            tenant_slug = settings.SINGLE_TENANT_SCHEMA
            set_tenant_schema(tenant_slug)
            request.state.tenant_schema = tenant_slug
            response = await call_next(request)
            return response

        # 1. Determine Host
        # Priority: X-Forwarded-Host (from Traefik/Nginx) -> Host Header
        host = request.headers.get("x-forwarded-host", request.headers.get("host", "")).split(":")[0]


        # 2. Extract Tenant Slug
        tenant_slug = None

        # PRIORITY 1: Explicit Header (e.g. from axios interceptor or internal services)
        if "x-tenant-id" in request.headers:
            candidate = request.headers.get("x-tenant-id")
            if self.is_safe_schema(candidate):
                tenant_slug = candidate
        
        # PRIORITY 2: Subdomain extraction (fallback if no header)
        if not tenant_slug and self.is_valid_domain(host):
            # Example: client1.miapp.com -> client1
            # Example: ferreteria.localhost -> ferreteria
            parts = host.split('.')
            if len(parts) >= 3: # Needs at least subdomain.domain.com
                subdomain = parts[0]
                reserved = ["www", "api", "app", "dashboard", "admin", "saas", "backoffice"]
                if subdomain not in reserved and \
                   not subdomain.startswith("admin-") and \
                   not subdomain.startswith("api-"):
                    tenant_slug = subdomain
            elif len(parts) == 2 and parts[1] == "localhost": # Special case for localhost
                subdomain = parts[0]
                reserved = ["www", "api", "app", "dashboard", "admin", "saas", "backoffice"]
                if subdomain not in reserved and not subdomain.startswith("admin-") and not subdomain.startswith("api-"):
                     tenant_slug = subdomain
                    
        # Default to public if nothing found
        if not tenant_slug:
            tenant_slug = "public"
        
        # 3. Set Context
        # Ensure it's safe (lowercase, sanitary)
        if not self.is_safe_schema(tenant_slug):
            tenant_slug = "public"

        tenant_slug = tenant_slug.strip().lower()
        if tenant_slug != "public":
            status_info = self.get_tenant_status(tenant_slug)
            if status_info == "missing":
                return JSONResponse({"detail": "Empresa no encontrada"}, status_code=404)
            if status_info == "inactive":
                return JSONResponse({"detail": "Empresa suspendida o inactiva"}, status_code=403)
            if status_info == "error":
                return JSONResponse({"detail": "No se pudo validar la empresa"}, status_code=503)
            
        set_tenant_schema(tenant_slug)
        
        # Optional: Inject into State for easy access in endpoints
        request.state.tenant_schema = tenant_slug
        
        # 4. Proceed
        response = await call_next(request)
        return response

    def is_valid_domain(self, host: str) -> bool:
        """Check if looking at a real domain (not localhost/ip)"""
        if not host: return False
        
        # Allow localhost subdomains for local multi-tenant development
        # Example: prueba9.localhost, demo.localhost
        if ".localhost" in host and host != "localhost":
            return True
            
        # Block plain localhost (no subdomain)
        if host == "localhost" or host.startswith("localhost:"):
            return False
            
        if host.replace('.', '').isnumeric(): return False # IP Check
        return True

    def is_safe_schema(self, schema_name: str) -> bool:
        if not schema_name: return False
        return bool(self.schema_validator.match(schema_name))


    def get_tenant_status(self, schema_name: str) -> str:
        if schema_name == "public":
            return "active"

        now = time.time()
        cached = self._tenant_cache.get(schema_name)
        if cached and now - cached[0] < self._tenant_cache_ttl:
            return cached[1]

        try:
            from sqlalchemy import text
            from ..database.db import SessionLocal
            db = SessionLocal()
            try:
                row = db.execute(
                    text("SELECT is_active FROM public.tenants WHERE schema_name = :schema LIMIT 1"),
                    {"schema": schema_name},
                ).fetchone()
            finally:
                db.close()

            if not row:
                status = "missing"
            else:
                status = "active" if bool(row[0]) else "inactive"
        except Exception as exc:
            print(f"[TenantMiddleware] Error validating tenant '{schema_name}': {exc}")
            status = "error"

        self._tenant_cache[schema_name] = (now, status)
        return status
