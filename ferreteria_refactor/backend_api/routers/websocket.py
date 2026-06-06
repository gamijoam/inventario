"""
WebSocket Router
Handles WebSocket connections and keeps them alive
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from ..services.websocket_manager import manager
import json

router = APIRouter(prefix="/ws", tags=["websocket"])

# Rate-limit WS auth failure logs: max 1 log per IP every 5 minutes
import time as _time
_ws_fail_log = {}  # {ip: last_log_timestamp}
_WS_LOG_COOLDOWN = 300  # 5 minutes

def _should_log_ws_fail(ip: str) -> bool:
    now = _time.time()
    last = _ws_fail_log.get(ip, 0)
    if now - last > _WS_LOG_COOLDOWN:
        _ws_fail_log[ip] = now
        return True
    return False


@router.websocket("/hardware/connect")
async def hardware_connect(
    websocket: WebSocket,
    client_id: str = Query(...),
    tenant_id: str = Query(...),
    token: str = Query(...)
):
    """
    Dedicated endpoint for Hardware Bridge connections
    Validates identity and registers in multi-tenant manager
    """
    # Fix trailing space bugs from manual input in C# textbox
    client_id = client_id.strip() if client_id else ""
    tenant_id = tenant_id.strip() if tenant_id else ""
    
    # 0. Accept connection first to complete HTTP 101 Upgrade
    await websocket.accept()
    
    # 1. Decode token to find real numeric tenant ID instead of trusting string input
    from jose import JWTError, jwt
    from ..config import settings
    from ..models.models import User
    from ..database.db import SessionLocal

    client_ip = websocket.client.host if websocket.client else "unknown"

    if not token or len(token) < 10:
        if _should_log_ws_fail(client_ip):
            print(f"⛔ [WS] Connection rejected from {client_ip} ({client_id}): Invalid Token")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    db = SessionLocal()
    real_tenant_id = None
    try:
        from jose import ExpiredSignatureError
        
        # Ignore expiration time for Hardware Bridge (config tokens are long-lived), but still verify signature
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"verify_exp": False}
        )
        email = payload.get("sub")
        if not email:
            print("⛔ [WS] Auth Failed: Token payload missing 'sub'")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
            
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"⛔ [WS] Auth Failed: User not found in DB.")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        # --- NEW STRICT SCHEMA-BASED AUTHENTICATION ---
        # The bridge connects pointing to a specific schema (tenant_id, e.g. "prueba3")
        # If the user typed a legacy numeric ID (e.g., "1"), auto-convert it to schema name
        from ..models.tenant import Tenant
        
        if tenant_id.isdigit():
            target_tenant = db.query(Tenant).filter(Tenant.id == int(tenant_id)).first()
            if target_tenant:
                print(f"🔄 [WS] Auto-converting legacy numeric Tenant ID '{tenant_id}' -> Schema '{target_tenant.schema_name}'")
                tenant_id = target_tenant.schema_name
        else:
            target_tenant = db.query(Tenant).filter(Tenant.schema_name == tenant_id).first()
        is_authorized = False
        
        if user.is_superuser:
            # Superadmins can connect to any schema
            is_authorized = True
        elif target_tenant and user.tenant_id == target_tenant.id:
            # Standard user belongs to this specific schema
            is_authorized = True

        if not is_authorized:
            print(f"⛔ [WS] Auth Failed: User '{email}' does NOT have access to schema '{tenant_id}'")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        # We connect using the string SCHEMA NAME (tenant_id) as the universal key matching the POS
        print(f"🔐 [WS] Validated C# Bridge '{client_id}'. Connected securely to Schema ID: '{tenant_id}'")
        
    except ExpiredSignatureError:
        print(f"⛔ [WS] Token Expired Error (should be ignored by options, but caught safely)")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    except JWTError:
        if _should_log_ws_fail(client_ip):
            print(f"⛔ [WS] Invalid Token from {client_ip} ({client_id}): bad signature or expired")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    except Exception as e:
        print(f"⛔ [WS] Unexpected Auth Error: {e}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    finally:
        db.close()

    # 2. Connect using secure schema name
    try:
        await manager.connect(websocket, client_id, tenant_id)
        
        # 3. Acknowledge
        await websocket.send_text(json.dumps({
            "type": "conn_ack", 
            "status": "connected",
            "tenant": tenant_id
        }))
        
        # 4. Listen Loop
        import asyncio
        while True:
            try:
                # Add a timeout so the server doesn't hang forever if the client goes silent
                # Traefik drops idle connections after 30s. Bridge pings every 20s.
                data = await asyncio.wait_for(websocket.receive_text(), timeout=40.0)
                
                # Keep-alive logic
                if data and "ping" in data.lower():
                    await websocket.send_text("pong")
                else:
                    print(f"📥 [WS] Received unexpected data from {client_id}: {data}")
            except asyncio.TimeoutError:
                print(f"⚠️ [WS] Connection timeout for '{client_id}'. No ping received.")
                break # Exit loop to trigger disconnect
                
    except WebSocketDisconnect as e:
        print(f"🔌 [WS] Client '{client_id}' disconnected normally (Code: {e.code})")
        manager.disconnect(client_id, tenant_id)
    except Exception as e:
        print(f"❌ [WS] Error in hardware connection loop: {e}")
        import traceback
        traceback.print_exc()
        manager.disconnect(client_id, tenant_id)



@router.websocket("")
@router.websocket("/")
async def websocket_endpoint(websocket: WebSocket):
    """
    Frontend WebSocket endpoint.
    Lee el tenant del header X-Tenant-ID o del query param tenant_id.
    Si no se especifica, usa 'public'.
    """
    import uuid

    # Resolver tenant desde headers o query params
    tenant_id = (
        websocket.headers.get("x-tenant-id")
        or websocket.headers.get("X-Tenant-ID")
        or websocket.query_params.get("tenant_id")
        or "public"
    ).strip().lower() or "public"

    # Aceptar la conexión
    await websocket.accept()
    temp_id = f"web_{str(uuid.uuid4())[:8]}"

    try:
        await manager.connect(websocket, client_id=temp_id, tenant_id=tenant_id)
        await websocket.send_text(json.dumps({"type": "conn_ack", "msg": "Connected", "tenant": tenant_id}))
        print(f"✅ [WS] Frontend conectado: tenant={tenant_id} id={temp_id}")
    except Exception as e:
        print(f"[WS] Error conectando WebSocket: {e}")
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
                    # "connections": manager.get_connection_count() # Method removed in refactor
                }))
                
    except WebSocketDisconnect:
        print(f"🔌 [WS] Frontend disconnected: tenant={tenant_id} id={temp_id}")
         
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        manager.disconnect(temp_id, tenant_id)
