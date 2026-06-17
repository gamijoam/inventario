"""
Compatibility wrapper for legacy imports.

All application WebSocket traffic should use the tenant-aware manager in
backend_api.services.websocket_manager. This module remains so older routers
that import backend_api.websocket.manager keep using the same connection pool.
"""
from ..services.websocket_manager import manager, ConnectionManager

__all__ = ["manager", "ConnectionManager"]
