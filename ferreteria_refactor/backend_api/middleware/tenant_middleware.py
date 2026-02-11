from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.types import ASGIApp
import re
from ..tenant_context import set_tenant_schema
from ..config import settings

class TenantMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp):
        super().__init__(app)
        # Regex to validate safe schema names (alphanumeric + underscore + dash)
        # Prevents SQL Injection via Host header
        self.schema_validator = re.compile(r'^[a-z0-9_-]+$')

    async def dispatch(self, request: Request, call_next):
        
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
                if subdomain not in ["www", "api", "app", "dashboard", "admin", "saas", "backoffice"]:
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
