"""
WebSocket Router for Hardware Bridge connections
Handles persistent WebSocket connections from Hardware Bridge clients
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ..services.websocket_manager import manager
import asyncio

router = APIRouter(prefix="/ws", tags=["WebSocket"])


@router.websocket("/hardware/{client_id}")
async def hardware_bridge_websocket(websocket: WebSocket, client_id: str):
    """
    WebSocket endpoint for Hardware Bridge clients
    
    Args:
        client_id: Unique identifier for the Hardware Bridge (e.g., "escritorio-caja-1")
    """
    await manager.connect(client_id, websocket)
    
    try:
        while True:
            # Keep connection alive and listen for messages from client
            # (Hardware Bridge might send status updates, confirmations, etc.)
            data = await websocket.receive_text()
            
            # Log received message
            print(f"[WS] Received from {client_id}: {data}")
            
            # You can handle client messages here if needed
            # For now, we just acknowledge
            
    except WebSocketDisconnect:
        manager.disconnect(client_id)
        print(f"[WS] WebSocket disconnected: {client_id}")
    except Exception as e:
        print(f"[ERROR] WebSocket error for {client_id}: {e}")
        manager.disconnect(client_id)
