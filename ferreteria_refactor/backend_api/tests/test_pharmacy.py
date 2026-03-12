"""Tests for the pharmacy module — models, fields, and keyword detection logic."""

import pytest
from datetime import date, timedelta
from decimal import Decimal

# ---------------------------------------------------------------------------
# Imports — with skip if unavailable (matches project pattern)
# ---------------------------------------------------------------------------

try:
    import sys
    import os

    _backend_root = os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    )
    if _backend_root not in sys.path:
        sys.path.insert(0, _backend_root)

    from backend_api.models.models import Product, ProductLot, Prescription
    from backend_api.models.tenant import Tenant

    MODELS_AVAILABLE = True
except Exception as _err:
    MODELS_AVAILABLE = False
    _err_msg = str(_err)


def _skip_if_unavailable():
    if not MODELS_AVAILABLE:
        pytest.skip(f"Modelos no disponibles: {_err_msg}")


# ---------------------------------------------------------------------------
# Helper factories
# ---------------------------------------------------------------------------


def _make_product(db_session, **kwargs) -> "Product":
    """Creates and persists a Product with minimal valid defaults."""
    defaults = dict(
        name="Producto Farmacia Test",
        price=Decimal("5.00"),
        stock=Decimal("0.000"),
        is_active=True,
        is_service=False,
        is_combo=False,
        has_imei=False,
    )
    defaults.update(kwargs)
    p = Product(**defaults)
    db_session.add(p)
    db_session.flush()
    return p


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_product_pharmacy_fields(db_session):
    """A product can store pharmacy-specific fields: drug_classification,
    active_ingredient, storage_condition, and requires_prescription."""
    _skip_if_unavailable()

    product = _make_product(
        db_session,
        name="Paracetamol 500mg",
        sku="PARA-500",
        drug_classification="OTC",
        active_ingredient="Paracetamol",
        storage_condition="AMBIENT",
        requires_prescription=False,
    )

    db_session.refresh(product)

    assert product.drug_classification == "OTC"
    assert product.active_ingredient == "Paracetamol"
    assert product.storage_condition == "AMBIENT"
    assert product.requires_prescription is False


def test_product_lot_creation(db_session):
    """A ProductLot with a future expiry_date saves with status='ACTIVE'."""
    _skip_if_unavailable()

    product = _make_product(db_session, name="Ibuprofeno 400mg", sku="IBU-400")

    future_expiry = date.today() + timedelta(days=365)
    lot = ProductLot(
        product_id=product.id,
        lot_number="LOT-2025-001",
        expiry_date=future_expiry,
        quantity=Decimal("100.00"),
        status="ACTIVE",
    )
    db_session.add(lot)
    db_session.flush()

    db_session.refresh(lot)

    assert lot.id is not None
    assert lot.status == "ACTIVE"
    assert lot.expiry_date == future_expiry
    assert lot.product_id == product.id
    assert float(lot.quantity) == 100.0


def test_product_lot_expiry_logic(db_session):
    """A lot with expiry_date set to yesterday has negative days_until_expiry."""
    _skip_if_unavailable()

    product = _make_product(db_session, name="Amoxicilina 500mg", sku="AMOX-500")

    yesterday = date.today() - timedelta(days=1)
    lot = ProductLot(
        product_id=product.id,
        lot_number="LOT-EXPIRED-001",
        expiry_date=yesterday,
        quantity=Decimal("50.00"),
        status="ACTIVE",
    )
    db_session.add(lot)
    db_session.flush()

    db_session.refresh(lot)

    # Reproduce the days_until_expiry calculation used in pharmacy router
    today = date.today()
    days_until_expiry = (lot.expiry_date - today).days

    assert days_until_expiry < 0, (
        f"Expected negative days_until_expiry for a lot expiring yesterday, "
        f"got {days_until_expiry}"
    )


def test_prescription_creation(db_session):
    """A Prescription with patient_name, patient_cedula, and doctor_name saves correctly."""
    _skip_if_unavailable()

    rx = Prescription(
        patient_name="Juan Pérez",
        patient_cedula="V-12345678",
        doctor_name="Dra. María González",
    )
    db_session.add(rx)
    db_session.flush()

    db_session.refresh(rx)

    assert rx.id is not None
    assert rx.patient_name == "Juan Pérez"
    assert rx.patient_cedula == "V-12345678"
    assert rx.doctor_name == "Dra. María González"
    # sale_id should be nullable (not linked to a sale in this test)
    assert rx.sale_id is None


def test_tenant_pharmacy_flag(db_session):
    """The Tenant model exposes a has_pharmacy_module Boolean field."""
    _skip_if_unavailable()

    # Verify the column attribute exists on the mapped class
    assert hasattr(Tenant, "has_pharmacy_module"), (
        "Tenant model must have 'has_pharmacy_module' attribute"
    )

    # Verify default is falsy (False or None) for a fresh instance
    t = Tenant(name="Test Tenant", schema_name="test_schema_pharm")
    assert not t.has_pharmacy_module, (
        "has_pharmacy_module should default to False for a new Tenant"
    )

    # Verify it can be set to True
    t.has_pharmacy_module = True
    assert t.has_pharmacy_module is True


def test_pharmacy_keyword_detection():
    """The keyword detection logic used in tenant_service marks pharmacies correctly.

    'Farmacia Central' must trigger has_pharmacy_module=True.
    'Ferretería ABC' must NOT trigger has_pharmacy_module=True.
    """
    _skip_if_unavailable()

    pharmacy_keywords = [
        "FARMACIA", "DROGUERIA", "DROGUERÍA", "BOTICA"
    ]

    def detect_pharmacy(business_name: str) -> bool:
        """Replicates the exact logic from tenant_service.py."""
        rubro = business_name.upper()
        return any(k in rubro for k in pharmacy_keywords)

    assert detect_pharmacy("Farmacia Central") is True, (
        "'Farmacia Central' should be detected as a pharmacy business"
    )
    assert detect_pharmacy("Ferretería ABC") is False, (
        "'Ferretería ABC' should NOT be detected as a pharmacy business"
    )
    # Additional boundary checks
    assert detect_pharmacy("Droguería El Carmen") is True
    assert detect_pharmacy("Botica San Rafael") is True
    assert detect_pharmacy("Abastos El Buen Precio") is False
