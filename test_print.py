import requests

url = "https://api.miinventariofacil.com/api/v1/products/print/remote"
headers = {
    "Origin": "https://prueba.miinventariofacil.com",
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "content-type"
}

try:
    options_res = requests.options(url, headers=headers)
    print(f"OPTIONS Status: {options_res.status_code}")
    print(f"OPTIONS Headers: {options_res.headers}")
except Exception as e:
    print(f"OPTIONS Failed: {e}")

# Also try POST
try:
    post_res = requests.post(
        url, 
        headers={"Origin": "https://prueba.miinventariofacil.com"}, 
        json={"sale_id": 1, "client_id": "caja-1"}
    )
    print(f"POST Status: {post_res.status_code}")
    print(f"POST Body: {post_res.text}")
except Exception as e:
    print(f"POST Failed: {e}")
