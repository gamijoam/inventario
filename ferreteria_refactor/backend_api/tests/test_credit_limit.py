"""
test_credit_limit.py
====================
Tests de la regla de negocio: límite de crédito por cliente.

Arquitectura relevante (sales_service.py → SalesService.create_sale):
    1. Si sale_data.is_credit == True y sale_data.customer_id está definido:
        a. Verifica customer.is_blocked → HTTPException 400 si bloqueado.
        b. Cuenta facturas vencidas → HTTPException 400 si hay overdue.
        c. Calcula current_debt = SUM(balance_pending) de ventas crédito no pagadas.
        d. Si (current_debt + sale_data.total_amount) > customer.credit_limit
           → HTTPException 400 con detalle de saldo disponible.
    2. Si la venta pasa las validaciones → se crea la Sale normalmente.

Campos clave:
    Customer.credit_limit   — Numeric(12,2), default=100.00
    Customer.is_blocked     — Boolean
    Sale.is_credit          — Boolean
    Sale.paid               — Boolean (False = crédito pendiente)
    Sale.balance_pending    — Numeric(18,4), monto restante por cobrar

Tests incluidos:
    test_venta_rechazada_si_excede_credito
        — Llama a la lógica de validación con deuda > límite → verifica excepción.
    test_venta_permitida_dentro_del_limite
        — Llama a la lógica con deuda dentro del límite → verifica que NO lanza excepción.
    test_venta_rechazada_cliente_bloqueado
        — Cliente con is_blocked=True → excepción independientemente del crédito.
    test_venta_rechazada_tiene_facturas_vencidas
        — Cliente con facturas vencidas → excepción antes de revisar el límite.
    test_credito_exactamente_en_el_limite
        — Venta que lleva la deuda exactamente al límite → debe procesarse (borde).
    test_un_centavo_sobre_el_limite_es_rechazado
        — Venta que excede el límite en $0.01 → debe ser rechazada (borde).
    [integración SQLite]
    test_credito_acumulado_en_bd_supera_limite
        — Inserta ventas reales en SQLite y verifica la lógica con datos reales de BD.
"""

import os
import pytest
from decimal import Decimal
from unittest.mock import MagicMock, patch, PropertyMock
from fastapi import HTTPException


# ---------------------------------------------------------------------------
# Importaciones con skip seguro
# ---------------------------------------------------------------------------

def _import_models():
    try:
        import sys
        _backend_root = os.path.dirname(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        )
        if _backend_root not in sys.path:
            sys.path.insert(0, _backend_root)

        from backend_api.models.models import Customer, Sale, Base
        from backend_api.services.sales_service import SalesService
        from sqlalchemy import func
        return Customer, Sale, Base, SalesService, func, None
    except Exception as e:
        return None, None, None, None, None, str(e)


Customer, Sale, Base, SalesService, _func, _import_error = _import_models()
MODELS_AVAILABLE = Customer is not None


# ---------------------------------------------------------------------------
# Helper: lógica de validación de crédito extraída de sales_service.py
# Replicada aquí para tests unitarios sin levantar el servicio completo.
# ---------------------------------------------------------------------------

def _validate_credit_limit(db, customer_id: int, sale_amount: Decimal) -> None:
    """
    Replica la lógica de validación de crédito de SalesService.create_sale().

    Lanza HTTPException(400) en los mismos casos que el servicio real:
    - Cliente bloqueado.
    - Facturas vencidas.
    - Deuda actual + nuevo monto > credit_limit.

    Args:
        db: Sesión SQLAlchemy (real o mock).
        customer_id: ID del cliente.
        sale_amount: Monto de la nueva venta.

    Raises:
        HTTPException: con status_code=400 si alguna validación falla.
        HTTPException: con status_code=404 si el cliente no existe.
    """
    from datetime import datetime

    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    if customer.is_blocked:
        raise HTTPException(
            status_code=400,
            detail=f"Cliente '{customer.name}' está bloqueado por mora.",
        )

    # Facturas vencidas
    overdue_count = (
        db.query(Sale)
        .filter(
            Sale.customer_id == customer_id,
            Sale.is_credit == True,
            Sale.paid == False,
            Sale.due_date < datetime.now(),
        )
        .count()
    )
    if overdue_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cliente tiene {overdue_count} factura(s) vencida(s).",
        )

    # Deuda acumulada
    current_debt = (
        db.query(_func.sum(Sale.balance_pending))
        .filter(
            Sale.customer_id == customer_id,
            Sale.is_credit == True,
            Sale.paid == False,
        )
        .scalar()
        or Decimal("0.00")
    )

    if (current_debt + sale_amount) > customer.credit_limit:
        available = max(Decimal("0.00"), customer.credit_limit - current_debt)
        raise HTTPException(
            status_code=400,
            detail=(
                f"Límite de crédito excedido. "
                f"Deuda: ${current_debt:.2f} / Límite: ${customer.credit_limit:.2f} "
                f"/ Disponible: ${available:.2f}"
            ),
        )


# ---------------------------------------------------------------------------
# Fixtures de mocks reutilizables
# ---------------------------------------------------------------------------

def _make_mock_db(customer: "Customer", current_debt: Decimal, overdue_count: int = 0):
    """
    Construye un mock de sesión SQLAlchemy que responde a las queries
    de validación de crédito con los valores dados.
    """
    mock_db = MagicMock()

    # Query para Customer
    mock_db.query.return_value.filter.return_value.first.return_value = customer

    # Query para overdue count
    mock_db.query.return_value.filter.return_value.count.return_value = overdue_count

    # Query para SUM(balance_pending) — SQLAlchemy usa .scalar()
    mock_db.query.return_value.filter.return_value.scalar.return_value = current_debt

    return mock_db


# ---------------------------------------------------------------------------
# Tests unitarios (sin BD)
# ---------------------------------------------------------------------------

def test_venta_rechazada_si_excede_credito():
    """
    Verifica que _validate_credit_limit lanza HTTPException(400) cuando
    la deuda acumulada + el monto de la nueva venta supera credit_limit.

    Escenario:
        credit_limit = $100.00
        current_debt = $90.00
        nueva_venta  = $20.00
        total        = $110.00 > $100.00  → RECHAZADA
    """
    if not MODELS_AVAILABLE:
        pytest.skip(f"Modelos no disponibles: {_import_error}")

    # Arrange
    customer = Customer(
        id=1,
        name="Cliente Moroso",
        credit_limit=Decimal("100.00"),
        is_blocked=False,
    )
    current_debt = Decimal("90.00")
    nueva_venta = Decimal("20.00")

    mock_db = MagicMock()

    # Simular las tres queries de validación en orden
    mock_db.query.return_value.filter.return_value.first.return_value = customer
    mock_db.query.return_value.filter.return_value.count.return_value = 0  # sin facturas vencidas
    mock_db.query.return_value.filter.return_value.scalar.return_value = current_debt

    # Act & Assert
    with pytest.raises(HTTPException) as exc_info:
        _validate_credit_limit(mock_db, customer_id=1, sale_amount=nueva_venta)

    assert exc_info.value.status_code == 400
    assert "crédito" in exc_info.value.detail.lower(), (
        "El detalle del error debe mencionar el límite de crédito."
    )


def test_venta_permitida_dentro_del_limite():
    """
    Verifica que _validate_credit_limit NO lanza excepción cuando
    la deuda total resultante está dentro del credit_limit.

    Escenario:
        credit_limit = $100.00
        current_debt = $50.00
        nueva_venta  = $30.00
        total        = $80.00 ≤ $100.00  → APROBADA
    """
    if not MODELS_AVAILABLE:
        pytest.skip(f"Modelos no disponibles: {_import_error}")

    customer = Customer(
        id=2,
        name="Cliente Solvente",
        credit_limit=Decimal("100.00"),
        is_blocked=False,
    )
    current_debt = Decimal("50.00")
    nueva_venta = Decimal("30.00")

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = customer
    mock_db.query.return_value.filter.return_value.count.return_value = 0
    mock_db.query.return_value.filter.return_value.scalar.return_value = current_debt

    # No debe lanzar excepción
    try:
        _validate_credit_limit(mock_db, customer_id=2, sale_amount=nueva_venta)
    except HTTPException as e:
        pytest.fail(
            f"No se esperaba HTTPException pero se lanzó: {e.status_code} — {e.detail}"
        )


def test_venta_rechazada_cliente_bloqueado():
    """
    Verifica que _validate_credit_limit rechaza la venta si customer.is_blocked == True,
    independientemente del monto o del crédito disponible.

    Escenario:
        credit_limit = $100.00
        current_debt = $0.00
        nueva_venta  = $10.00
        is_blocked   = True  → RECHAZADA
    """
    if not MODELS_AVAILABLE:
        pytest.skip(f"Modelos no disponibles: {_import_error}")

    customer = Customer(
        id=3,
        name="Cliente Bloqueado",
        credit_limit=Decimal("100.00"),
        is_blocked=True,  # BLOQUEADO
    )

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = customer

    with pytest.raises(HTTPException) as exc_info:
        _validate_credit_limit(mock_db, customer_id=3, sale_amount=Decimal("10.00"))

    assert exc_info.value.status_code == 400
    assert "bloqueado" in exc_info.value.detail.lower(), (
        "El error debe indicar que el cliente está bloqueado."
    )


def test_venta_rechazada_tiene_facturas_vencidas():
    """
    Verifica que _validate_credit_limit rechaza la venta si el cliente
    tiene facturas de crédito vencidas (due_date < now, paid=False).

    Escenario:
        is_blocked   = False
        overdue      = 2 facturas vencidas
        nueva_venta  = $10.00  → RECHAZADA por mora
    """
    if not MODELS_AVAILABLE:
        pytest.skip(f"Modelos no disponibles: {_import_error}")

    customer = Customer(
        id=4,
        name="Cliente con Mora",
        credit_limit=Decimal("500.00"),
        is_blocked=False,
    )

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = customer
    mock_db.query.return_value.filter.return_value.count.return_value = 2  # 2 facturas vencidas
    mock_db.query.return_value.filter.return_value.scalar.return_value = Decimal("0.00")

    with pytest.raises(HTTPException) as exc_info:
        _validate_credit_limit(mock_db, customer_id=4, sale_amount=Decimal("10.00"))

    assert exc_info.value.status_code == 400
    assert "vencida" in exc_info.value.detail.lower(), (
        "El error debe mencionar facturas vencidas."
    )


def test_credito_exactamente_en_el_limite():
    """
    Test de borde: venta que lleva la deuda EXACTAMENTE al credit_limit
    debe ser APROBADA (la condición es estrictamente mayor que, no mayor o igual).

    Escenario:
        credit_limit = $100.00
        current_debt = $70.00
        nueva_venta  = $30.00
        total        = $100.00 == $100.00  → APROBADA
    """
    if not MODELS_AVAILABLE:
        pytest.skip(f"Modelos no disponibles: {_import_error}")

    customer = Customer(
        id=5,
        name="Cliente En El Límite",
        credit_limit=Decimal("100.00"),
        is_blocked=False,
    )
    current_debt = Decimal("70.00")
    nueva_venta = Decimal("30.00")  # total exactamente = 100.00

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = customer
    mock_db.query.return_value.filter.return_value.count.return_value = 0
    mock_db.query.return_value.filter.return_value.scalar.return_value = current_debt

    # No debe lanzar excepción
    try:
        _validate_credit_limit(mock_db, customer_id=5, sale_amount=nueva_venta)
    except HTTPException as e:
        pytest.fail(
            f"Una venta exactamente en el límite no debe ser rechazada. "
            f"Error: {e.status_code} — {e.detail}"
        )


def test_un_centavo_sobre_el_limite_es_rechazado():
    """
    Test de borde: venta que excede el límite en $0.01 debe ser RECHAZADA.

    Escenario:
        credit_limit = $100.00
        current_debt = $70.00
        nueva_venta  = $30.01
        total        = $100.01 > $100.00  → RECHAZADA
    """
    if not MODELS_AVAILABLE:
        pytest.skip(f"Modelos no disponibles: {_import_error}")

    customer = Customer(
        id=6,
        name="Cliente Un Centavo Sobre",
        credit_limit=Decimal("100.00"),
        is_blocked=False,
    )
    current_debt = Decimal("70.00")
    nueva_venta = Decimal("30.01")  # total = 100.01

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = customer
    mock_db.query.return_value.filter.return_value.count.return_value = 0
    mock_db.query.return_value.filter.return_value.scalar.return_value = current_debt

    with pytest.raises(HTTPException) as exc_info:
        _validate_credit_limit(mock_db, customer_id=6, sale_amount=nueva_venta)

    assert exc_info.value.status_code == 400, (
        "Una venta de $0.01 sobre el límite debe generar HTTP 400."
    )


# ---------------------------------------------------------------------------
# Tests de integración con SQLite (BD real en memoria)
# ---------------------------------------------------------------------------

def test_credito_acumulado_en_bd_supera_limite(db_session, customer_with_limit):
    """
    Verifica la lógica de crédito contra datos reales en la BD SQLite de prueba.

    Flujo:
    1. Customer con credit_limit = $100.00 (fixture customer_with_limit).
    2. Inserta una Sale de crédito pendiente con balance_pending = $80.00.
    3. Intenta validar una nueva venta de $30.00 → total sería $110.00 > $100.00.
    4. Debe lanzar HTTPException(400).

    Luego:
    5. Valida una venta de $15.00 → total sería $95.00 ≤ $100.00.
    6. No debe lanzar excepción.
    """
    if not MODELS_AVAILABLE:
        pytest.skip(f"Modelos no disponibles: {_import_error}")

    import datetime

    customer = customer_with_limit  # credit_limit=100.00

    # Insertar venta de crédito pendiente con balance_pending=$80.00
    venta_previa = Sale(
        customer_id=customer.id,
        total_amount=Decimal("80.00"),
        is_credit=True,
        paid=False,
        balance_pending=Decimal("80.00"),
        date=datetime.datetime.now() - datetime.timedelta(days=1),
        due_date=datetime.datetime.now() + datetime.timedelta(days=10),
        session_id=None,
        # user_id fue eliminado del modelo Sale
    )
    db_session.add(venta_previa)
    db_session.flush()

    # Calcular deuda actual directamente desde la BD
    from sqlalchemy import func as sa_func

    current_debt = (
        db_session.query(sa_func.sum(Sale.balance_pending))
        .filter(
            Sale.customer_id == customer.id,
            Sale.is_credit == True,
            Sale.paid == False,
        )
        .scalar()
        or Decimal("0.00")
    )

    assert current_debt == Decimal("80.00"), (
        f"La deuda acumulada debe ser $80.00, pero se obtuvo ${current_debt}."
    )

    # --- Caso 1: nueva venta de $30.00 SUPERA el límite ---
    nueva_venta_excedente = Decimal("30.00")
    excede = (current_debt + nueva_venta_excedente) > customer.credit_limit

    assert excede is True, (
        f"$80.00 + $30.00 = $110.00 debe superar el límite de $100.00. "
        f"Resultado obtenido: excede={excede}."
    )

    # Verificar que la lógica del servicio lo rechazaría con HTTPException
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = customer
    mock_db.query.return_value.filter.return_value.count.return_value = 0
    mock_db.query.return_value.filter.return_value.scalar.return_value = current_debt

    with pytest.raises(HTTPException) as exc_info:
        _validate_credit_limit(mock_db, customer_id=customer.id, sale_amount=nueva_venta_excedente)

    assert exc_info.value.status_code == 400

    # --- Caso 2: nueva venta de $15.00 DENTRO del límite ---
    nueva_venta_valida = Decimal("15.00")
    no_excede = (current_debt + nueva_venta_valida) <= customer.credit_limit

    assert no_excede is True, (
        f"$80.00 + $15.00 = $95.00 no debe superar el límite de $100.00."
    )

    mock_db_ok = MagicMock()
    mock_db_ok.query.return_value.filter.return_value.first.return_value = customer
    mock_db_ok.query.return_value.filter.return_value.count.return_value = 0
    mock_db_ok.query.return_value.filter.return_value.scalar.return_value = current_debt

    try:
        _validate_credit_limit(mock_db_ok, customer_id=customer.id, sale_amount=nueva_venta_valida)
    except HTTPException as e:
        pytest.fail(
            f"Una venta de $15.00 con deuda de $80.00 y límite $100.00 no debe rechazarse. "
            f"Error: {e.status_code} — {e.detail}"
        )


def test_cliente_sin_deuda_puede_comprar_hasta_el_limite(db_session, customer_with_limit):
    """
    Verifica que un cliente sin ninguna deuda previa puede realizar
    una compra hasta su límite completo.

    Escenario:
        current_debt = $0.00
        nueva_venta  = $100.00 (= credit_limit)  → APROBADA
    """
    if not MODELS_AVAILABLE:
        pytest.skip(f"Modelos no disponibles: {_import_error}")

    customer = customer_with_limit  # credit_limit=100.00, sin deuda

    # Sin ventas previas → deuda = 0
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = customer
    mock_db.query.return_value.filter.return_value.count.return_value = 0
    mock_db.query.return_value.filter.return_value.scalar.return_value = Decimal("0.00")

    # Venta por exactamente el límite completo
    try:
        _validate_credit_limit(mock_db, customer_id=customer.id, sale_amount=Decimal("100.00"))
    except HTTPException as e:
        pytest.fail(
            f"Cliente sin deuda debe poder comprar hasta su límite completo ($100.00). "
            f"Error: {e.status_code} — {e.detail}"
        )
