import pytest
import concurrent.futures
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend_api.main import app
from backend_api.database.db import Base, get_db
from backend_api.models import models
from backend_api.security import create_access_token
from backend_api.routers.products import router

# Setup distinct DB for concurrency test to avoid fixture locking issues with threads
import tempfile
import os

# Create a generic temp file for the DB
db_fd, db_path = tempfile.mkstemp(suffix=".db")
os.close(db_fd) # Close the file descriptor, let SQLAlchemy open it

SQLALCHEMY_DATABASE_URL = f"sqlite:///{db_path}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False} # Needed for SQLite with threads
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

# Apply separate session override for concurrency
app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="module")
def setup_database():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Create Admin
    admin = models.User(username="admin", password_hash="hash", role=models.UserRole.ADMIN, is_active=True)
    db.add(admin)
    
    # Create Currency/Rate if needed (SalesService needs exchange rate)
    usd = models.ExchangeRate(name="USD", currency_code="USD", currency_symbol="$", rate=1.0, is_default=True)
    db.add(usd)
    
    db.commit()
    db.close()
    
    yield
    
    # Cleanup
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    if os.path.exists(db_path):
        try:
            os.remove(db_path)
        except PermissionError:
            pass

def test_concurrent_sales_race_condition(setup_database):
    """
    Simulate 5 concurrent requests trying to buy the LAST unit of stock.
    Expectation: Only 1 succeeds. 4 fail. Stock becomes 0.
    """
    # 1. Setup Product with Stock = 1
    db = TestingSessionLocal()
    product = models.Product(name="Limited Item", price=100.0, stock=1, is_active=True)
    db.add(product)
    db.commit()
    db.refresh(product)
    product_id = product.id
    db.close()

    # 2. Prepare Request Data
    auth_token = create_access_token(data={"sub": "admin"})
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    sale_payload = {
        "items": [
            {"product_id": product_id, "quantity": 1, "unit_price_usd": 100, "conversion_factor": 1, "discount": 0}
        ],
        "total_amount": 100,
        "payment_method": "Efectivo",
        "currency": "USD",
        "exchange_rate": 1.0, 
        "payments": [{"amount": 100, "currency": "USD", "payment_method": "Efectivo", "exchange_rate": 1.0}]
    }

    # 3. Execute Concurrent Requests
    client = TestClient(app)
    
    def make_request():
        return client.post("/api/v1/products/sales/", json=sale_payload, headers=headers)

    responses = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(make_request) for _ in range(5)]
        for future in concurrent.futures.as_completed(futures):
            responses.append(future.result())

    # 4. Analyze Results
    success_count = sum(1 for r in responses if r.status_code == 200)
    fail_count = sum(1 for r in responses if r.status_code == 400)
    
    print(f"\nResults: Success={success_count}, Fails={fail_count}")
    
    # 5. Verify Final Stock
    db = TestingSessionLocal()
    final_product = db.query(models.Product).get(product_id)
    final_stock = final_product.stock
    db.close()
    
    print(f"Final Stock: {final_stock}")

    # Assertions
     # NOTE: Without row locking (SELECT FOR UPDATE) or optimistic locking, 
     # this test MIGHT FAIL (showing >1 success and negative stock) in a real concurrent env.
     # SQLite with 'check_same_thread=False' might serialize writes, but reads might still race by default.
    assert success_count == 1, f"Expected 1 success, got {success_count}"
    assert fail_count == 4, f"Expected 4 failures, got {fail_count}"
    assert final_stock == 0, f"Expected stock 0, got {final_stock}"
