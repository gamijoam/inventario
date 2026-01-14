import requests
import json

def check_products():
    try:
        url = 'http://127.0.0.1:8000/api/v1/products/'
        print(f"Fetching {url}...")
        response = requests.get(url)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"Error Response: {response.text}")
            return

        data = response.json()
        print(f"Total Products: {len(data)}")
        
        count_with_rate = 0
        products_with_rate = []
        for p in data:
            if p.get('exchange_rate_id'):
                count_with_rate += 1
                products_with_rate.append((p.get('name'), p.get('exchange_rate_id')))
        
        print(f"\nProducts with exchange_rate_id: {count_with_rate}")
        for name, rate_id in products_with_rate:
            print(f" - {name}: {rate_id}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_products()
