"""
Tests for product pagination, search, and catalog endpoint.
Verifies performance-critical features work correctly with large datasets.
"""
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from backend_api.models import models


def create_products(db: Session, count: int, category=None, prefix=""):
    """Helper: create N test products"""
    products = []
    for i in range(count):
        product = models.Product(
            name=f"Test Product {prefix}{i:04d}",
            sku=f"SKU-{prefix}{i:04d}",
            price=10.0 + i,
            stock=100,
            is_active=True,
            category_id=category.id if category else None,
        )
        db.add(product)
        products.append(product)
    db.commit()
    for p in products:
        db.refresh(p)
    return products


def create_category(db: Session, name: str):
    """Helper: create a test category"""
    cat = models.Category(name=name)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


# ============================================================
# Test: Default pagination limits
# ============================================================
class TestProductPagination:
    def test_default_limit_is_100(self, client: TestClient, db_session: Session, auth_headers):
        """GET /products/ without limit should return max 100 products"""
        create_products(db_session, 150)
        response = client.get("/api/v1/products/", headers=auth_headers)
        assert response.status_code == 200
        assert len(response.json()) == 100  # default limit

    def test_custom_limit(self, client: TestClient, db_session: Session, auth_headers):
        """GET /products/?limit=30 should return exactly 30"""
        create_products(db_session, 50)
        response = client.get("/api/v1/products/?limit=30", headers=auth_headers)
        assert response.status_code == 200
        assert len(response.json()) == 30

    def test_skip_offset(self, client: TestClient, db_session: Session, auth_headers):
        """GET /products/?skip=10&limit=5 should skip first 10"""
        create_products(db_session, 20)
        response = client.get("/api/v1/products/?skip=10&limit=5", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 5

    def test_limit_cannot_exceed_500(self, client: TestClient, db_session: Session, auth_headers):
        """GET /products/?limit=1000 should be rejected (le=500)"""
        response = client.get("/api/v1/products/?limit=1000", headers=auth_headers)
        assert response.status_code == 422  # Validation error

    def test_search_by_name(self, client: TestClient, db_session: Session, auth_headers):
        """GET /products/?search=taladro should filter by name"""
        create_products(db_session, 10)
        # Create a product with specific name
        special = models.Product(
            name="Taladro Especial", sku="TAL-001", price=50.0, stock=10, is_active=True
        )
        db_session.add(special)
        db_session.commit()

        response = client.get("/api/v1/products/?search=taladro", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Taladro Especial"

    def test_search_by_sku(self, client: TestClient, db_session: Session, auth_headers):
        """GET /products/?search=SKU-0005 should find by SKU"""
        create_products(db_session, 10)
        response = client.get("/api/v1/products/?search=SKU-0005", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["sku"] == "SKU-0005"

    def test_empty_search_returns_all(self, client: TestClient, db_session: Session, auth_headers):
        """GET /products/?search= should return all (up to limit)"""
        create_products(db_session, 5)
        response = client.get("/api/v1/products/?search=", headers=auth_headers)
        assert response.status_code == 200
        assert len(response.json()) == 5

    def test_pagination_second_page(self, client: TestClient, db_session: Session, auth_headers):
        """Verify second page returns different products than first"""
        create_products(db_session, 30)
        page1 = client.get("/api/v1/products/?skip=0&limit=10", headers=auth_headers)
        page2 = client.get("/api/v1/products/?skip=10&limit=10", headers=auth_headers)

        assert page1.status_code == 200
        assert page2.status_code == 200

        ids1 = {p["id"] for p in page1.json()}
        ids2 = {p["id"] for p in page2.json()}
        assert ids1.isdisjoint(ids2)  # No overlap


# ============================================================
# Test: Catalog lightweight endpoint
# ============================================================
class TestCatalogEndpoint:
    def test_catalog_returns_products(self, client: TestClient, db_session: Session, auth_headers):
        """GET /products/catalog should return products"""
        create_products(db_session, 5)
        response = client.get("/api/v1/products/catalog", headers=auth_headers)
        assert response.status_code == 200
        assert len(response.json()) == 5

    def test_catalog_default_limit_200(self, client: TestClient, db_session: Session, auth_headers):
        """Catalog endpoint default limit is 200"""
        create_products(db_session, 250)
        response = client.get("/api/v1/products/catalog", headers=auth_headers)
        assert response.status_code == 200
        assert len(response.json()) == 200

    def test_catalog_search(self, client: TestClient, db_session: Session, auth_headers):
        """Catalog search filters by name"""
        create_products(db_session, 10)
        special = models.Product(
            name="Martillo Grande", sku="MRT-001", price=25.0, stock=5, is_active=True
        )
        db_session.add(special)
        db_session.commit()

        response = client.get("/api/v1/products/catalog?search=martillo", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert "Martillo" in data[0]["name"]

    def test_catalog_filter_by_category(self, client: TestClient, db_session: Session, auth_headers):
        """Catalog filters by category_id"""
        cat = create_category(db_session, "Herramientas")
        create_products(db_session, 5, category=cat, prefix="CAT-")
        create_products(db_session, 3, prefix="NOCAT-")  # No category

        response = client.get(
            f"/api/v1/products/catalog?category_id={cat.id}", headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 5
        assert all(p["category_id"] == cat.id for p in data)

    def test_catalog_limit_max_1000(self, client: TestClient, db_session: Session, auth_headers):
        """Catalog rejects limit > 1000"""
        response = client.get("/api/v1/products/catalog?limit=1500", headers=auth_headers)
        assert response.status_code == 422


# ============================================================
# Test: Customer pagination
# ============================================================
class TestCustomerPagination:
    def test_customer_default_limit(self, client: TestClient, db_session: Session, auth_headers):
        """GET /customers/ should respect default limit of 100"""
        for i in range(120):
            db_session.add(
                models.Customer(name=f"Cliente {i:03d}", id_number=f"V-{i:06d}")
            )
        db_session.commit()

        response = client.get("/api/v1/customers/", headers=auth_headers)
        assert response.status_code == 200
        assert len(response.json()) == 100

    def test_customer_search(self, client: TestClient, db_session: Session, auth_headers):
        """GET /customers/?q=maria should filter by name"""
        db_session.add(models.Customer(name="Maria Garcia", id_number="V-123456"))
        db_session.add(models.Customer(name="Jose Lopez", id_number="V-789012"))
        db_session.commit()

        response = client.get("/api/v1/customers/?q=maria", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Maria Garcia"

    def test_customer_limit_max_500(self, client: TestClient, db_session: Session, auth_headers):
        """Customers endpoint rejects limit > 500"""
        response = client.get("/api/v1/customers/?limit=600", headers=auth_headers)
        assert response.status_code == 422
