import pytest
import os
import sys
# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from backend_api.main import app
from backend_api.database.db import Base, get_db
from backend_api.models import models
from backend_api.security import create_access_token, get_password_hash

# In-memory SQLite for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    """Create a fresh database for each test."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    
    # Seed required data (Exchange Rates, etc)
    # Default USD rate
    usd_rate = models.ExchangeRate(
        name="BCV", 
        currency_code="USD", 
        currency_symbol="$", 
        rate=1.0, 
        is_default=True
    )
    # VES rate
    ves_rate = models.ExchangeRate(
        name="BCV", 
        currency_code="VES", 
        currency_symbol="Bs", 
        rate=40.0, 
        is_default=True
    )
    session.add(usd_rate)
    session.add(ves_rate)
    
    # Admin User
    admin = models.User(
        username="admin",
        password_hash=get_password_hash("admin123"), # Fixed field name
        full_name="Admin Test",
        role=models.UserRole.ADMIN, # Fixed Enum usage
        is_active=True
    )
    session.add(admin)
    session.commit()
    
    yield session
    
    session.close()
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def client(db_session):
    """Override get_db dependency and return TestClient."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
            
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

@pytest.fixture
def auth_headers():
    """Return headers with valid Admin token."""
    access_token = create_access_token(data={"sub": "admin"})
    return {"Authorization": f"Bearer {access_token}"}
