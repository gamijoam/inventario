import httpx
import asyncio
import os

async def check_api():
    url = "http://localhost:8000/api/v1/sync/pull/catalog"
    # We might need auth header if I added protection, but current code uses placeholder key or none?
    # sync_client.py uses "Authorization": "Bearer dev-sync-key"
    headers = {"Authorization": "Bearer dev-sync-key"}
    
    try:
        async with httpx.AsyncClient() as client:
            print(f"Connecting to {url}...")
            resp = await client.get(url, headers=headers)
            print(f"Status: {resp.status_code}")
            if resp.status_code == 200:
                data = resp.json()
                print(f"Products: {len(data.get('products', []))}")
                print(f"Categories: {len(data.get('categories', []))}")
                print(f"Exchange Rates: {len(data.get('exchange_rates', []))}")
                
                if len(data.get('products', [])) > 0:
                    print("Sample Product:", data['products'][0])
            else:
                print("Error Response:", resp.text)
    except Exception as e:
        print(f"Connection Failed: {e}")

if __name__ == "__main__":
    asyncio.run(check_api())
