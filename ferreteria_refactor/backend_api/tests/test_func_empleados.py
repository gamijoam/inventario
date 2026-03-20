"""
test_func_empleados.py — Tests funcionales de Empleados y Comisiones (módulo barbería/salón)

Flujos cubiertos:
  FEM01 — Employee CRUD: crear, campos, defaults, filtros
  FEM02 — Soft-delete: status=INACTIVE, registro preservado, excluido de filtro activo
  FEM03 — Commission: crear, monto calculado, flujo PENDING→PAID→CANCELLED
  FEM04 — Casos borde: empleado sin comisiones, múltiples empleados mismo tenant

Nota: Este módulo (Employee/Commission) es diferente a CommissionLog.
Employee/Commission es para barbería/salón (pago por servicio al empleado).
CommissionLog es para ventas generales (comisión por venta al usuario).

Correr con:
    cd ferreteria_refactor
    python -m pytest backend_api/tests/test_func_empleados.py -v --no-cov -s
"""

import pytest
import uuid
from decimal import Decimal

import sys, os
_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _root not in sys.path:
    sys.path.insert(0, _root)

from sqlalchemy import text
from backend_api.models.models import Employee, Commission, SaleDetail, Sale, Product
from backend_api.models.models import CashRegister, CashSession

TENANT = "lalicoreria"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def tenant_db(pg_db_for_schema):
    return pg_db_for_schema(TENANT)


@pytest.fixture()
def tenant_id(pg_engine):
    with pg_engine.connect() as conn:
        row = conn.execute(text(
            "SELECT id FROM public.tenants WHERE schema_name = :schema LIMIT 1"
        ), {"schema": TENANT}).fetchone()
    assert row is not None
    return row[0]


@pytest.fixture()
def user_id(pg_engine):
    with pg_engine.connect() as conn:
        row = conn.execute(text("""
            SELECT u.id FROM public.users u
            JOIN public.tenants t ON t.id = u.tenant_id
            WHERE t.schema_name = :schema AND u.role = 'ADMIN' AND u.is_active = TRUE
            LIMIT 1
        """), {"schema": TENANT}).fetchone()
    assert row is not None
    return row[0]


@pytest.fixture()
def employee_obj(tenant_db, tenant_id):
    emp = Employee(
        tenant_id=tenant_id,
        name=f"Empleado {uuid.uuid4().hex[:6]}",
        status="ACTIVE",
    )
    tenant_db.add(emp)
    tenant_db.flush()
    return emp


@pytest.fixture()
def open_session_obj(tenant_db, user_id):
    reg = CashRegister(
        name=f"Caja Emp {uuid.uuid4().hex[:6]}",
        code=f"CE{uuid.uuid4().hex[:4].upper()}",
        is_active=True,
    )
    tenant_db.add(reg)
    tenant_db.flush()

    session = CashSession(
        register_id=reg.id,
        user_id=user_id,
        status="OPEN",
        initial_cash=Decimal("100.00"),
        initial_cash_bs=Decimal("0.00"),
    )
    tenant_db.add(session)
    tenant_db.flush()
    return session


@pytest.fixture()
def sale_detail_obj(tenant_db, open_session_obj):
    """Crea un SaleDetail realista para vincular comisiones."""
    product = Product(
        name=f"Servicio {uuid.uuid4().hex[:6]}",
        price=Decimal("30.00"),
        cost_price=Decimal("0.00"),
    )
    tenant_db.add(product)
    tenant_db.flush()

    sale = Sale(
        session_id=open_session_obj.id,
        total_amount=Decimal("30.00"),
        payment_method="Efectivo",
        is_credit=False,
        paid=True,
    )
    tenant_db.add(sale)
    tenant_db.flush()

    detail = SaleDetail(
        sale_id=sale.id,
        product_id=product.id,
        quantity=Decimal("1.000"),
        unit_price=Decimal("30.00"),
        cost_at_sale=Decimal("0.00"),
        subtotal=Decimal("30.00"),
    )
    tenant_db.add(detail)
    tenant_db.flush()
    return detail


def _crear_commission(db, tenant_id, employee, sale_detail, base_amount, pct):
    """Crea una Commission (barbería) vinculada a un empleado y un SaleDetail."""
    calculated = (base_amount * pct / Decimal("100")).quantize(Decimal("0.0001"))
    comm = Commission(
        tenant_id=tenant_id,
        employee_id=employee.id,
        sale_item_id=sale_detail.id,
        base_amount=base_amount,
        calculated_commission=calculated,
        status="PENDING",
    )
    db.add(comm)
    db.flush()
    return comm


# ---------------------------------------------------------------------------
# FEM01 — Employee CRUD
# ---------------------------------------------------------------------------

class TestFEM01EmployeeCRUD:

    def test_crear_empleado_campos_persisten(self, tenant_db, tenant_id):
        """FEM01a: Crear empleado con todos los campos — persiste correctamente."""
        emp = Employee(
            tenant_id=tenant_id,
            name=f"Ana López {uuid.uuid4().hex[:4]}",
            document_id="V-12345678",
            phone="0412-1234567",
            status="ACTIVE",
            base_commission_percentage=Decimal("40.00"),
        )
        tenant_db.add(emp)
        tenant_db.flush()

        tenant_db.refresh(emp)
        assert emp.id is not None
        assert emp.document_id == "V-12345678"
        assert emp.phone == "0412-1234567"
        assert emp.base_commission_percentage == Decimal("40.00")

    def test_defaults_empleado(self, tenant_db, tenant_id):
        """FEM01b: Defaults: status=ACTIVE, base_commission_percentage=50.00."""
        emp = Employee(
            tenant_id=tenant_id,
            name=f"Emp Default {uuid.uuid4().hex[:6]}",
        )
        tenant_db.add(emp)
        tenant_db.flush()
        tenant_db.refresh(emp)
        assert emp.status == "ACTIVE"
        assert emp.base_commission_percentage == Decimal("50.00")

    def test_campos_opcionales_nulos(self, tenant_db, tenant_id):
        """FEM01c: document_id y phone son nullable."""
        emp = Employee(
            tenant_id=tenant_id,
            name=f"Emp Sin Doc {uuid.uuid4().hex[:6]}",
        )
        tenant_db.add(emp)
        tenant_db.flush()
        tenant_db.refresh(emp)
        assert emp.document_id is None
        assert emp.phone is None

    def test_filtrar_activos_por_tenant(self, tenant_db, tenant_id):
        """FEM01d: Filtrar empleados activos por tenant_id."""
        emp1 = Employee(tenant_id=tenant_id, name=f"E1 {uuid.uuid4().hex[:6]}", status="ACTIVE")
        emp2 = Employee(tenant_id=tenant_id, name=f"E2 {uuid.uuid4().hex[:6]}", status="ACTIVE")
        emp3 = Employee(tenant_id=tenant_id, name=f"E3 {uuid.uuid4().hex[:6]}", status="INACTIVE")
        tenant_db.add_all([emp1, emp2, emp3])
        tenant_db.flush()

        activos = tenant_db.query(Employee).filter_by(
            tenant_id=tenant_id, status="ACTIVE"
        ).all()
        ids = {e.id for e in activos}

        assert emp1.id in ids
        assert emp2.id in ids
        assert emp3.id not in ids


# ---------------------------------------------------------------------------
# FEM02 — Soft-delete (status → INACTIVE)
# ---------------------------------------------------------------------------

class TestFEM02SoftDelete:

    def test_soft_delete_cambia_status_inactive(self, tenant_db, employee_obj):
        """FEM02a: Eliminar un empleado cambia status=INACTIVE, no borra el registro."""
        employee_obj.status = "INACTIVE"
        tenant_db.flush()

        tenant_db.refresh(employee_obj)
        assert employee_obj.status == "INACTIVE"
        # El registro sigue en BD
        en_bd = tenant_db.query(Employee).filter_by(id=employee_obj.id).first()
        assert en_bd is not None

    def test_empleado_inactivo_excluido_del_listado(self, tenant_db, tenant_id):
        """FEM02b: Los empleados INACTIVE no aparecen en el listado activo."""
        emp_activo = Employee(tenant_id=tenant_id, name=f"Act {uuid.uuid4().hex[:6]}", status="ACTIVE")
        emp_inactivo = Employee(tenant_id=tenant_id, name=f"Inact {uuid.uuid4().hex[:6]}", status="INACTIVE")
        tenant_db.add_all([emp_activo, emp_inactivo])
        tenant_db.flush()

        activos = tenant_db.query(Employee).filter_by(
            tenant_id=tenant_id, status="ACTIVE"
        ).all()
        ids = {e.id for e in activos}

        assert emp_activo.id in ids
        assert emp_inactivo.id not in ids

    def test_inactivar_no_borra_comisiones(self, tenant_db, tenant_id, employee_obj, sale_detail_obj):
        """FEM02c: Al inactivar un empleado, sus comisiones PENDING siguen existiendo."""
        comm = _crear_commission(
            tenant_db, tenant_id, employee_obj, sale_detail_obj, Decimal("30.00"), Decimal("50.00")
        )
        employee_obj.status = "INACTIVE"
        tenant_db.flush()

        comm_en_bd = tenant_db.query(Commission).filter_by(id=comm.id).first()
        assert comm_en_bd is not None
        assert comm_en_bd.status == "PENDING"


# ---------------------------------------------------------------------------
# FEM03 — Commission: creación y flujo de pago
# ---------------------------------------------------------------------------

class TestFEM03Commission:

    def test_commission_creada_correctamente(self, tenant_db, tenant_id, employee_obj, sale_detail_obj):
        """
        FEM03a: Crear una Commission vinculada a un empleado y un SaleDetail.
        calculated_commission = base_amount × percentage / 100.
        """
        comm = _crear_commission(
            tenant_db, tenant_id, employee_obj, sale_detail_obj,
            base_amount=Decimal("30.00"),
            pct=Decimal("50.00"),
        )

        tenant_db.refresh(comm)
        assert comm.id is not None
        assert comm.employee_id == employee_obj.id
        assert comm.base_amount == Decimal("30.00")
        assert comm.calculated_commission == Decimal("15.0000")  # 50% de 30
        assert comm.status == "PENDING"

    def test_commission_status_pending_to_paid(self, tenant_db, tenant_id, employee_obj, sale_detail_obj):
        """FEM03b: Pagar una comisión cambia su status de PENDING a PAID."""
        comm = _crear_commission(
            tenant_db, tenant_id, employee_obj, sale_detail_obj, Decimal("30.00"), Decimal("50.00")
        )

        # Simular el payout del router
        comm.status = "PAID"
        tenant_db.flush()

        tenant_db.refresh(comm)
        assert comm.status == "PAID"

    def test_commission_cancelada(self, tenant_db, tenant_id, employee_obj, sale_detail_obj):
        """FEM03c: Una comisión puede cancelarse (CANCELLED) — por devolución o anulación."""
        comm = _crear_commission(
            tenant_db, tenant_id, employee_obj, sale_detail_obj, Decimal("50.00"), Decimal("40.00")
        )

        comm.status = "CANCELLED"
        tenant_db.flush()

        tenant_db.refresh(comm)
        assert comm.status == "CANCELLED"

    def test_total_pendiente_excluye_pagadas_y_canceladas(
        self, tenant_db, tenant_id, employee_obj, sale_detail_obj
    ):
        """
        FEM03d: El total a pagar al empleado es la suma de comisiones PENDING solamente.
        Las PAID y CANCELLED no cuentan.
        """
        # 2 PENDING + 1 PAID + 1 CANCELLED
        c1 = _crear_commission(tenant_db, tenant_id, employee_obj, sale_detail_obj, Decimal("30.00"), Decimal("50.00"))
        c2 = _crear_commission(tenant_db, tenant_id, employee_obj, sale_detail_obj, Decimal("20.00"), Decimal("50.00"))
        c3 = _crear_commission(tenant_db, tenant_id, employee_obj, sale_detail_obj, Decimal("40.00"), Decimal("50.00"))
        c4 = _crear_commission(tenant_db, tenant_id, employee_obj, sale_detail_obj, Decimal("10.00"), Decimal("50.00"))

        c3.status = "PAID"
        c4.status = "CANCELLED"
        tenant_db.flush()

        pendientes = tenant_db.query(Commission).filter_by(
            employee_id=employee_obj.id,
            status="PENDING",
        ).all()

        total_pendiente = sum(c.calculated_commission for c in pendientes)
        assert len(pendientes) == 2
        assert total_pendiente == Decimal("25.0000")  # 15 + 10 (50% de 30 + 50% de 20)

    def test_porcentaje_base_de_empleado(self, tenant_db, tenant_id):
        """
        FEM03e: El porcentaje base del empleado (base_commission_percentage)
        determina cuánto gana por defecto en cada servicio.
        """
        emp = Employee(
            tenant_id=tenant_id,
            name=f"Barbero {uuid.uuid4().hex[:6]}",
            base_commission_percentage=Decimal("60.00"),
        )
        tenant_db.add(emp)
        tenant_db.flush()

        tenant_db.refresh(emp)
        # El router usaría este % para calcular la comisión si no hay regla explícita
        assert emp.base_commission_percentage == Decimal("60.00")


# ---------------------------------------------------------------------------
# FEM04 — Casos borde
# ---------------------------------------------------------------------------

class TestFEM04CasosBorde:

    def test_empleado_sin_comisiones(self, tenant_db, employee_obj):
        """FEM04a: Un empleado nuevo sin comisiones tiene lista vacía."""
        comisiones = tenant_db.query(Commission).filter_by(
            employee_id=employee_obj.id
        ).all()
        assert comisiones == []

    def test_multiples_empleados_mismo_tenant(self, tenant_db, tenant_id):
        """FEM04b: Múltiples empleados en el mismo tenant son independientes."""
        emps = []
        for i in range(3):
            emp = Employee(
                tenant_id=tenant_id,
                name=f"Barbero {i} {uuid.uuid4().hex[:4]}",
                base_commission_percentage=Decimal(f"{30 + i * 10}.00"),
            )
            tenant_db.add(emp)
            emps.append(emp)
        tenant_db.flush()

        for emp in emps:
            tenant_db.refresh(emp)
            assert emp.tenant_id == tenant_id
            assert emp.id is not None

        # Todos tienen IDs únicos
        ids = {e.id for e in emps}
        assert len(ids) == 3
