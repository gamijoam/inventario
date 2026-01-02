"""
WebSocket Router
Handles WebSocket connections and keeps them alive
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ..websocket.manager import manager
import json

router = APIRouter(prefix="/ws", tags=["websocket"])


@router.websocket("")
@router.websocket("/")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time updates
    Clients connect to: ws://localhost:8000/api/v1/ws
    """
    try:
        await manager.connect(websocket)
        await websocket.send_text(json.dumps({"type": "conn_ack", "msg": "Connected"}))
    except Exception as e:
        print(f"[WS] Error connecting WebSocket: {e}")
        return
    
    try:
        while True:
            # Receive messages from client (for heartbeat/ping)
            data = await websocket.receive_text()
            
            # Handle ping/pong for keep-alive
            if data == "ping":
                await websocket.send_text("pong")
            else:
                # Echo back for debugging
                await websocket.send_text(json.dumps({
                    "type": "echo",
                    "data": data,
                    "connections": manager.get_connection_count()
                }))
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print("Client disconnected normally")
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)
