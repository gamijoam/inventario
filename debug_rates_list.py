import requests
import json

def check_rates():
    try:
        url = 'http://127.0.0.1:8000/api/v1/config/exchange-rates?is_active=true'
        print(f"Fetching {url}...")
        response = requests.get(url)
        
        if response.status_code != 200:
            print(f"Error Response: {response.text}")
            return

        data = response.json()
        print(f"Total Rates: {len(data)}")
        
        for r in data:
            print(f"Rate ID: {r.get('id')} - {r.get('name')} (Code: {r.get('currency_code')}) - Rate: {r.get('rate')}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_rates()
