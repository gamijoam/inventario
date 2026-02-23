import asyncio
import websockets

async def test_connect():
    token = "DEBUG_BYPASS_TOKEN_xyz"
    url = f"wss://api.miinventariofacil.com/api/v1/ws/hardware/connect?client_id=caja-1&tenant_id=prueba&token={token}"
    try:
        print(f"Connecting to {url}")
        async with websockets.connect(url) as websocket:
            print("✅ Connected!")
            
            # Start listening
            try:
                while True:
                    message = await websocket.recv()
                    print(f"📩 Received: {message}")
            except websockets.exceptions.ConnectionClosed as e:
                print(f"🔌 Connection closed. Code: {e.code}, Reason: {e.reason}")
    except Exception as e:
        print(f"❌ Handshake failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_connect())
