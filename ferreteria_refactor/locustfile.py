from locust import HttpUser, task, between
import random

class SalesUser(HttpUser):
    wait_time = between(1, 3) # Wait 1-3 seconds between tasks
    token = None
    products = []

    def on_start(self):
        """Login on start to get JWT token"""
        response = self.client.post("/api/v1/auth/token", data={
            "username": "admin",
            "password": "admin123"
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            print("Login successful")
            
            # Fetch products to sell
            prod_failed = False
            try:
                prod_resp = self.client.get("/api/v1/products/", headers={"Authorization": f"Bearer {self.token}"})
                if prod_resp.status_code == 200:
                    self.products = prod_resp.json()
                else:
                    prod_failed = True
            except:
                prod_failed = True
            
            if prod_failed:
                print("Failed to fetch products!")
        else:
            print(f"Login failed: {response.text}")

    @task
    def create_sale(self):
        """Attempt to create a sale"""
        if not self.token or not self.products:
            return

        # Pick a random product with stock > 0
        available_products = [p for p in self.products if p['stock'] > 0]
        if not available_products:
            print("No stock available to sell!")
            return

        product = random.choice(available_products)
        
        sale_payload = {
            "items": [
                {
                    "product_id": product['id'],
                    "quantity": 1,
                    "unit_price_usd": product['price'],
                    "conversion_factor": 1.0,
                    "discount": 0,
                    "discount_type": "NONE"
                }
            ],
            "total_amount": product['price'],
            "payment_method": "Efectivo",
            "currency": "USD",
            "exchange_rate": 1.0,
            "payments": [
                 {
                    "amount": product['price'],
                    "currency": "USD",
                    "payment_method": "Efectivo",
                    "exchange_rate": 1.0
                 }
            ]
        }

        with self.client.post(
            "/api/v1/products/sales/", 
            json=sale_payload, 
            headers={"Authorization": f"Bearer {self.token}"},
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            elif response.status_code == 400 and "Insufficient stock" in response.text:
                # If we fail due to stock running out during test, that's a valid business fail, not a system crash
                response.failure(f"Out of stock: {response.text}")
            else:
                 response.failure(f"Failed with {response.status_code}: {response.text}")
