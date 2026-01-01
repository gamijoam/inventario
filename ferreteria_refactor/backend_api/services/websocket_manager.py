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
        # Store active connections: {client_id: websocket}
        self.active_connections: Dict[str, WebSocket] = {}
    
    async def connect(self, client_id: str, websocket: WebSocket):
        """Accept and register a new WebSocket connection"""
        await websocket.accept()
        self.active_connections[client_id] = websocket
        print(f"[OK] Hardware Bridge connected: {client_id}")
        print(f"   Active clients: {list(self.active_connections.keys())}")
    
    def disconnect(self, client_id: str):
        """Remove a disconnected client"""
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            print(f"[DISCONNECT] Hardware Bridge disconnected: {client_id}")
            print(f"   Active clients: {list(self.active_connections.keys())}")
    
    async def send_to_client(self, client_id: str, message: dict) -> bool:
        """
        Send a message to a specific Hardware Bridge client
        Returns True if sent successfully, False if client not connected
        """
        if client_id not in self.active_connections:
            print(f"[WARN] Client {client_id} not connected")
            return False
        
        try:
            websocket = self.active_connections[client_id]
            await websocket.send_json(message)
            print(f"[SEND] Sent message to {client_id}: {message.get('type', 'unknown')}")
            return True
        except Exception as e:
            print(f"[ERROR] Error sending to {client_id}: {e}")
            self.disconnect(client_id)
            return False
    
    def get_active_clients(self) -> list:
        """Get list of currently connected client IDs"""
        return list(self.active_connections.keys())
    
    def is_client_connected(self, client_id: str) -> bool:
        """Check if a specific client is connected"""
        return client_id in self.active_connections

    async def broadcast(self, message: dict):
        """Send a message to ALL connected hardware bridges"""
        if not self.active_connections:
            print("[WARN] No hardware bridges connected for broadcast")
            return
            
        print(f"[BROADCAST] Sending to {len(self.active_connections)} active bridges")
        for client_id, websocket in list(self.active_connections.items()):
            try:
                await websocket.send_json(message)
            except Exception as e:
                print(f"[ERROR] Broadcast to {client_id} failed: {e}")
                self.disconnect(client_id)


# Global instance
manager = ConnectionManager()
