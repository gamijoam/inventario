import contextvars
from typing import Optional

# Context variable to store the current request's tenant schema
# Default to 'public' if not set (e.g., background tasks or unmanaged requests)
_tenant_schema: contextvars.ContextVar[str] = contextvars.ContextVar("tenant_schema", default="public")

def get_tenant_schema() -> str:
    """
    Get the current active tenant schema.
    Returns 'public' if no specific tenant is set.
    """
    return _tenant_schema.get()

def set_tenant_schema(schema: str):
    """
    Set the active tenant schema for the current context.
    Sanitization should happen before calling this.
    """
    _tenant_schema.set(schema)

def reset_tenant_schema():
    """
    Reset context to default 'public'.
    Useful for cleanup or testing.
    """
    _tenant_schema.set("public")
