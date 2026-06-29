"""
WebSocket Connection Manager for Hardware Bridge connections
Manages active WebSocket connections from Hardware Bridge clients
"""
from fastapi import WebSocket
from typing import Dict, Any, Optional
import asyncio
import json
from datetime import datetime
from decimal import Decimal

from ..tenant_context import get_tenant_schema


class ConnectionManager:
    def __init__(self):
        # Store active connections: {tenant_id: {client_id: websocket}}
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}

    def _json_serializer(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, Decimal):
            return str(obj)
        raise TypeError(f"Type {type(obj)} not serializable")

    def _normalize_message(self, event_or_message: Any, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if isinstance(event_or_message, dict):
            message = dict(event_or_message)
            message.setdefault("timestamp", datetime.now().isoformat())
            return message

        return {
            "type": event_or_message,
            "data": data or {},
            "timestamp": datetime.now().isoformat(),
        }

    def _resolve_tenant_id(self, tenant_id: Optional[str] = None) -> str:
        tenant = (tenant_id or get_tenant_schema() or "public").strip().lower()
        return tenant or "public"

    async def _send_json_safe(self, websocket: WebSocket, message: Dict[str, Any]) -> None:
        await websocket.send_text(json.dumps(message, default=self._json_serializer))
    
    async def connect(self, websocket: WebSocket, client_id: str, tenant_id: str):
        """Register a new WebSocket connection (must be accepted by router first)"""
        
        if tenant_id not in self.active_connections:
            self.active_connections[tenant_id] = {}
            
        self.active_connections[tenant_id][client_id] = websocket
        
        print(f"✅ [WS] Connected: {tenant_id} -> {client_id}")
        # print(f"   Active for {tenant_id}: {list(self.active_connections[tenant_id].keys())}")
    
    def disconnect(self, client_id: str, tenant_id: str):
        """Remove a disconnected client"""
        tenant_id = self._resolve_tenant_id(tenant_id)
        if tenant_id in self.active_connections:
            if client_id in self.active_connections[tenant_id]:
                del self.active_connections[tenant_id][client_id]
                print(f"❌ [WS] Disconnected: {tenant_id} -> {client_id}")
            
            # Clean up empty tenant dicts
            if not self.active_connections[tenant_id]:
                del self.active_connections[tenant_id]
                # print(f"   Tenant {tenant_id} cleared (no active connections)")
    
    async def send_to_client(self, message: dict, client_id: str, tenant_id: str, timeout: float = 5.0) -> bool:
        """
        Send a message to a specific Hardware Bridge client
        """
        if tenant_id not in self.active_connections:
            print(f"⚠️ [WS] Tenant {tenant_id} not active")
            return False
            
        if client_id not in self.active_connections[tenant_id]:
            print(f"⚠️ [WS] Client {client_id} not connected in {tenant_id}")
            return False
        
        try:
            websocket = self.active_connections[tenant_id][client_id]
            print(f"📤 [WS] Sending to {client_id} (Tenant: {tenant_id})...")
            
            # Use a timeout to prevent hanging on zombified sockets
            import asyncio
            await asyncio.wait_for(self._send_json_safe(websocket, message), timeout=timeout)
            
            print(f"✅ [WS] Sent to {client_id}: {message.get('type', 'unknown')}")
            return True
        except asyncio.TimeoutError:
            print(f"❌ [WS] Timeout while sending to {client_id}. Socket is likely dead.")
            self.disconnect(client_id, tenant_id)
            return False
        except Exception as e:
            print(f"❌ [WS] Error sending to {client_id}: {e}")
            import traceback
            traceback.print_exc()
            self.disconnect(client_id, tenant_id)
            return False

    async def send_personal_message(
        self,
        message: Any,
        websocket: WebSocket = None,
        client_id: str = None,
        tenant_id: str = None,
    ) -> bool:
        """Backward-compatible personal send for old hardware print callers."""
        if websocket is not None:
            try:
                if isinstance(message, str):
                    await websocket.send_text(message)
                else:
                    await self._send_json_safe(websocket, message)
                return True
            except Exception as e:
                print(f"❌ [WS] Error sending personal message: {e}")
                return False

        if not client_id:
            print("⚠️ [WS] send_personal_message called without websocket or client_id")
            return False

        if isinstance(message, str):
            try:
                parsed = json.loads(message)
            except Exception:
                parsed = {"type": "message", "data": message}
        else:
            parsed = message

        return await self.send_to_client(parsed, client_id, self._resolve_tenant_id(tenant_id))

    def find_client_tenant(self, client_id: str) -> str:
        """
        Find which tenant a client belongs to.
        Returns tenant_id if found, else None.
        """
        for tenant_id, clients in self.active_connections.items():
            if client_id in clients:
                return tenant_id
        return None

    async def broadcast_to_tenant(self, message: dict, tenant_id: str):
        """Send message to ALL clients in a specific tenant"""
        if tenant_id not in self.active_connections:
            return
            
        for client_id, websocket in list(self.active_connections[tenant_id].items()):
            try:
                await self._send_json_safe(websocket, message)
            except Exception:
                self.disconnect(client_id, tenant_id)

    async def broadcast_all(self, message: dict):
        """Send message to ALL clients across ALL tenants (Global Broadcast)"""
        for tenant_id, clients in list(self.active_connections.items()):
            for client_id, websocket in list(clients.items()):
                try:
                    await self._send_json_safe(websocket, message)
                except Exception:
                    self.disconnect(client_id, tenant_id)

    async def broadcast(
        self,
        event_or_message: Any,
        data: Optional[Dict[str, Any]] = None,
        tenant_id: Optional[str] = None,
    ):
        """Backward-compatible broadcast used by legacy app routers."""
        message = self._normalize_message(event_or_message, data)
        target_tenant = self._resolve_tenant_id(tenant_id or message.get("tenant_id"))

        if target_tenant == "public":
            print(f"📣 [WS] Broadcasting global event: {message.get('type')}")
            await self.broadcast_all(message)
            return

        message["tenant_id"] = target_tenant
        if isinstance(message.get("data"), dict):
            message["data"].setdefault("tenant_id", target_tenant)

        print(f"📣 [WS] Broadcasting event: {message.get('type')} to tenant {target_tenant}")
        await self.broadcast_to_tenant(message, target_tenant)

    def get_connection_count(self) -> int:
        return sum(len(clients) for clients in self.active_connections.values())

# Global instance
manager = ConnectionManager()
