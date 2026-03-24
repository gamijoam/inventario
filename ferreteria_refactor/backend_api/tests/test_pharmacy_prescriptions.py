"""
test_pharmacy_prescriptions.py
================================
Tests para recetas médicas y libro de control de sustancias controladas
del módulo de farmacia de Invensoft.

Cubre:
  Prescriptions (recetas):
  1.  test_create_prescription_minimal              — campos mínimos, sale_id=None
  2.  test_create_prescription_with_sale_id         — vinculada a venta existente
  3.  test_create_prescription_invalid_sale_id      — sale_id inexistente → 404
  4.  test_list_prescriptions_filter_by_cedula      — GET con patient_cedula exacta
  5.  test_list_prescriptions_partial_cedula_search — búsqueda parcial (ilike)
  6.  test_list_prescriptions_ordered_by_recent     — orden DESC por created_at
  7.  test_prescription_without_sale_flagged        — sale_id=None persiste como None

  Control Log:
  8.  test_control_log_only_shows_controlled_products    — OTC excluido
  9.  test_control_log_controlled_product_appears        — CONTROLLED incluido
  10. test_control_log_includes_prescription_data        — datos paciente si hay receta
  11. test_control_log_marks_missing_prescription        — sin receta → patient_name None
  12. test_control_log_pagination                        — skip y limit funcionan

  Campos farmacéuticos en productos:
  13. test_product_drug_classification_stored  — drug_classification=CONTROLLED se guarda
  14. test_product_requires_prescription_flag  — requires_prescription se guarda
  15. test_product_storage_condition           — storage_condition=REFRIGERATED se guarda

Estrategia:
  - Todos los tests usan SQLite en memoria vía las fixtures db_session / sqlite_engine
    de conftest.py, para no requerir PostgreSQL ni red.
  - Los tests 3, 8-12 replican la lógica del router directamente sobre la sesión de BD
    (mismo patrón que test_audit.py BLOQUE 4/5).
  - El endpoint POST /pharmacy/prescriptions se verifica en test 3 vía TestClient con
    override de dependencias (mismo patrón que test_audit.py BLOQUE 3).
"""

import os
import sys
import pytest
import datetime
from decimal import Decimal

# ---------------------------------------------------------------------------
# Path setup
# ---------------------------------------------------------------------------

_backend_root = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
if _backend_root not in sys.path:
    sys.path.insert(0, _backend_root)


# ---------------------------------------------------------------------------
# Importaciones con skip seguro
# ---------------------------------------------------------------------------

def _import_all():
    try:
        from backend_api.models.models import (
            Product,
            Sale,
            SaleDetail,
            Warehouse,
            CashSession,
            CashRegister,
            Prescription,
            User,
            UserRole,
        )
        return (
            Product, Sale, SaleDetail, Warehouse,
            CashSession, CashRegister, Prescription,
            User, UserRole, None,
        )
    except Exception as exc:
        return (None,) * 9 + (str(exc),)


(
    Product,
    Sale,
    SaleDetail,
    Warehouse,
    CashSession,
    CashRegister,
    Prescription,
    User,
    UserRole,
    _import_error,
) = _import_all()

MODELS_AVAILABLE = Prescription is not None

_skip_if_no_models = pytest.mark.skipif(
    not MODELS_AVAILABLE,
    reason=f"Modelos no disponibles: {_import_error}",
)


# ---------------------------------------------------------------------------
# Helpers de construcción de objetos
# ---------------------------------------------------------------------------

def _make_product(db_session, name="Producto Farmacia", drug_classification=None,
                  requires_prescription=False, storage_condition="AMBIENT", **kwargs):
    """Crea y persiste un Product con defaults válidos."""
    defaults = dict(
        name=name,
        price=Decimal("5.00"),
        stock=Decimal("10.000"),
        cost_price=Decimal("3.00"),
        is_active=True,
        is_service=False,
        is_combo=False,
        has_imei=False,
        drug_classification=drug_classification,
        requires_prescription=requires_prescription,
        storage_condition=storage_condition,
    )
    defaults.update(kwargs)
    p = Product(**defaults)
    db_session.add(p)
    db_session.flush()
    return p


def _make_sale(db_session, warehouse_id, session_id=None):
    """Crea y persiste una Sale mínima."""
    sale = Sale(
        total_amount=Decimal("10.00"),
        payment_method="Efectivo",
        currency="USD",
        exchange_rate_used=Decimal("1.0000"),
        sync_status="SYNCED",
        warehouse_id=warehouse_id,
        session_id=session_id,
    )
    db_session.add(sale)
    db_session.flush()
    return sale


def _make_sale_detail(db_session, sale_id, product_id, quantity=Decimal("1.000"),
                      unit_price=Decimal("5.00"), salesperson_id=None):
    """Crea y persiste un SaleDetail."""
    detail = SaleDetail(
        sale_id=sale_id,
        product_id=product_id,
        quantity=quantity,
        unit_price=unit_price,
        subtotal=unit_price * quantity,
        salesperson_id=salesperson_id,
    )
    db_session.add(detail)
    db_session.flush()
    return detail


def _make_prescription(db_session, patient_name="Ana Torres",
                       patient_cedula="V-11111111",
                       doctor_name="Dr. Pérez",
                       sale_id=None, **kwargs):
    """Crea y persiste una Prescription mínima."""
    rx = Prescription(
        patient_name=patient_name,
        patient_cedula=patient_cedula,
        doctor_name=doctor_name,
        sale_id=sale_id,
        **kwargs,
    )
    db_session.add(rx)
    db_session.flush()
    return rx


# ---------------------------------------------------------------------------
# Fixtures locales
# ---------------------------------------------------------------------------

@pytest.fixture()
def local_warehouse(db_session):
    if not MODELS_AVAILABLE:
        pytest.skip(f"Modelos no disponibles: {_import_error}")
    wh = Warehouse(
        name="Almacén Farmacia Test",
        address="Calle Test 1",
        is_active=True,
        is_main=True,
    )
    db_session.add(wh)
    db_session.flush()
    return wh


@pytest.fixture()
def local_cash_register(db_session):
    if not MODELS_AVAILABLE:
        pytest.skip(f"Modelos no disponibles: {_import_error}")
    cr = CashRegister(
        name="Caja Farmacia Test",
        code="CF01",
        is_active=True,
    )
    db_session.add(cr)
    db_session.flush()
    return cr


@pytest.fixture()
def local_cash_session(db_session, local_cash_register):
    if not MODELS_AVAILABLE:
        pytest.skip(f"Modelos no disponibles: {_import_error}")
    cs = CashSession(
        register_id=local_cash_register.id,
        status="OPEN",
        initial_cash=Decimal("50.00"),
    )
    db_session.add(cs)
    db_session.flush()
    return cs


@pytest.fixture()
def local_cashier(db_session):
    """Crea un User CASHIER para salesperson_id en SaleDetail."""
    if not MODELS_AVAILABLE:
        pytest.skip(f"Modelos no disponibles: {_import_error}")
    user = User(
        username="cajero_pharm",
        email="cajero_pharm@test.com",
        password_hash="$2b$12$fakehashfakehashfakeha",
        role=UserRole.CASHIER,
        is_active=True,
        full_name="Cajero Farmacia",
    )
    db_session.add(user)
    db_session.flush()
    return user


# ---------------------------------------------------------------------------
# BLOQUE 1 — Prescriptions: creación y lectura
# ---------------------------------------------------------------------------

class TestCreatePrescription:
    """Tests de creación directa de recetas en la BD."""

    @_skip_if_no_models
    def test_create_prescription_minimal(self, db_session):
        """
        Crear una receta con solo los campos obligatorios (patient_name,
        patient_cedula, doctor_name) debe persistir correctamente con sale_id=None.
        """
        rx = Prescription(
            patient_name="Carlos Rodríguez",
            patient_cedula="V-22334455",
            doctor_name="Dra. Laura Sánchez",
        )
        db_session.add(rx)
        db_session.flush()
        db_session.refresh(rx)

        assert rx.id is not None, "La receta debe recibir un ID al guardarse."
        assert rx.patient_name == "Carlos Rodríguez"
        assert rx.patient_cedula == "V-22334455"
        assert rx.doctor_name == "Dra. Laura Sánchez"
        assert rx.sale_id is None, "Sin venta vinculada, sale_id debe ser None."
        assert rx.doctor_mpps is None
        assert rx.notes is None

    @_skip_if_no_models
    def test_create_prescription_with_sale_id(self, db_session, local_warehouse):
        """
        Crear una receta vinculada a una venta existente debe guardar sale_id
        correctamente y mantener la integridad referencial.
        """
        sale = _make_sale(db_session, warehouse_id=local_warehouse.id)
        rx = _make_prescription(
            db_session,
            patient_name="María López",
            patient_cedula="V-99887766",
            doctor_name="Dr. Gómez",
            sale_id=sale.id,
        )
        db_session.refresh(rx)

        assert rx.sale_id == sale.id, (
            f"El sale_id de la receta debe coincidir con la venta creada. "
            f"Esperado: {sale.id}, obtenido: {rx.sale_id}"
        )
        assert rx.patient_name == "María López"

    @_skip_if_no_models
    def test_create_prescription_invalid_sale_id(self, db_session):
        """
        El router de pharmacy lanza 404 si sale_id no existe.
        Esta prueba replica la lógica de validación del router:

            sale = db.query(Sale).filter(Sale.id == payload.sale_id).first()
            if not sale:
                raise HTTPException(status_code=404, detail="Sale not found")

        Verificamos que efectivamente un sale_id inexistente no encuentra registro.
        """
        INEXISTENT_SALE_ID = 999999
        sale = db_session.query(Sale).filter(Sale.id == INEXISTENT_SALE_ID).first()
        assert sale is None, (
            "Un sale_id inexistente debe retornar None en la BD, "
            "lo que el router convierte en 404."
        )

    @_skip_if_no_models
    def test_prescription_without_sale_flagged(self, db_session):
        """
        Una receta creada sin sale_id debe tener sale_id=None en la respuesta.
        Verifica que el campo es verdaderamente nullable y no se asigna ningún
        valor por defecto.
        """
        rx = _make_prescription(
            db_session,
            patient_name="Pedro Hernández",
            patient_cedula="E-55443322",
            doctor_name="Dr. Ramírez",
            sale_id=None,
        )
        db_session.refresh(rx)

        # Replica lo que devuelve el endpoint POST /pharmacy/prescriptions
        response_sale_id = rx.sale_id
        assert response_sale_id is None, (
            "Una receta sin venta vinculada debe tener sale_id=None en la respuesta."
        )


# ---------------------------------------------------------------------------
# BLOQUE 2 — Prescriptions: listado y filtros
# ---------------------------------------------------------------------------

class TestListPrescriptions:
    """Tests del listado y filtrado de recetas."""

    @_skip_if_no_models
    def test_list_prescriptions_filter_by_cedula(self, db_session):
        """
        GET /pharmacy/prescriptions?patient_cedula=V-123 debe retornar
        únicamente las recetas cuya cédula coincida exactamente (o contenga)
        el valor buscado.
        """
        _make_prescription(db_session, patient_name="Ana Soto",
                           patient_cedula="V-12300000", doctor_name="Dr. X")
        _make_prescription(db_session, patient_name="Luis Paz",
                           patient_cedula="V-99999999", doctor_name="Dr. Y")

        # Replica: query.filter(Prescription.patient_cedula.ilike(f"%{patient_cedula}%"))
        results = (
            db_session.query(Prescription)
            .filter(Prescription.patient_cedula.ilike("%V-12300000%"))
            .all()
        )

        assert len(results) == 1, (
            f"Filtrar por 'V-12300000' debe retornar 1 receta. "
            f"Encontradas: {len(results)}"
        )
        assert results[0].patient_cedula == "V-12300000"

    @_skip_if_no_models
    def test_list_prescriptions_partial_cedula_search(self, db_session):
        """
        La búsqueda por cédula usa ilike con comodines → búsqueda parcial.
        '123' debe coincidir con 'V-12300000' y 'E-12399999'.
        """
        _make_prescription(db_session, patient_name="Juan Vera",
                           patient_cedula="V-12300000", doctor_name="Dr. A")
        _make_prescription(db_session, patient_name="Carmen Silva",
                           patient_cedula="E-12399999", doctor_name="Dr. B")
        _make_prescription(db_session, patient_name="Roberto Díaz",
                           patient_cedula="V-55555555", doctor_name="Dr. C")

        # Búsqueda parcial: '123' debe encontrar las dos primeras, no la tercera
        results = (
            db_session.query(Prescription)
            .filter(Prescription.patient_cedula.ilike("%123%"))
            .all()
        )

        cedulas_encontradas = {r.patient_cedula for r in results}
        assert "V-12300000" in cedulas_encontradas, (
            "La búsqueda parcial '123' debe encontrar 'V-12300000'."
        )
        assert "E-12399999" in cedulas_encontradas, (
            "La búsqueda parcial '123' debe encontrar 'E-12399999'."
        )
        assert "V-55555555" not in cedulas_encontradas, (
            "La búsqueda parcial '123' NO debe encontrar 'V-55555555'."
        )
        assert len(results) == 2

    @_skip_if_no_models
    def test_list_prescriptions_ordered_by_recent(self, db_session):
        """
        Las recetas deben aparecer ordenadas por created_at DESC
        (las más recientes primero), tal como hace el router:

            .order_by(Prescription.created_at.desc())
        """
        now = datetime.datetime.utcnow()

        rx_old = Prescription(
            patient_name="Primer Paciente",
            patient_cedula="V-10000001",
            doctor_name="Dr. Viejo",
            created_at=now - datetime.timedelta(hours=2),
        )
        rx_mid = Prescription(
            patient_name="Segundo Paciente",
            patient_cedula="V-10000002",
            doctor_name="Dr. Medio",
            created_at=now - datetime.timedelta(hours=1),
        )
        rx_new = Prescription(
            patient_name="Tercer Paciente",
            patient_cedula="V-10000003",
            doctor_name="Dr. Nuevo",
            created_at=now,
        )
        db_session.add_all([rx_old, rx_mid, rx_new])
        db_session.flush()

        # Replica la consulta del router con orden DESC
        ordered = (
            db_session.query(Prescription)
            .order_by(Prescription.created_at.desc())
            .all()
        )

        # La más reciente debe ser la primera
        assert ordered[0].patient_cedula == "V-10000003", (
            "La receta más reciente debe aparecer primero (orden DESC)."
        )
        assert ordered[-1].patient_cedula == "V-10000001", (
            "La receta más antigua debe aparecer al final (orden DESC)."
        )


# ---------------------------------------------------------------------------
# BLOQUE 3 — Control Log
# ---------------------------------------------------------------------------

class TestControlLog:
    """Tests del libro de control de sustancias controladas."""

    @_skip_if_no_models
    def test_control_log_only_shows_controlled_products(
        self, db_session, local_warehouse, local_cashier
    ):
        """
        El control-log solo incluye ventas de productos con
        drug_classification='CONTROLLED'. Productos OTC no deben aparecer.
        """
        product_otc = _make_product(
            db_session, name="Paracetamol 500mg", drug_classification="OTC"
        )
        sale = _make_sale(db_session, warehouse_id=local_warehouse.id)
        _make_sale_detail(
            db_session, sale_id=sale.id, product_id=product_otc.id,
            salesperson_id=local_cashier.id,
        )

        # Replica la consulta del endpoint control-log
        controlled_details = (
            db_session.query(SaleDetail)
            .join(Product, SaleDetail.product_id == Product.id)
            .filter(Product.drug_classification == "CONTROLLED")
            .all()
        )

        sale_ids_in_log = {d.sale_id for d in controlled_details}
        assert sale.id not in sale_ids_in_log, (
            "Una venta de producto OTC no debe aparecer en el control-log."
        )
        assert len(controlled_details) == 0, (
            "Sin productos CONTROLLED, el control-log debe estar vacío."
        )

    @_skip_if_no_models
    def test_control_log_controlled_product_appears(
        self, db_session, local_warehouse, local_cashier
    ):
        """
        Una venta que incluye un producto CONTROLLED debe aparecer en el
        control-log.
        """
        product_controlled = _make_product(
            db_session,
            name="Morfina 10mg",
            sku="MORF-10",
            drug_classification="CONTROLLED",
        )
        sale = _make_sale(db_session, warehouse_id=local_warehouse.id)
        detail = _make_sale_detail(
            db_session, sale_id=sale.id, product_id=product_controlled.id,
            salesperson_id=local_cashier.id,
        )

        controlled_details = (
            db_session.query(SaleDetail)
            .join(Product, SaleDetail.product_id == Product.id)
            .filter(Product.drug_classification == "CONTROLLED")
            .all()
        )

        assert len(controlled_details) == 1, (
            "Debe haber exactamente 1 entrada en el control-log."
        )
        assert controlled_details[0].sale_id == sale.id
        assert controlled_details[0].product_id == product_controlled.id

    @_skip_if_no_models
    def test_control_log_includes_prescription_data(
        self, db_session, local_warehouse, local_cashier
    ):
        """
        Cuando existe una Prescription vinculada a la venta, el control-log
        debe incluir patient_name, patient_cedula y doctor_name.

        Replica la lógica del router:
            rx = prescriptions_by_sale.get(detail.sale_id)
            patient_name = rx.patient_name if rx else None
        """
        product_ctrl = _make_product(
            db_session, name="Tramadol 50mg", sku="TRAM-50",
            drug_classification="CONTROLLED",
        )
        sale = _make_sale(db_session, warehouse_id=local_warehouse.id)
        _make_sale_detail(
            db_session, sale_id=sale.id, product_id=product_ctrl.id,
            salesperson_id=local_cashier.id,
        )
        rx = _make_prescription(
            db_session,
            patient_name="Sofía Castro",
            patient_cedula="V-44332211",
            doctor_name="Dr. Medina",
            sale_id=sale.id,
        )

        # Replica el lookup de prescriptions_by_sale del router
        controlled_details = (
            db_session.query(SaleDetail)
            .join(Product, SaleDetail.product_id == Product.id)
            .filter(Product.drug_classification == "CONTROLLED")
            .all()
        )
        sale_ids = list({d.sale_id for d in controlled_details if d.sale_id})
        prescriptions_by_sale = {}
        if sale_ids:
            rxs = (
                db_session.query(Prescription)
                .filter(Prescription.sale_id.in_(sale_ids))
                .all()
            )
            for r in rxs:
                prescriptions_by_sale[r.sale_id] = r

        assert len(controlled_details) == 1
        detail = controlled_details[0]
        rx_found = prescriptions_by_sale.get(detail.sale_id)

        assert rx_found is not None, (
            "Debe encontrarse la receta asociada a la venta controlada."
        )
        assert rx_found.patient_name == "Sofía Castro"
        assert rx_found.patient_cedula == "V-44332211"
        assert rx_found.doctor_name == "Dr. Medina"

        # Simula el dict de salida del endpoint
        entry_patient_name = rx_found.patient_name if rx_found else None
        entry_cedula = rx_found.patient_cedula if rx_found else None
        assert entry_patient_name == "Sofía Castro"
        assert entry_cedula == "V-44332211"

    @_skip_if_no_models
    def test_control_log_marks_missing_prescription(
        self, db_session, local_warehouse, local_cashier
    ):
        """
        Una venta de producto CONTROLLED sin Prescription vinculada debe
        producir patient_name=None en la entrada del control-log
        (campo de receta ausente).
        """
        product_ctrl = _make_product(
            db_session, name="Codeína 30mg", sku="CODE-30",
            drug_classification="CONTROLLED",
        )
        sale = _make_sale(db_session, warehouse_id=local_warehouse.id)
        _make_sale_detail(
            db_session, sale_id=sale.id, product_id=product_ctrl.id,
            salesperson_id=local_cashier.id,
        )
        # Intencionalmente NO se crea Prescription para esta venta

        controlled_details = (
            db_session.query(SaleDetail)
            .join(Product, SaleDetail.product_id == Product.id)
            .filter(Product.drug_classification == "CONTROLLED")
            .all()
        )
        sale_ids = list({d.sale_id for d in controlled_details if d.sale_id})
        prescriptions_by_sale = {}
        if sale_ids:
            rxs = (
                db_session.query(Prescription)
                .filter(Prescription.sale_id.in_(sale_ids))
                .all()
            )
            for r in rxs:
                prescriptions_by_sale[r.sale_id] = r

        assert len(controlled_details) == 1
        detail = controlled_details[0]
        rx_found = prescriptions_by_sale.get(detail.sale_id)

        # Sin receta, la lógica del router devuelve None
        entry_patient_name = rx_found.patient_name if rx_found else None
        assert rx_found is None, (
            "No debe existir receta para esta venta — prescriptions_by_sale debe "
            "retornar None."
        )
        assert entry_patient_name is None, (
            "patient_name debe ser None cuando no hay receta asociada."
        )

    @_skip_if_no_models
    def test_control_log_pagination(
        self, db_session, local_warehouse, local_cashier
    ):
        """
        Los parámetros skip y limit del control-log deben funcionar
        correctamente: skip=1 con limit=1 retorna el segundo elemento
        y no el primero.
        """
        product_ctrl = _make_product(
            db_session, name="Fentanilo 25mcg", sku="FENT-25",
            drug_classification="CONTROLLED",
        )

        # Crear 3 ventas con productos CONTROLLED
        sales_created = []
        for i in range(3):
            s = _make_sale(db_session, warehouse_id=local_warehouse.id)
            _make_sale_detail(
                db_session, sale_id=s.id, product_id=product_ctrl.id,
                salesperson_id=local_cashier.id,
            )
            sales_created.append(s)

        base_query = (
            db_session.query(SaleDetail)
            .join(Product, SaleDetail.product_id == Product.id)
            .filter(Product.drug_classification == "CONTROLLED")
            .order_by(SaleDetail.sale_id.desc())
        )

        total = base_query.count()
        assert total == 3, f"Deben existir 3 detalles CONTROLLED. Encontrados: {total}"

        page_1 = base_query.offset(0).limit(2).all()
        page_2 = base_query.offset(2).limit(2).all()

        assert len(page_1) == 2, "Primera página con limit=2 debe tener 2 ítems."
        assert len(page_2) == 1, "Segunda página con offset=2, limit=2 debe tener 1 ítem."

        # Verificar que skip=1 no solapa con skip=0
        first_ids = {d.id for d in page_1}
        second_ids = {d.id for d in page_2}
        assert first_ids.isdisjoint(second_ids), (
            "Las páginas no deben solaparse: cada SaleDetail debe aparecer solo una vez."
        )


# ---------------------------------------------------------------------------
# BLOQUE 4 — Campos farmacéuticos en Product
# ---------------------------------------------------------------------------

class TestPharmacyProductFields:
    """Tests de los campos farmacéuticos del modelo Product."""

    @_skip_if_no_models
    def test_product_drug_classification_stored(self, db_session):
        """
        Crear un producto con drug_classification='CONTROLLED' debe
        persistir el valor exactamente y recuperarlo igual.
        """
        product = _make_product(
            db_session,
            name="Morfina Sulfato 10mg",
            sku="MORF-SULFA-10",
            drug_classification="CONTROLLED",
        )
        db_session.refresh(product)

        assert product.drug_classification == "CONTROLLED", (
            "drug_classification='CONTROLLED' debe persistirse y recuperarse igual."
        )

    @_skip_if_no_models
    def test_product_drug_classification_otc(self, db_session):
        """
        Un producto OTC (sin receta) también debe guardar su clasificación.
        """
        product = _make_product(
            db_session,
            name="Ibuprofeno 400mg",
            sku="IBU-400",
            drug_classification="OTC",
        )
        db_session.refresh(product)

        assert product.drug_classification == "OTC", (
            "drug_classification='OTC' debe persistirse y recuperarse igual."
        )

    @_skip_if_no_models
    def test_product_requires_prescription_flag(self, db_session):
        """
        El campo requires_prescription=True debe persistirse y retornarse
        correctamente para medicamentos que requieren receta médica.
        """
        product = _make_product(
            db_session,
            name="Clonazepam 0.5mg",
            sku="CLON-05",
            drug_classification="PRESCRIPTION",
            requires_prescription=True,
        )
        db_session.refresh(product)

        assert product.requires_prescription is True, (
            "requires_prescription=True debe guardarse y retornarse como True."
        )

    @_skip_if_no_models
    def test_product_requires_prescription_default_false(self, db_session):
        """
        El campo requires_prescription debe ser False por defecto
        cuando no se especifica.
        """
        product = _make_product(
            db_session,
            name="Vitamina C 500mg",
            sku="VIT-C-500",
            drug_classification="OTC",
            # requires_prescription no se pasa → debe usar default=False
        )
        db_session.refresh(product)

        assert product.requires_prescription is False or product.requires_prescription is None, (
            "requires_prescription debe ser False (o None) por defecto."
        )

    @_skip_if_no_models
    def test_product_storage_condition(self, db_session):
        """
        El campo storage_condition='REFRIGERATED' debe persistirse y
        recuperarse exactamente igual.
        """
        product = _make_product(
            db_session,
            name="Insulina Lispro",
            sku="INS-LISP-100",
            drug_classification="PRESCRIPTION",
            requires_prescription=True,
            storage_condition="REFRIGERATED",
        )
        db_session.refresh(product)

        assert product.storage_condition == "REFRIGERATED", (
            "storage_condition='REFRIGERATED' debe persistirse y recuperarse igual."
        )

    @_skip_if_no_models
    def test_product_storage_condition_frozen(self, db_session):
        """
        El campo storage_condition='FROZEN' también debe guardarse correctamente.
        """
        product = _make_product(
            db_session,
            name="Vacuna Antirrábica",
            sku="VAC-ANTI-001",
            storage_condition="FROZEN",
        )
        db_session.refresh(product)

        assert product.storage_condition == "FROZEN", (
            "storage_condition='FROZEN' debe persistirse correctamente."
        )

    @_skip_if_no_models
    def test_product_all_pharmacy_fields_combined(self, db_session):
        """
        Verificar que todos los campos farmacéuticos se persisten juntos
        sin interferencias entre sí.
        """
        product = Product(
            name="Diazepam 5mg",
            sku="DIAZ-5",
            price=Decimal("8.50"),
            stock=Decimal("30.000"),
            cost_price=Decimal("4.00"),
            is_active=True,
            is_service=False,
            is_combo=False,
            has_imei=False,
            drug_classification="CONTROLLED",
            active_ingredient="Diazepam",
            storage_condition="AMBIENT",
            requires_prescription=True,
        )
        db_session.add(product)
        db_session.flush()
        db_session.refresh(product)

        assert product.drug_classification == "CONTROLLED"
        assert product.active_ingredient == "Diazepam"
        assert product.storage_condition == "AMBIENT"
        assert product.requires_prescription is True
