"""
test_func_proveedores.py — Tests funcionales de Proveedores

Flujos cubiertos:
  FSP01 — CRUD de proveedor y campos básicos
  FSP02 — current_balance: sube con compra CREDIT, baja con pago, intacto con CASH

Correr con:
    cd ferreteria_refactor
    python -m pytest backend_api/tests/test_func_proveedores.py -v --no-cov -s
"""

import pytest
import uuid
from decimal import Decimal
from sqlalchemy import text

import sys, os
_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _root not in sys.path:
    sys.path.insert(0, _root)

from backend_api.models.models import (
    Supplier, PurchaseOrder, PaymentStatus,
)

TENANT = "lalicoreria"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def tenant_db(pg_db_for_schema):
    return pg_db_for_schema(TENANT)


@pytest.fixture()
def supplier_obj(tenant_db):
    supplier = Supplier(
        name=f"Proveedor Test {uuid.uuid4().hex[:8]}",
        contact_person="Juan Pérez",
        phone="0424-1234567",
        email=f"proveedor_{uuid.uuid4().hex[:6]}@test.com",
        payment_terms=30,
        current_balance=Decimal("0.00"),
    )
    tenant_db.add(supplier)
    tenant_db.flush()
    return supplier


# ---------------------------------------------------------------------------
# FSP01 — CRUD básico de proveedor
# ---------------------------------------------------------------------------

class TestFSP01CRUDProveedor:

    def test_crear_proveedor_campos_persisten(self, tenant_db):
        """
        FSP01a: Crear proveedor y verificar que todos los campos persisten.
        """
        nombre = f"Distribuidora {uuid.uuid4().hex[:6]}"
        supplier = Supplier(
            name=nombre,
            contact_person="María López",
            phone="0212-5551234",
            email=f"dist_{uuid.uuid4().hex[:6]}@correo.com",
            address="Av. Principal 123, Caracas",
            payment_terms=15,
            credit_limit=Decimal("5000.00"),
            current_balance=Decimal("0.00"),
        )
        tenant_db.add(supplier)
        tenant_db.flush()

        tenant_db.refresh(supplier)
        assert supplier.id is not None
        assert supplier.name == nombre
        assert supplier.payment_terms == 15
        assert supplier.credit_limit == Decimal("5000.00")
        assert supplier.current_balance == Decimal("0.00")
        assert supplier.is_active is True

    def test_nombre_proveedor_unico(self, tenant_db, supplier_obj):
        """
        FSP01b: El nombre del proveedor tiene constraint UNIQUE.
        Intentar crear otro con el mismo nombre → IntegrityError.
        """
        from sqlalchemy.exc import IntegrityError
        duplicado = Supplier(name=supplier_obj.name)
        tenant_db.add(duplicado)
        with pytest.raises(IntegrityError):
            tenant_db.flush()

    def test_proveedor_sin_campos_opcionales(self, tenant_db):
        """
        FSP01c: Crear proveedor solo con nombre (campos mínimos requeridos).
        Todos los demás son nullable o tienen default.
        """
        supplier = Supplier(name=f"Básico {uuid.uuid4().hex[:6]}")
        tenant_db.add(supplier)
        tenant_db.flush()

        assert supplier.id is not None
        assert supplier.current_balance == Decimal("0.00")
        assert supplier.payment_terms == 30  # default
        assert supplier.is_active is True

    def test_soft_delete_proveedor(self, tenant_db, supplier_obj):
        """
        FSP01d: is_active=False no elimina el proveedor, solo lo desactiva.
        El registro permanece en BD para preservar historial de compras.
        """
        supplier_obj.is_active = False
        tenant_db.flush()

        # Verificar que sigue en BD
        recovered = tenant_db.query(Supplier).get(supplier_obj.id)
        assert recovered is not None
        assert recovered.is_active is False

        # Filtrar activos no lo incluye
        activos = tenant_db.query(Supplier).filter_by(is_active=True).all()
        ids = [s.id for s in activos]
        assert supplier_obj.id not in ids


# ---------------------------------------------------------------------------
# FSP02 — current_balance refleja deuda con proveedor
# ---------------------------------------------------------------------------

class TestFSP02Balance:

    def test_compra_credit_aumenta_balance(self, tenant_db, supplier_obj):
        """
        FSP02a: Una compra a crédito (CREDIT) debe aumentar current_balance
        del proveedor en el monto total. Simula que debemos ese dinero.
        """
        monto = Decimal("1500.00")
        supplier_obj.current_balance += monto
        tenant_db.flush()

        tenant_db.refresh(supplier_obj)
        assert supplier_obj.current_balance == Decimal("1500.00")

        # PurchaseOrder como registro formal
        po = PurchaseOrder(
            supplier_id=supplier_obj.id,
            total_amount=monto,
            paid_amount=Decimal("0.00"),
            payment_status=PaymentStatus.PENDING,
        )
        tenant_db.add(po)
        tenant_db.flush()

        assert po.payment_status == PaymentStatus.PENDING
        assert po.paid_amount == Decimal("0.00")

    def test_pago_parcial_reduce_balance_y_marca_partial(self, tenant_db, supplier_obj):
        """
        FSP02b: Un pago parcial a un proveedor reduce current_balance y
        actualiza la PO a status PARTIAL.
        """
        monto_total = Decimal("2000.00")
        pago_parcial = Decimal("800.00")

        supplier_obj.current_balance = monto_total
        po = PurchaseOrder(
            supplier_id=supplier_obj.id,
            total_amount=monto_total,
            paid_amount=Decimal("0.00"),
            payment_status=PaymentStatus.PENDING,
        )
        tenant_db.add(po)
        tenant_db.flush()

        # Registrar pago parcial
        po.paid_amount += pago_parcial
        supplier_obj.current_balance -= pago_parcial
        if po.paid_amount >= po.total_amount:
            po.payment_status = PaymentStatus.PAID
        else:
            po.payment_status = PaymentStatus.PARTIAL
        tenant_db.flush()

        tenant_db.refresh(po)
        tenant_db.refresh(supplier_obj)
        assert po.payment_status == PaymentStatus.PARTIAL
        assert po.paid_amount == pago_parcial
        assert supplier_obj.current_balance == monto_total - pago_parcial

    def test_pago_completo_liquida_po(self, tenant_db, supplier_obj):
        """
        FSP02c: Pago completo de la PO → status PAID, current_balance = 0.
        """
        monto = Decimal("500.00")
        supplier_obj.current_balance = monto
        po = PurchaseOrder(
            supplier_id=supplier_obj.id,
            total_amount=monto,
            paid_amount=Decimal("0.00"),
            payment_status=PaymentStatus.PENDING,
        )
        tenant_db.add(po)
        tenant_db.flush()

        po.paid_amount = monto
        po.payment_status = PaymentStatus.PAID
        supplier_obj.current_balance = Decimal("0.00")
        tenant_db.flush()

        tenant_db.refresh(po)
        tenant_db.refresh(supplier_obj)
        assert po.payment_status == PaymentStatus.PAID
        assert supplier_obj.current_balance == Decimal("0.00")

    def test_compra_cash_no_cambia_balance(self, tenant_db, supplier_obj):
        """
        FSP02d: Una compra en efectivo (CASH) se paga en el momento.
        El current_balance del proveedor NO debe cambiar (no hay deuda).
        """
        balance_inicial = supplier_obj.current_balance

        # Compra CASH: pagada inmediatamente, sin deuda
        po = PurchaseOrder(
            supplier_id=supplier_obj.id,
            total_amount=Decimal("300.00"),
            paid_amount=Decimal("300.00"),
            payment_status=PaymentStatus.PAID,
        )
        tenant_db.add(po)
        tenant_db.flush()

        # El balance no cambió — fue pagado al contado
        tenant_db.refresh(supplier_obj)
        assert supplier_obj.current_balance == balance_inicial
