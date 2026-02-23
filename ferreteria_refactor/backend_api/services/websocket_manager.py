"""
WebSocket Connection Manager for Hardware Bridge connections
Manages active WebSocket connections from Hardware Bridge clients
"""
from fastapi import WebSocket
from typing import Dict
import asyncio
import json


class ConnectionManager:
    def __init__(self):
        # Store active connections: {tenant_id: {client_id: websocket}}
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, client_id: str, tenant_id: str):
        """Register a new WebSocket connection (must be accepted by router first)"""
        
        if tenant_id not in self.active_connections:
            self.active_connections[tenant_id] = {}
            
        self.active_connections[tenant_id][client_id] = websocket
        
        print(f"✅ [WS] Connected: {tenant_id} -> {client_id}")
        # print(f"   Active for {tenant_id}: {list(self.active_connections[tenant_id].keys())}")
    
    def disconnect(self, client_id: str, tenant_id: str):
        """Remove a disconnected client"""
        if tenant_id in self.active_connections:
            if client_id in self.active_connections[tenant_id]:
                del self.active_connections[tenant_id][client_id]
                print(f"❌ [WS] Disconnected: {tenant_id} -> {client_id}")
            
            # Clean up empty tenant dicts
            if not self.active_connections[tenant_id]:
                del self.active_connections[tenant_id]
                # print(f"   Tenant {tenant_id} cleared (no active connections)")
    
    async def send_to_client(self, message: dict, client_id: str, tenant_id: str) -> bool:
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
            await asyncio.wait_for(websocket.send_json(message), timeout=5.0)
            
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
                await websocket.send_json(message)
            except Exception:
                self.disconnect(client_id, tenant_id)


# Global instance
manager = ConnectionManager()
