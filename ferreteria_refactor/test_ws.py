import asyncio
import websockets
import sys

async def test():
    uri = "ws://127.0.0.1:8000/api/v1/ws"
    print(f"Connecting to {uri}...")
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected successfully!")
            await websocket.send("ping")
            response = await websocket.recv()
            print(f"Received: {response}")
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    try:
        asyncio.run(test())
    except ImportError:
        print("websockets library not found. Please install it.")
