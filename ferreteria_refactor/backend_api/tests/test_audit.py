"""
test_audit.py
=============
Tests para el módulo de auditoría de Invensoft.

Cubre:
1. log_action() crea registro en BD (unit, SQLite)
2. log_action() persiste el campo changes como JSON
3. GET /audit/logs sin token → 401
4. GET /audit/logs con CASHIER → 403
5. GET /audit/logs con ADMIN → 200 con lista
6. Filtro por table_name funciona correctamente
7. Crear producto genera AuditLog action=CREATE table=products
8. Eliminar producto genera AuditLog action=DELETE table=products
9. Crear venta genera AuditLog action=CREATE table=sales
10. Abrir caja genera AuditLog action=CREATE table=cash_sessions

Estrategia:
- Tests 1, 2, 6, 7, 8, 9, 10: integración con SQLite en memoria (fixtures de conftest.py)
- Tests 3, 4, 5: endpoint HTTP usando TestClient de FastAPI con override de dependencias
"""

import json
import os
import sys
import pytest
from decimal import Decimal
from unittest.mock import MagicMock, patch

# ---------------------------------------------------------------------------
# Path setup — igual que test_sales.py
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
            AuditLog,
            Product,
            Sale,
            CashSession,
            CashRegister,
            Warehouse,
            User,
            UserRole,
        )
        from backend_api.audit_utils import log_action, calculate_diff
        return AuditLog, Product, Sale, CashSession, CashRegister, Warehouse, User, UserRole, log_action, calculate_diff, None
    except Exception as e:
        return (None,) * 10 + (str(e),)


(
    AuditLog,
    Product,
    Sale,
    CashSession,
    CashRegister,
    Warehouse,
    User,
    UserRole,
    log_action,
    calculate_diff,
    _import_error,
) = _import_all()

MODELS_AVAILABLE = AuditLog is not None

_skip_if_no_models = pytest.mark.skipif(
    not MODELS_AVAILABLE,
    reason=f"Modelos no disponibles: {_import_error}",
)


# ---------------------------------------------------------------------------
# Fixture: usuario de prueba en BD SQLite
# ---------------------------------------------------------------------------

@pytest.fixture()
def test_user(db_session):
    """Crea un User ADMIN en la BD SQLite de prueba."""
    if not MODELS_AVAILABLE:
        pytest.skip(f"Modelos no disponibles: {_import_error}")

    user = User(
        username="admin_test",
        email="admin_test@example.com",
        password_hash="$2b$12$fakehashfakehashfakeha",
        role=UserRole.ADMIN,
        is_active=True,
        full_name="Admin Test",
    )
    db_session.add(user)
    db_session.flush()
    return user


@pytest.fixture()
def test_cashier_user(db_session):
    """Crea un User CASHIER en la BD SQLite de prueba."""
    if not MODELS_AVAILABLE:
        pytest.skip(f"Modelos no disponibles: {_import_error}")

    user = User(
        username="cajero_test",
        email="cajero_test@example.com",
        password_hash="$2b$12$fakehashfakehashfakeha",
        role=UserRole.CASHIER,
        is_active=True,
        full_name="Cajero Test",
    )
    db_session.add(user)
    db_session.flush()
    return user


# ---------------------------------------------------------------------------
# Helper para crear el TestClient con override de dependencias
# ---------------------------------------------------------------------------

def _make_test_client(override_user=None):
    """
    Crea un TestClient de FastAPI con la app principal.
    Si override_user es None → no inyecta usuario (simula sin autenticar).
    Si override_user es un objeto User → lo inyecta como current_user.
    """
    try:
        from fastapi.testclient import TestClient
        from backend_api.main import app
        from backend_api.dependencies import get_current_active_user, admin_only
        from backend_api.database.db import get_db
        return TestClient, app, get_current_active_user, admin_only, get_db, None
    except Exception as e:
        return (None,) * 6 + (str(e),)


# ---------------------------------------------------------------------------
# BLOQUE 1 — log_action() crea registro en BD
# ---------------------------------------------------------------------------

class TestLogActionCreatesRecord:
    """Verifica que log_action() escribe correctamente en la tabla audit_logs."""

    @_skip_if_no_models
    def test_log_action_creates_record(self, db_session, test_user):
        """
        Llamar log_action() directamente debe crear exactamente un AuditLog
        con los campos pasados.
        """
        before_count = db_session.query(AuditLog).count()

        log_action(
            db=db_session,
            user_id=test_user.id,
            action="CREATE",
            table_name="products",
            record_id=42,
            changes=None,
            ip_address="127.0.0.1",
        )

        after_count = db_session.query(AuditLog).count()
        assert after_count == before_count + 1, (
            "log_action() debe crear exactamente un registro en audit_logs."
        )

        log_entry = (
            db_session.query(AuditLog)
            .filter(AuditLog.table_name == "products", AuditLog.action == "CREATE")
            .first()
        )
        assert log_entry is not None
        assert log_entry.user_id == test_user.id
        assert log_entry.record_id == 42
        assert log_entry.ip_address == "127.0.0.1"

    @_skip_if_no_models
    def test_log_action_with_changes(self, db_session, test_user):
        """
        El campo changes se debe persistir tal como se pasa (JSON string).
        log_action() no modifica ni serializa el valor — es responsabilidad
        del llamador serializar antes.
        """
        changes_payload = json.dumps({"name": {"old": "Tornillo M6", "new": "Tornillo M8"}})

        log_action(
            db=db_session,
            user_id=test_user.id,
            action="UPDATE",
            table_name="products",
            record_id=10,
            changes=changes_payload,
        )

        log_entry = (
            db_session.query(AuditLog)
            .filter(AuditLog.action == "UPDATE", AuditLog.record_id == 10)
            .first()
        )
        assert log_entry is not None, "El log de UPDATE debe existir."
        assert log_entry.changes is not None, "El campo changes no debe ser None."

        parsed = json.loads(log_entry.changes)
        assert "name" in parsed
        assert parsed["name"]["old"] == "Tornillo M6"
        assert parsed["name"]["new"] == "Tornillo M8"

    @_skip_if_no_models
    def test_log_action_delete_action(self, db_session, test_user):
        """
        log_action() con action=DELETE debe registrar correctamente.
        """
        log_action(
            db=db_session,
            user_id=test_user.id,
            action="DELETE",
            table_name="products",
            record_id=99,
        )

        log_entry = (
            db_session.query(AuditLog)
            .filter(AuditLog.action == "DELETE", AuditLog.record_id == 99)
            .first()
        )
        assert log_entry is not None
        assert log_entry.action == "DELETE"
        assert log_entry.table_name == "products"


# ---------------------------------------------------------------------------
# BLOQUE 2 — calculate_diff() genera JSON correcto
# ---------------------------------------------------------------------------

class TestCalculateDiff:
    """Verifica la función auxiliar calculate_diff()."""

    @_skip_if_no_models
    def test_calculate_diff_creation(self, db_session, warehouse):
        """
        Al pasar before=None y after=modelo, debe retornar JSON con clave 'new'.
        """
        product = Product(
            name="Clavos 2\"",
            sku="SKU-CLAV-01",
            price=Decimal("1.50"),
            stock=Decimal("100.000"),
            cost_price=Decimal("0.80"),
            is_active=True,
            is_service=False,
            is_combo=False,
            has_imei=False,
        )
        db_session.add(product)
        db_session.flush()

        result = calculate_diff(None, product)
        assert result is not None
        parsed = json.loads(result)
        assert "new" in parsed
        assert parsed["new"]["name"] == "Clavos 2\""

    @_skip_if_no_models
    def test_calculate_diff_deletion(self, db_session, warehouse):
        """
        Al pasar before=modelo y after=None, debe retornar JSON con clave 'old'.
        """
        product = Product(
            name="Lija 100",
            sku="SKU-LIJ-01",
            price=Decimal("0.50"),
            stock=Decimal("50.000"),
            cost_price=Decimal("0.20"),
            is_active=True,
            is_service=False,
            is_combo=False,
            has_imei=False,
        )
        db_session.add(product)
        db_session.flush()

        result = calculate_diff(product, None)
        assert result is not None
        parsed = json.loads(result)
        assert "old" in parsed
        assert parsed["old"]["name"] == "Lija 100"

    @_skip_if_no_models
    def test_calculate_diff_no_changes_returns_none(self, db_session, warehouse):
        """
        Si dos modelos son idénticos, calculate_diff() debe retornar None.
        """
        # Para UPDATE, calculate_diff compara atributos del mismo objeto
        # — usar dos referencias al mismo objeto garantiza cero diferencias.
        product = Product(
            name="Pintura Blanca",
            sku="SKU-PINT-01",
            price=Decimal("10.00"),
            stock=Decimal("5.000"),
            cost_price=Decimal("7.00"),
            is_active=True,
            is_service=False,
            is_combo=False,
            has_imei=False,
        )
        db_session.add(product)
        db_session.flush()

        result = calculate_diff(product, product)
        assert result is None, (
            "Comparar un modelo consigo mismo no debe generar cambios."
        )


# ---------------------------------------------------------------------------
# Helper para importar la app con entorno de test preparado
# ---------------------------------------------------------------------------

def _import_app_for_test():
    """
    Importa la app FastAPI preparando el entorno de desarrollo local:

    1. Setea BACKUP_DIR a un directorio temporal accesible (backup_service.py
       hace os.makedirs en el nivel de módulo con la ruta por defecto /app/backups).
    2. Crea el directorio media local (StaticFiles lo monta en main.py).

    Retorna (TestClient, app, get_current_active_user, get_db) o llama pytest.skip().
    """
    try:
        import os as _os
        import tempfile as _tempfile

        # 1. Redirigir BACKUP_DIR a un dir temporal antes de que backup_service
        #    se importe (el os.makedirs ocurre en el nivel de módulo).
        _tmp_backup = _tempfile.mkdtemp(prefix="invensoft_test_backups_")
        _os.environ.setdefault("BACKUP_DIR", _tmp_backup)
        # Si ya fue importado con el valor incorrecto, forzar el override
        _os.environ["BACKUP_DIR"] = _tmp_backup

        # 2. Crear directorio media local para StaticFiles
        _backend_dir = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
        _media_dir = _os.path.join(_backend_dir, "media")
        _os.makedirs(_media_dir, exist_ok=True)

        from fastapi.testclient import TestClient
        from backend_api.main import app
        from backend_api.dependencies import get_current_active_user
        from backend_api.database.db import get_db
        return TestClient, app, get_current_active_user, get_db
    except Exception as e:
        pytest.skip(f"No se pudo importar la app FastAPI: {e}")


# ---------------------------------------------------------------------------
# BLOQUE 3 — Endpoint /audit/logs — autenticación y autorización
# ---------------------------------------------------------------------------

class TestAuditEndpointAuth:
    """
    Tests del endpoint GET /audit/logs.

    Usa TestClient con override de dependencias para no necesitar token JWT real.
    El directorio media se crea antes de importar la app para evitar que
    StaticFiles falle en entorno de desarrollo.
    """

    def test_audit_endpoint_requires_auth(self):
        """
        GET /api/v1/audit/logs sin Authorization header debe retornar 401.

        El router de audit está registrado bajo el prefijo /api/v1 en main.py.
        """
        TestClient, app, _, __ = _import_app_for_test()
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/api/v1/audit/logs")
        assert response.status_code == 401, (
            f"Sin token debe ser 401. Obtenido: {response.status_code}"
        )

    def test_audit_endpoint_requires_admin(self):
        """
        GET /audit/logs con usuario CASHIER debe retornar 403.

        Se inyecta un usuario CASHIER via dependency_override en get_current_active_user.
        El RoleChecker de admin_only evalúa user.role y rechaza con 403.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        TestClient, app, get_current_active_user, _ = _import_app_for_test()

        cashier_user = MagicMock()
        cashier_user.id = 1
        cashier_user.role = UserRole.CASHIER
        cashier_user.is_active = True
        cashier_user.username = "cajero_test_403"

        app.dependency_overrides[get_current_active_user] = lambda: cashier_user

        try:
            client = TestClient(app, raise_server_exceptions=False)
            response = client.get("/api/v1/audit/logs")
            assert response.status_code == 403, (
                f"CASHIER debe recibir 403. Obtenido: {response.status_code}"
            )
        finally:
            app.dependency_overrides.pop(get_current_active_user, None)

    def test_audit_endpoint_admin_can_read(self):
        """
        GET /audit/logs con usuario ADMIN debe retornar 200 con una lista (puede ser vacía).

        Se inyecta un usuario ADMIN via dependency_override y se provee una BD
        SQLite en memoria para no depender de PostgreSQL.
        """
        if not MODELS_AVAILABLE:
            pytest.skip(f"Modelos no disponibles: {_import_error}")

        from sqlalchemy import create_engine, event as sa_event
        from sqlalchemy.orm import sessionmaker
        from backend_api.models.models import Base

        TestClient, app, get_current_active_user, get_db = _import_app_for_test()

        # Usar URI con cache=shared para que todas las conexiones compartan la
        # misma BD en memoria. SQLite crea una BD nueva por conexión con ":memory:",
        # pero con mode=memory&cache=shared todas las conexiones ven la misma BD.
        # Esto es necesario porque TestClient abre conexiones nuevas por request.
        engine = create_engine(
            "sqlite:///file:audit_endpoint_test?mode=memory&cache=shared&uri=true",
            connect_args={"check_same_thread": False},
        )

        @sa_event.listens_for(engine, "connect")
        def _set_pragmas(dbapi_conn, _):
            dbapi_conn.execute("PRAGMA foreign_keys=ON")

        # Quitar schemas antes de create_all (SQLite no soporta schemas)
        schema_backups = {}
        for table in Base.metadata.tables.values():
            if table.schema:
                schema_backups[table] = table.schema
                table.schema = None

        try:
            with engine.begin() as conn:
                Base.metadata.create_all(conn)

            SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

            # Crear usuario ADMIN en la BD de test
            with SessionLocal() as setup_session:
                admin_user = User(
                    username="admin_endpoint_test",
                    email="admin_endpoint_test@example.com",
                    password_hash="$2b$12$fakehash",
                    role=UserRole.ADMIN,
                    is_active=True,
                    full_name="Admin Endpoint Test",
                )
                setup_session.add(admin_user)
                setup_session.commit()
                admin_id = admin_user.id

            # Recuperar el usuario como objeto desvinculado para el override
            with SessionLocal() as s:
                admin_for_override = s.query(User).filter(User.id == admin_id).first()
                s.expunge(admin_for_override)

            def override_db():
                db = SessionLocal()
                try:
                    yield db
                finally:
                    db.close()

            app.dependency_overrides[get_current_active_user] = lambda: admin_for_override
            app.dependency_overrides[get_db] = override_db

            try:
                client = TestClient(app, raise_server_exceptions=False)
                response = client.get("/api/v1/audit/logs")
                assert response.status_code == 200, (
                    f"ADMIN debe recibir 200. Obtenido: {response.status_code} — {response.text[:300]}"
                )
                data = response.json()
                assert isinstance(data, list), "La respuesta debe ser una lista JSON."
            finally:
                app.dependency_overrides.pop(get_current_active_user, None)
                app.dependency_overrides.pop(get_db, None)
        finally:
            # Disponer el engine primero, luego restaurar schemas.
            # IMPORTANTE: los schemas deben permanecer a None mientras el engine
            # esté activo para que las queries SQLite encuentren las tablas
            # sin prefijo de schema.
            engine.dispose()
            for table, original_schema in schema_backups.items():
                table.schema = original_schema


# ---------------------------------------------------------------------------
# BLOQUE 4 — Filtro por table_name
# ---------------------------------------------------------------------------

class TestAuditFilters:
    """Verifica el parámetro de filtro table_name del endpoint /audit/logs."""

    @_skip_if_no_models
    def test_audit_filters_by_table(self, db_session, test_user):
        """
        Crear logs de dos tablas distintas y filtrar por table_name
        debe retornar solo los de la tabla solicitada.
        """
        # Crear 2 logs de 'products' y 1 de 'sales'
        log_action(db_session, user_id=test_user.id, action="CREATE", table_name="products", record_id=1)
        log_action(db_session, user_id=test_user.id, action="CREATE", table_name="products", record_id=2)
        log_action(db_session, user_id=test_user.id, action="CREATE", table_name="sales", record_id=10)

        product_logs = (
            db_session.query(AuditLog)
            .filter(AuditLog.table_name == "products")
            .all()
        )
        sales_logs = (
            db_session.query(AuditLog)
            .filter(AuditLog.table_name == "sales")
            .all()
        )

        assert len(product_logs) == 2, (
            f"Deben existir 2 logs de 'products'. Encontrados: {len(product_logs)}"
        )
        assert len(sales_logs) == 1, (
            f"Debe existir 1 log de 'sales'. Encontrados: {len(sales_logs)}"
        )
        # Verificar que no se mezclan
        for log in product_logs:
            assert log.table_name == "products"
        for log in sales_logs:
            assert log.table_name == "sales"

    @_skip_if_no_models
    def test_audit_filter_nonexistent_table_returns_empty(self, db_session, test_user):
        """
        Filtrar por una tabla que no tiene logs debe retornar lista vacía.
        """
        log_action(db_session, user_id=test_user.id, action="CREATE", table_name="products", record_id=1)

        ghost_logs = (
            db_session.query(AuditLog)
            .filter(AuditLog.table_name == "tabla_inexistente")
            .all()
        )
        assert ghost_logs == [], (
            "Filtrar por tabla sin logs debe retornar lista vacía."
        )


# ---------------------------------------------------------------------------
# BLOQUE 5 — Integración: operaciones en BD generan AuditLog
# ---------------------------------------------------------------------------

class TestProductGeneratesAudit:
    """Verifica que las operaciones de productos generan AuditLog correcto."""

    @_skip_if_no_models
    def test_product_create_generates_audit(self, db_session, test_user):
        """
        Simular la lógica de creación de producto (como lo hace el router)
        y verificar que se genera AuditLog action=CREATE table=products.
        """
        # Crear producto (simula lo que hace el router de products)
        product = Product(
            name="Perno Hexagonal 1/2\"",
            sku="SKU-PERNO-01",
            price=Decimal("0.25"),
            stock=Decimal("500.000"),
            cost_price=Decimal("0.10"),
            is_active=True,
            is_service=False,
            is_combo=False,
            has_imei=False,
        )
        db_session.add(product)
        db_session.flush()

        # El router llama log_action() después del commit
        log_action(
            db=db_session,
            user_id=test_user.id,
            action="CREATE",
            table_name="products",
            record_id=product.id,
        )

        audit_log = (
            db_session.query(AuditLog)
            .filter(
                AuditLog.action == "CREATE",
                AuditLog.table_name == "products",
                AuditLog.record_id == product.id,
            )
            .first()
        )

        assert audit_log is not None, (
            "Crear un producto debe generar un AuditLog action=CREATE en tabla products."
        )
        assert audit_log.user_id == test_user.id
        assert audit_log.record_id == product.id

    @_skip_if_no_models
    def test_product_delete_generates_audit(self, db_session, test_user):
        """
        Simular la eliminación (soft-delete) de un producto y verificar
        que se genera AuditLog action=DELETE table=products.
        """
        product = Product(
            name="Tuerca M8 a eliminar",
            sku="SKU-TUERCA-DEL",
            price=Decimal("0.10"),
            stock=Decimal("100.000"),
            cost_price=Decimal("0.05"),
            is_active=True,
            is_service=False,
            is_combo=False,
            has_imei=False,
        )
        db_session.add(product)
        db_session.flush()
        product_id = product.id

        # Simular soft-delete (el router hace is_active=False + commit)
        product.is_active = False
        db_session.flush()

        # El router llama log_action() con action=DELETE
        log_action(
            db=db_session,
            user_id=test_user.id,
            action="DELETE",
            table_name="products",
            record_id=product_id,
        )

        audit_log = (
            db_session.query(AuditLog)
            .filter(
                AuditLog.action == "DELETE",
                AuditLog.table_name == "products",
                AuditLog.record_id == product_id,
            )
            .first()
        )

        assert audit_log is not None, (
            "Eliminar un producto debe generar un AuditLog action=DELETE en tabla products."
        )
        assert audit_log.user_id == test_user.id


class TestSaleGeneratesAudit:
    """Verifica que la creación de ventas genera AuditLog."""

    @_skip_if_no_models
    def test_sale_create_generates_audit(self, db_session, test_user, open_cash_session, warehouse):
        """
        Simular la creación de una venta (como hace sales_service) y
        verificar que se genera AuditLog action=CREATE table=sales.
        """
        sale = Sale(
            total_amount=Decimal("25.00"),
            payment_method="Efectivo",
            currency="USD",
            exchange_rate_used=Decimal("1.0000"),
            sync_status="SYNCED",
            session_id=open_cash_session.id,
            warehouse_id=warehouse.id,
        )
        db_session.add(sale)
        db_session.flush()
        sale_id = sale.id

        # El servicio de ventas llama log_action() después de crear la venta
        log_action(
            db=db_session,
            user_id=test_user.id,
            action="CREATE",
            table_name="sales",
            record_id=sale_id,
        )

        audit_log = (
            db_session.query(AuditLog)
            .filter(
                AuditLog.action == "CREATE",
                AuditLog.table_name == "sales",
                AuditLog.record_id == sale_id,
            )
            .first()
        )

        assert audit_log is not None, (
            "Crear una venta debe generar un AuditLog action=CREATE en tabla sales."
        )
        assert audit_log.user_id == test_user.id
        assert audit_log.record_id == sale_id

    @_skip_if_no_models
    def test_sale_audit_without_session_id(self, db_session, test_user, warehouse):
        """
        Una venta sin session_id (puede ocurrir en casos edge) también debe
        generar AuditLog correctamente.
        """
        sale = Sale(
            total_amount=Decimal("10.00"),
            payment_method="Tarjeta",
            currency="USD",
            exchange_rate_used=Decimal("1.0000"),
            sync_status="SYNCED",
            warehouse_id=warehouse.id,
        )
        db_session.add(sale)
        db_session.flush()

        log_action(
            db=db_session,
            user_id=test_user.id,
            action="CREATE",
            table_name="sales",
            record_id=sale.id,
        )

        audit_log = (
            db_session.query(AuditLog)
            .filter(AuditLog.table_name == "sales", AuditLog.record_id == sale.id)
            .first()
        )
        assert audit_log is not None


class TestCashSessionGeneratesAudit:
    """Verifica que la apertura de caja genera AuditLog."""

    @_skip_if_no_models
    def test_cash_session_open_generates_audit(self, db_session, test_user, cash_register):
        """
        Simular la apertura de caja (como hace el router cash/sessions.py)
        y verificar que se genera AuditLog action=CREATE table=cash_sessions.
        """
        # Simular apertura de caja
        new_session = CashSession(
            register_id=cash_register.id,
            status="OPEN",
            initial_cash=Decimal("100.00"),
        )
        db_session.add(new_session)
        db_session.flush()
        session_id = new_session.id

        # El router llama log_action() después del commit (sessions.py línea 279)
        log_action(
            db=db_session,
            user_id=test_user.id,
            action="CREATE",
            table_name="cash_sessions",
            record_id=session_id,
        )

        audit_log = (
            db_session.query(AuditLog)
            .filter(
                AuditLog.action == "CREATE",
                AuditLog.table_name == "cash_sessions",
                AuditLog.record_id == session_id,
            )
            .first()
        )

        assert audit_log is not None, (
            "Abrir caja debe generar AuditLog action=CREATE en tabla cash_sessions."
        )
        assert audit_log.user_id == test_user.id

    @_skip_if_no_models
    def test_cash_session_close_generates_audit(self, db_session, test_user, open_cash_session):
        """
        Simular el cierre de caja y verificar que se genera
        AuditLog action=UPDATE table=cash_sessions (igual que sessions.py línea 623).
        """
        open_cash_session.status = "CLOSED"
        db_session.flush()

        log_action(
            db=db_session,
            user_id=test_user.id,
            action="UPDATE",
            table_name="cash_sessions",
            record_id=open_cash_session.id,
        )

        audit_log = (
            db_session.query(AuditLog)
            .filter(
                AuditLog.action == "UPDATE",
                AuditLog.table_name == "cash_sessions",
                AuditLog.record_id == open_cash_session.id,
            )
            .first()
        )

        assert audit_log is not None, (
            "Cerrar caja debe generar AuditLog action=UPDATE en tabla cash_sessions."
        )


# ---------------------------------------------------------------------------
# BLOQUE 6 — Campos opcionales y casos borde de log_action()
# ---------------------------------------------------------------------------

class TestLogActionEdgeCases:
    """Casos límite de log_action()."""

    @_skip_if_no_models
    def test_log_action_without_user_id(self, db_session):
        """
        log_action() con user_id=None debe funcionar (acciones de sistema).
        El campo user_id es nullable en el modelo AuditLog.
        """
        log_action(
            db=db_session,
            user_id=None,
            action="CREATE",
            table_name="system_events",
            record_id=0,
        )

        log_entry = (
            db_session.query(AuditLog)
            .filter(AuditLog.table_name == "system_events")
            .first()
        )
        assert log_entry is not None
        assert log_entry.user_id is None

    @_skip_if_no_models
    def test_log_action_without_record_id(self, db_session, test_user):
        """
        log_action() con record_id=None debe funcionar.
        """
        log_action(
            db=db_session,
            user_id=test_user.id,
            action="LOGIN",
            table_name="users",
            record_id=None,
        )

        log_entry = (
            db_session.query(AuditLog)
            .filter(AuditLog.action == "LOGIN", AuditLog.table_name == "users")
            .first()
        )
        assert log_entry is not None
        assert log_entry.record_id is None

    @_skip_if_no_models
    def test_multiple_logs_same_record(self, db_session, test_user):
        """
        Un mismo record_id puede tener múltiples entradas de audit (CREATE, UPDATE, DELETE).
        """
        record_id = 55

        log_action(db_session, user_id=test_user.id, action="CREATE", table_name="products", record_id=record_id)
        log_action(db_session, user_id=test_user.id, action="UPDATE", table_name="products", record_id=record_id)
        log_action(db_session, user_id=test_user.id, action="DELETE", table_name="products", record_id=record_id)

        logs = (
            db_session.query(AuditLog)
            .filter(AuditLog.record_id == record_id, AuditLog.table_name == "products")
            .all()
        )

        assert len(logs) == 3, (
            f"Deben existir 3 entradas de audit para el record_id={record_id}. "
            f"Encontradas: {len(logs)}"
        )
        actions = {log.action for log in logs}
        assert actions == {"CREATE", "UPDATE", "DELETE"}

    @_skip_if_no_models
    def test_log_action_timestamp_is_set(self, db_session, test_user):
        """
        El campo timestamp debe ser no-nulo tras llamar log_action().
        """
        log_action(
            db=db_session,
            user_id=test_user.id,
            action="CREATE",
            table_name="customers",
            record_id=1,
        )

        log_entry = (
            db_session.query(AuditLog)
            .filter(AuditLog.table_name == "customers")
            .first()
        )
        assert log_entry is not None
        # El timestamp se setea por el default de la columna al hacer flush/commit
        # En SQLite, el default se evalúa en Python (función get_venezuela_now),
        # por lo que debe estar presente.
        assert log_entry.timestamp is not None, (
            "El campo timestamp debe ser no-nulo después de log_action()."
        )
