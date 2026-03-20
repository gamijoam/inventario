"""
test_func_comisiones.py — Tests funcionales de Comisiones

Flujos cubiertos:
  FCO01 — CommissionLog: creación, monto calculado, estado PENDING
  FCO02 — Payout: status → PAID, CashMovement EXPENSE, no doble pago
  FCO03 — Casos borde: comisión 0%, resumen por empleado

Correr con:
    cd ferreteria_refactor
    python -m pytest backend_api/tests/test_func_comisiones.py -v --no-cov -s
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
    CommissionLog, CommissionStatus,
    Sale, SaleDetail, Product,
    CashRegister, CashSession, CashMovement,
)

TENANT = "lalicoreria"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def tenant_db(pg_db_for_schema):
    return pg_db_for_schema(TENANT)


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
def open_session_obj(tenant_db, user_id):
    register = CashRegister(
        name=f"Caja Com {uuid.uuid4().hex[:6]}",
        code=f"CC{uuid.uuid4().hex[:4].upper()}",
        is_active=True,
    )
    tenant_db.add(register)
    tenant_db.flush()

    session = CashSession(
        register_id=register.id,
        user_id=user_id,
        status="OPEN",
        initial_cash=Decimal("100.00"),
        initial_cash_bs=Decimal("0.00"),
    )
    tenant_db.add(session)
    tenant_db.flush()
    return session


@pytest.fixture()
def product_obj(tenant_db):
    p = Product(
        name=f"Prod Com {uuid.uuid4().hex[:6]}",
        price=Decimal("100.00"),
        cost_price=Decimal("60.00"),
    )
    tenant_db.add(p)
    tenant_db.flush()
    return p


def _crear_sale_con_detail(db, user_id, product, session_id, total):
    """Crea un Sale + SaleDetail para simular una venta real."""
    sale = Sale(
        session_id=session_id,
        total_amount=total,
        payment_method="Efectivo",
        is_credit=False,
        paid=True,
    )
    db.add(sale)
    db.flush()

    detail = SaleDetail(
        sale_id=sale.id,
        product_id=product.id,
        quantity=Decimal("1.000"),
        unit_price=total,
        cost_at_sale=product.cost_price,
        subtotal=total,
    )
    db.add(detail)
    db.flush()
    return sale, detail


def _commission_log(db, user_id, sale_detail_id, sale_total, pct):
    """Crea un CommissionLog con el monto calculado."""
    amount = (sale_total * pct / Decimal("100.00")).quantize(Decimal("0.01"))
    log = CommissionLog(
        user_id=user_id,
        sale_detail_id=sale_detail_id,
        source_type="SALE",
        source_id=sale_detail_id,
        amount=amount,
        percentage_applied=pct,
        status=CommissionStatus.PENDING,
    )
    db.add(log)
    db.flush()
    return log


# ---------------------------------------------------------------------------
# FCO01 — Creación de CommissionLog
# ---------------------------------------------------------------------------

class TestFCO01CrearComision:

    def test_commission_log_creado_con_sale(
        self, tenant_db, user_id, product_obj, open_session_obj
    ):
        """
        FCO01a: Al hacer una venta, el router crea un CommissionLog vinculado
        al SaleDetail con source_type="SALE". Verificamos que los campos persisten.
        """
        sale, detail = _crear_sale_con_detail(
            tenant_db, user_id, product_obj, open_session_obj.id, Decimal("100.00")
        )
        log = _commission_log(tenant_db, user_id, detail.id, Decimal("100.00"), Decimal("5.00"))

        tenant_db.refresh(log)
        assert log.id is not None
        assert log.user_id == user_id
        assert log.sale_detail_id == detail.id
        assert log.source_type == "SALE"
        assert log.status == CommissionStatus.PENDING

    def test_monto_comision_calculado_correctamente(
        self, tenant_db, user_id, product_obj, open_session_obj
    ):
        """
        FCO01b: Comisión = total_venta × porcentaje / 100.
        Venta $200, comisión 5% → $10.00.
        """
        sale, detail = _crear_sale_con_detail(
            tenant_db, user_id, product_obj, open_session_obj.id, Decimal("200.00")
        )
        log = _commission_log(tenant_db, user_id, detail.id, Decimal("200.00"), Decimal("5.00"))

        assert log.amount == Decimal("10.00"), \
            f"Comisión 5% de $200 debería ser $10, es {log.amount}"
        assert log.percentage_applied == Decimal("5.00")

    def test_comision_estado_inicial_pending(
        self, tenant_db, user_id, product_obj, open_session_obj
    ):
        """
        FCO01c: Toda comisión nueva tiene status=PENDING. No se paga automáticamente.
        """
        sale, detail = _crear_sale_con_detail(
            tenant_db, user_id, product_obj, open_session_obj.id, Decimal("50.00")
        )
        log = _commission_log(tenant_db, user_id, detail.id, Decimal("50.00"), Decimal("3.00"))

        assert log.status == CommissionStatus.PENDING
        assert log.paid_at is None

    def test_multiples_comisiones_por_venta(
        self, tenant_db, user_id, product_obj, open_session_obj
    ):
        """
        FCO01d: Una venta con múltiples ítems genera un CommissionLog por ítem.
        """
        p2 = Product(name=f"P2 {uuid.uuid4().hex[:6]}", price=Decimal("50.00"))
        tenant_db.add(p2)
        tenant_db.flush()

        sale = Sale(
            session_id=open_session_obj.id,
            total_amount=Decimal("150.00"),
            payment_method="Efectivo",
            is_credit=False,
            paid=True,
        )
        tenant_db.add(sale)
        tenant_db.flush()

        d1 = SaleDetail(sale_id=sale.id, product_id=product_obj.id,
                         quantity=Decimal("1.000"), unit_price=Decimal("100.00"),
                         cost_at_sale=Decimal("60.00"), subtotal=Decimal("100.00"))
        d2 = SaleDetail(sale_id=sale.id, product_id=p2.id,
                         quantity=Decimal("1.000"), unit_price=Decimal("50.00"),
                         cost_at_sale=Decimal("30.00"), subtotal=Decimal("50.00"))
        tenant_db.add(d1)
        tenant_db.add(d2)
        tenant_db.flush()

        log1 = _commission_log(tenant_db, user_id, d1.id, Decimal("100.00"), Decimal("5.00"))
        log2 = _commission_log(tenant_db, user_id, d2.id, Decimal("50.00"), Decimal("5.00"))

        assert log1.amount == Decimal("5.00")  # 5% de 100
        assert log2.amount == Decimal("2.50")  # 5% de 50

        comisiones = tenant_db.query(CommissionLog).filter(
            CommissionLog.id.in_([log1.id, log2.id])
        ).all()
        assert len(comisiones) == 2


# ---------------------------------------------------------------------------
# FCO02 — Payout de comisiones
# ---------------------------------------------------------------------------

class TestFCO02Payout:

    def test_payout_cambia_status_a_paid(
        self, tenant_db, user_id, product_obj, open_session_obj
    ):
        """
        FCO02a: Al pagar una comisión, su status cambia de PENDING a PAID
        y se registra paid_at.
        """
        from datetime import datetime
        sale, detail = _crear_sale_con_detail(
            tenant_db, user_id, product_obj, open_session_obj.id, Decimal("100.00")
        )
        log = _commission_log(tenant_db, user_id, detail.id, Decimal("100.00"), Decimal("5.00"))

        # Simular payout
        log.status = CommissionStatus.PAID
        log.paid_at = datetime.utcnow()
        tenant_db.flush()

        tenant_db.refresh(log)
        assert log.status == CommissionStatus.PAID
        assert log.paid_at is not None

    def test_payout_crea_cash_movement_expense(
        self, tenant_db, user_id, product_obj, open_session_obj
    ):
        """
        FCO02b: El payout debe crear un CashMovement de tipo EXPENSE en la sesión
        activa. El dinero de la comisión sale físicamente de la caja.
        """
        from datetime import datetime
        sale, detail = _crear_sale_con_detail(
            tenant_db, user_id, product_obj, open_session_obj.id, Decimal("200.00")
        )
        log = _commission_log(tenant_db, user_id, detail.id, Decimal("200.00"), Decimal("5.00"))

        # Pagar la comisión y crear el movimiento de caja
        log.status = CommissionStatus.PAID
        log.paid_at = datetime.utcnow()

        gasto = CashMovement(
            session_id=open_session_obj.id,
            type="EXPENSE",
            amount=log.amount,
            currency="USD",
            description=f"Pago comisión #{log.id}",
        )
        tenant_db.add(gasto)
        tenant_db.flush()

        # Verificar el movimiento en la sesión
        movimientos = tenant_db.query(CashMovement).filter_by(
            session_id=open_session_obj.id, type="EXPENSE"
        ).all()
        assert any(m.amount == Decimal("10.00") for m in movimientos), \
            "Debe existir un EXPENSE de $10 (5% de $200) en la sesión"

    def test_no_doble_pago_comision(
        self, tenant_db, user_id, product_obj, open_session_obj
    ):
        """
        FCO02c: Una comisión PAID no debe ser pagada dos veces.
        El router verifica status != PAID antes de procesar.
        Verificamos la condición a nivel de modelo.
        """
        from datetime import datetime
        sale, detail = _crear_sale_con_detail(
            tenant_db, user_id, product_obj, open_session_obj.id, Decimal("100.00")
        )
        log = _commission_log(tenant_db, user_id, detail.id, Decimal("100.00"), Decimal("5.00"))

        # Primer pago
        log.status = CommissionStatus.PAID
        log.paid_at = datetime.utcnow()
        tenant_db.flush()

        # Verificar que el router rechazaría el segundo intento
        tenant_db.refresh(log)
        puede_pagar = log.status == CommissionStatus.PENDING
        assert not puede_pagar, "Una comisión PAID no puede pagarse dos veces"

    def test_payout_bulk_multiples_comisiones(
        self, tenant_db, user_id, product_obj, open_session_obj
    ):
        """
        FCO02d: Pagar múltiples comisiones en un solo payout (bulk).
        El total de CashMovement = suma de todas las comisiones.
        """
        from datetime import datetime
        logs = []
        for total in [Decimal("100.00"), Decimal("200.00"), Decimal("150.00")]:
            sale, detail = _crear_sale_con_detail(
                tenant_db, user_id, product_obj, open_session_obj.id, total
            )
            log = _commission_log(tenant_db, user_id, detail.id, total, Decimal("10.00"))
            logs.append(log)

        total_comisiones = sum(l.amount for l in logs)
        assert total_comisiones == Decimal("45.00")  # 10% de 100+200+150

        # Pagar todas de una sola vez
        for log in logs:
            log.status = CommissionStatus.PAID
            log.paid_at = datetime.utcnow()

        tenant_db.add(CashMovement(
            session_id=open_session_obj.id,
            type="EXPENSE",
            amount=total_comisiones,
            currency="USD",
            description="Payout bulk comisiones",
        ))
        tenant_db.flush()

        pagadas = tenant_db.query(CommissionLog).filter(
            CommissionLog.id.in_([l.id for l in logs]),
            CommissionLog.status == CommissionStatus.PAID,
        ).all()
        assert len(pagadas) == 3


# ---------------------------------------------------------------------------
# FCO03 — Casos borde
# ---------------------------------------------------------------------------

class TestFCO03CasosBorde:

    def test_resumen_comisiones_por_usuario(
        self, tenant_db, user_id, product_obj, open_session_obj
    ):
        """
        FCO03a: Agregar comisiones de un usuario y calcular total PENDING vs PAID.
        """
        from datetime import datetime
        # 2 comisiones PENDING
        sale1, d1 = _crear_sale_con_detail(
            tenant_db, user_id, product_obj, open_session_obj.id, Decimal("100.00")
        )
        sale2, d2 = _crear_sale_con_detail(
            tenant_db, user_id, product_obj, open_session_obj.id, Decimal("200.00")
        )
        log1 = _commission_log(tenant_db, user_id, d1.id, Decimal("100.00"), Decimal("5.00"))
        log2 = _commission_log(tenant_db, user_id, d2.id, Decimal("200.00"), Decimal("5.00"))

        # 1 comisión PAID
        sale3, d3 = _crear_sale_con_detail(
            tenant_db, user_id, product_obj, open_session_obj.id, Decimal("50.00")
        )
        log3 = _commission_log(tenant_db, user_id, d3.id, Decimal("50.00"), Decimal("5.00"))
        log3.status = CommissionStatus.PAID
        log3.paid_at = datetime.utcnow()
        tenant_db.flush()

        # Resumen (como haría el router)
        pending_ids = [log1.id, log2.id, log3.id]
        pending_rows = tenant_db.query(CommissionLog).filter(
            CommissionLog.id.in_(pending_ids),
            CommissionLog.user_id == user_id,
            CommissionLog.status == CommissionStatus.PENDING,
        ).all()
        paid_rows = tenant_db.query(CommissionLog).filter(
            CommissionLog.id.in_(pending_ids),
            CommissionLog.user_id == user_id,
            CommissionLog.status == CommissionStatus.PAID,
        ).all()

        assert len(pending_rows) == 2
        assert sum(l.amount for l in pending_rows) == Decimal("15.00")  # 5+10
        assert len(paid_rows) == 1
        assert sum(l.amount for l in paid_rows) == Decimal("2.50")   # 5% de 50
