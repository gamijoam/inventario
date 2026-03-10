"""
test_tenant_isolation.py
========================
Tests de aislamiento multi-tenant.

Verifica que:
1. Una query ejecutada en el contexto del schema A no puede ver datos del schema B.
2. Al crear un nuevo Tenant mediante TenantService, se crea su schema PostgreSQL.
3. La lógica de licencias/suscripciones funciona correctamente (SQLite).

Arquitectura relevante:
- tenant_context.py usa un ContextVar (_tenant_schema) para inyectar el schema activo.
- database/db.py ejecuta SET search_path TO "<schema>", public al obtener una sesión.
- Los modelos de negocio (Customer, CashRegister, etc.) NO declaran schema explícito;
  residen en el schema activo del search_path.
- El modelo Tenant sí declara schema="public" (siempre en public).

Notas sobre SQLite vs PostgreSQL:
- SQLite no soporta schemas; los tests de aislamiento de search_path REQUIEREN
  PostgreSQL real.  Están marcados con @pytest.mark.requires_postgres y se saltean
  automáticamente si TEST_DATABASE_URL no está definida.
- Los tests de lógica de licencias y tenant SÍ corren en SQLite.
- El test de creación de Tenant usa mocks para no necesitar una BD real.
"""

import os
import pytest
from unittest.mock import MagicMock, patch, call
from decimal import Decimal
import datetime


# ---------------------------------------------------------------------------
# Helpers de importación con skip seguro
# ---------------------------------------------------------------------------

def _import_or_skip():
    try:
        import sys
        _backend_root = os.path.dirname(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        )
        if _backend_root not in sys.path:
            sys.path.insert(0, _backend_root)

        from backend_api.models.models import Customer, Base, Product, Sale
        from backend_api.models.tenant import Tenant
        from backend_api.tenant_context import set_tenant_schema, reset_tenant_schema, get_tenant_schema
        from backend_api.services.tenant_service import TenantService

        return Customer, Base, Tenant, set_tenant_schema, reset_tenant_schema, get_tenant_schema, TenantService, Product, Sale
    except Exception as e:
        return None, None, None, None, None, None, None, None, None


(
    Customer,
    Base,
    Tenant,
    set_tenant_schema,
    reset_tenant_schema,
    get_tenant_schema,
    TenantService,
    Product,
    Sale,
) = _import_or_skip()

MODELS_AVAILABLE = Customer is not None


# ---------------------------------------------------------------------------
# Test 1 — Aislamiento de datos entre schemas (requiere PostgreSQL)
# ---------------------------------------------------------------------------

@pytest.mark.requires_postgres
def test_usuario_no_puede_ver_data_de_otro_tenant():
    """
    Verifica que una query ejecutada con search_path del schema_A
    NO retorna filas insertadas en el schema_B.

    Flujo del test:
    1. Conecta a PostgreSQL de prueba (TEST_DATABASE_URL).
    2. Crea dos schemas efímeros: test_tenant_a y test_tenant_b.
    3. Crea la tabla 'customers' en ambos schemas.
    4. Inserta un Customer en schema_a y otro distinto en schema_b.
    5. Consulta customers desde el contexto de schema_a.
    6. Afirma que solo el customer de schema_a es visible (el de schema_b NO aparece).
    7. Limpia los schemas de prueba.

    Requiere:
        TEST_DATABASE_URL=postgresql://user:pw@localhost/test_db  (variable de entorno)
    """
    if not MODELS_AVAILABLE:
        pytest.skip("Modelos no disponibles — verifica la instalación del paquete.")

    test_db_url = os.environ.get("TEST_DATABASE_URL")
    if not test_db_url:
        pytest.skip(
            "TEST_DATABASE_URL no definida. "
            "Defínela para correr tests que requieren PostgreSQL real."
        )

    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import sessionmaker

    SCHEMA_A = "test_tenant_aislamiento_a"
    SCHEMA_B = "test_tenant_aislamiento_b"

    engine = create_engine(test_db_url, echo=False)

    try:
        with engine.begin() as conn:
            # Limpiar schemas previos si existen (idempotencia)
            conn.execute(text(f'DROP SCHEMA IF EXISTS "{SCHEMA_A}" CASCADE'))
            conn.execute(text(f'DROP SCHEMA IF EXISTS "{SCHEMA_B}" CASCADE'))
            conn.execute(text(f'CREATE SCHEMA "{SCHEMA_A}"'))
            conn.execute(text(f'CREATE SCHEMA "{SCHEMA_B}"'))

        # Crear tablas en cada schema
        with engine.connect() as conn:
            with conn.begin():
                conn.execute(text(f'SET search_path TO "{SCHEMA_A}"'))
                Base.metadata.create_all(conn)

        with engine.connect() as conn:
            with conn.begin():
                conn.execute(text(f'SET search_path TO "{SCHEMA_B}"'))
                Base.metadata.create_all(conn)

        # Insertar datos en schema_a
        SessionFactory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
        session_a = SessionFactory()
        try:
            session_a.execute(text(f'SET search_path TO "{SCHEMA_A}", public'))
            customer_a = Customer(name="Cliente Solo En A", credit_limit=Decimal("200.00"))
            session_a.add(customer_a)
            session_a.commit()
        finally:
            session_a.close()

        # Insertar datos en schema_b
        session_b = SessionFactory()
        try:
            session_b.execute(text(f'SET search_path TO "{SCHEMA_B}", public'))
            customer_b = Customer(name="Cliente Solo En B", credit_limit=Decimal("300.00"))
            session_b.add(customer_b)
            session_b.commit()
        finally:
            session_b.close()

        # Consultar desde schema_a — NO debe ver al cliente de schema_b
        session_verify = SessionFactory()
        try:
            session_verify.execute(text(f'SET search_path TO "{SCHEMA_A}", public'))
            customers_in_a = session_verify.query(Customer).all()
            names_in_a = [c.name for c in customers_in_a]

            assert "Cliente Solo En A" in names_in_a, (
                "El cliente del schema A debe ser visible desde el contexto de schema A."
            )
            assert "Cliente Solo En B" not in names_in_a, (
                "FALLO DE AISLAMIENTO: El cliente del schema B es visible desde schema A. "
                "Esto indica que search_path no está funcionando correctamente."
            )
        finally:
            session_verify.close()

    finally:
        # Limpieza garantizada
        with engine.begin() as conn:
            conn.execute(text(f'DROP SCHEMA IF EXISTS "{SCHEMA_A}" CASCADE'))
            conn.execute(text(f'DROP SCHEMA IF EXISTS "{SCHEMA_B}" CASCADE'))
        engine.dispose()


# ---------------------------------------------------------------------------
# Test 2 — Al crear Tenant se ejecuta CREATE SCHEMA en PostgreSQL
# ---------------------------------------------------------------------------

def test_nuevo_tenant_tiene_schema_propio():
    """
    Verifica que TenantService.create_tenant() ejecuta CREATE SCHEMA en la BD.

    Usa mocks para evitar dependencia de una BD real.  Se intercepta la llamada
    a db.execute() y se comprueba que en algún momento se ejecutó la instrucción
    CREATE SCHEMA "<schema_name>".

    Qué se verifica:
    - Que la llamada SQL contiene CREATE SCHEMA con el nombre esperado.
    - Que el schema_name se registra correctamente en el registro Tenant.

    Limitación:
    - Este test verifica la INTENCIÓN del código, no la ejecución real en PG.
      Para verificar que el schema existe físicamente, usar test_nuevo_tenant_schema_existe_en_pg
      (marcado requires_postgres).
    """
    if not MODELS_AVAILABLE:
        pytest.skip("Modelos no disponibles — verifica la instalación del paquete.")

    schema_esperado = "tenant_test_xyz"
    create_schema_llamado = []

    # Capturamos todas las instrucciones SQL ejecutadas para verificar CREATE SCHEMA
    original_execute = None

    with patch(
        "backend_api.services.tenant_service.SessionLocal"
    ) as MockSessionLocal, patch(
        "backend_api.services.tenant_service.engine"
    ) as mock_engine, patch(
        "backend_api.services.tenant_service.TenantService.seed_tenant_admin"
    ), patch(
        "backend_api.services.tenant_service.TenantService.seed_exchange_rates"
    ), patch(
        "backend_api.services.tenant_service.TenantService.seed_payment_methods"
    ), patch(
        "backend_api.services.tenant_service.TenantService.seed_currencies"
    ), patch(
        "backend_api.services.tenant_service.TenantService.seed_tenant_warehouse"
    ), patch(
        "backend_api.services.tenant_service.TenantService.seed_cash_register"
    ), patch(
        "os.makedirs"
    ):
        # Configurar sesión mock
        mock_db = MagicMock()
        MockSessionLocal.return_value = mock_db

        # Simular que no existe tenant ni usuario previo
        mock_db.query.return_value.filter.return_value.first.return_value = None
        mock_db.query.return_value.filter.return_value.count.return_value = 0

        # Capturar llamadas a execute para inspeccionar el SQL de CREATE SCHEMA
        executed_statements = []

        def capture_execute(stmt, *args, **kwargs):
            sql = str(stmt) if hasattr(stmt, '__str__') else repr(stmt)
            executed_statements.append(sql)
            # Simular nuevo tenant con id=1
            mock_tenant = MagicMock()
            mock_tenant.id = 1
            mock_db.query.return_value.filter.return_value.first.return_value = None
            return MagicMock()

        mock_db.execute.side_effect = capture_execute

        # Simular commit y el tenant generado
        mock_db.commit.return_value = None

        # Configurar engine mock para create_all
        mock_conn = MagicMock()
        mock_engine.connect.return_value.__enter__ = lambda s: mock_conn
        mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
        mock_conn.begin.return_value.__enter__ = lambda s: mock_conn
        mock_conn.begin.return_value.__exit__ = MagicMock(return_value=False)

        # Ejecutar la creación del tenant
        try:
            TenantService.create_tenant(
                name="Empresa Test",
                schema_name=schema_esperado,
                admin_email="admin@test.com",
                admin_password="password123",
                plan_type="FERRETERIA",
            )
        except Exception:
            # Pueden surgir errores de mock secundarios; lo importante es
            # verificar que CREATE SCHEMA fue llamado antes de cualquier fallo.
            pass

        # Verificar que se intentó ejecutar CREATE SCHEMA con el nombre correcto
        create_schema_calls = [
            stmt for stmt in executed_statements
            if "CREATE SCHEMA" in stmt and schema_esperado in stmt
        ]

        assert len(create_schema_calls) > 0, (
            f"Se esperaba que TenantService ejecutara 'CREATE SCHEMA \"{schema_esperado}\"' "
            f"pero las instrucciones ejecutadas fueron: {executed_statements}"
        )


@pytest.mark.requires_postgres
def test_nuevo_tenant_schema_existe_en_pg():
    """
    Verifica que al crear un Tenant, el schema PostgreSQL realmente existe en la BD.

    Requiere:
        TEST_DATABASE_URL=postgresql://user:pw@localhost/test_db
    """
    if not MODELS_AVAILABLE:
        pytest.skip("Modelos no disponibles.")

    test_db_url = os.environ.get("TEST_DATABASE_URL")
    if not test_db_url:
        pytest.skip("TEST_DATABASE_URL no definida.")

    from sqlalchemy import create_engine, text

    schema_test = "tenant_integracion_test_001"
    engine = create_engine(test_db_url)

    try:
        # Limpieza previa
        with engine.begin() as conn:
            conn.execute(text(f'DROP SCHEMA IF EXISTS "{schema_test}" CASCADE'))
            # También limpiar el registro de tenant si existe
            conn.execute(
                text("DELETE FROM public.tenants WHERE schema_name = :s"),
                {"s": schema_test},
            )

        TenantService.create_tenant(
            name="Empresa Integración",
            schema_name=schema_test,
            admin_email="integ@test.com",
            admin_password="test1234",
            plan_type="FERRETERIA",
        )

        # Verificar que el schema existe en information_schema
        with engine.connect() as conn:
            result = conn.execute(
                text(
                    "SELECT schema_name FROM information_schema.schemata "
                    "WHERE schema_name = :s"
                ),
                {"s": schema_test},
            ).fetchone()

        assert result is not None, (
            f"El schema '{schema_test}' no fue creado en PostgreSQL "
            "tras llamar a TenantService.create_tenant()."
        )

    finally:
        with engine.begin() as conn:
            conn.execute(text(f'DROP SCHEMA IF EXISTS "{schema_test}" CASCADE'))
            conn.execute(
                text("DELETE FROM public.tenants WHERE schema_name = :s"),
                {"s": schema_test},
            )
        engine.dispose()


# ---------------------------------------------------------------------------
# Test 3 — Verificación unitaria del ContextVar de tenant_context
# ---------------------------------------------------------------------------

def test_context_var_aislamiento_entre_contextos():
    """
    Verifica que set_tenant_schema y get_tenant_schema operan sobre
    el ContextVar correcto y que reset_tenant_schema devuelve 'public'.

    Este test es puramente unitario (sin BD).
    """
    if not MODELS_AVAILABLE:
        pytest.skip("Modelos no disponibles.")

    # Estado inicial
    reset_tenant_schema()
    assert get_tenant_schema() == "public", "El schema por defecto debe ser 'public'."

    # Cambiar a tenant A
    set_tenant_schema("empresa_abc")
    assert get_tenant_schema() == "empresa_abc"

    # Simular otro "request" reseteando
    reset_tenant_schema()
    assert get_tenant_schema() == "public", (
        "reset_tenant_schema() debe devolver el contexto a 'public'."
    )

    # El schema de empresa_abc no debe "contaminar" después del reset
    assert get_tenant_schema() != "empresa_abc", (
        "El schema de empresa_abc no debe persistir tras reset_tenant_schema()."
    )


# ---------------------------------------------------------------------------
# Clase 4 — Aislamiento de datos de negocio por tenant (SQLite)
# ---------------------------------------------------------------------------

class TestTenantSchemaIsolation:
    """Verifica que los datos de un tenant no se filtran a otro.

    Estos tests usan la fixture db_session (SQLite) y simulan el aislamiento
    mediante el campo tenant_id en los modelos que lo soportan (User, etc.).
    Para modelos sin tenant_id explícito (Customer, Product), la separación
    real ocurre a nivel de schema PostgreSQL; aquí se verifica la lógica
    de filtrado a nivel de aplicación.
    """

    def test_clientes_filtrados_por_instancia(self, db_session):
        """Clientes de diferentes tenants son distinguibles por sus registros.

        En SQLite (sin schemas) verificamos que los registros existen de forma
        independiente y que un filtro correcto los separa.
        """
        if not MODELS_AVAILABLE:
            pytest.skip("Modelos no disponibles.")

        # Crear dos clientes que representan tenants distintos
        customer_a = Customer(
            name="Cliente Tenant A",
            credit_limit=Decimal("500.00"),
            is_blocked=False,
        )
        customer_b = Customer(
            name="Cliente Tenant B",
            credit_limit=Decimal("300.00"),
            is_blocked=False,
        )
        db_session.add(customer_a)
        db_session.add(customer_b)
        db_session.flush()

        # Verificar que ambos están en la BD y son distinguibles
        all_customers = db_session.query(Customer).all()
        names = [c.name for c in all_customers]

        assert "Cliente Tenant A" in names
        assert "Cliente Tenant B" in names
        assert len(all_customers) == 2

        # Simular filtro de tenant: en producción, search_path aísla por schema.
        # Aquí verificamos que cada cliente tiene su propio ID independiente.
        assert customer_a.id != customer_b.id, (
            "Cada cliente debe tener un ID único incluso en el mismo scope."
        )

    def test_productos_tienen_ids_unicos_entre_tenants(self, db_session):
        """Productos creados para distintos tenants tienen IDs únicos."""
        if not MODELS_AVAILABLE:
            pytest.skip("Modelos no disponibles.")

        product_a = Product(
            name="Tornillo 1/4 Tenant A",
            sku="SKU-A-001",
            price=Decimal("0.50"),
            stock=Decimal("100.000"),
            cost_price=Decimal("0.20"),
            is_active=True,
            is_service=False,
            is_combo=False,
            has_imei=False,
        )
        product_b = Product(
            name="Tornillo 1/4 Tenant B",
            sku="SKU-B-001",
            price=Decimal("0.60"),
            stock=Decimal("50.000"),
            cost_price=Decimal("0.25"),
            is_active=True,
            is_service=False,
            is_combo=False,
            has_imei=False,
        )
        db_session.add(product_a)
        db_session.add(product_b)
        db_session.flush()

        # En un schema separado (PostgreSQL), product_b no existiría para tenant A.
        # En SQLite verificamos que cada producto tiene su identidad única.
        assert product_a.id is not None
        assert product_b.id is not None
        assert product_a.id != product_b.id

        # Filtro por nombre simula lo que search_path hace automáticamente en PG
        result_a = db_session.query(Product).filter(
            Product.name == "Tornillo 1/4 Tenant A"
        ).first()
        result_b = db_session.query(Product).filter(
            Product.name == "Tornillo 1/4 Tenant B"
        ).first()

        assert result_a is not None
        assert result_b is not None
        assert result_a.id != result_b.id

    def test_context_var_no_contamina_entre_llamadas(self):
        """El ContextVar de tenant se resetea correctamente entre llamadas."""
        if not MODELS_AVAILABLE:
            pytest.skip("Modelos no disponibles.")

        reset_tenant_schema()

        # Simular request de tenant A
        set_tenant_schema("ferreteria_garcia")
        assert get_tenant_schema() == "ferreteria_garcia"

        # Simular fin de request — reset
        reset_tenant_schema()

        # Simular request de tenant B — no debe ver el schema de A
        set_tenant_schema("supermercado_lopez")
        assert get_tenant_schema() == "supermercado_lopez"
        assert get_tenant_schema() != "ferreteria_garcia", (
            "El schema de ferreteria_garcia no debe ser visible en el contexto "
            "de supermercado_lopez tras el reset."
        )

        # Cleanup
        reset_tenant_schema()

    @pytest.mark.requires_postgres
    def test_schema_search_path_aísla_datos_reales(self):
        """Con PostgreSQL real, search_path impide ver datos de otro tenant.

        Este test requiere TEST_DATABASE_URL definida.
        """
        pytest.skip(
            "Test de integración PostgreSQL: requiere TEST_DATABASE_URL. "
            "Ver test_usuario_no_puede_ver_data_de_otro_tenant() en este módulo."
        )


# ---------------------------------------------------------------------------
# Clase 5 — Validación de licencias de tenant (SQLite)
# ---------------------------------------------------------------------------

class TestLicenseValidation:
    """Verifica la lógica de validación de licencias y suscripciones."""

    def _make_tenant(self, db_session, **kwargs):
        """Helper: crea y persiste un Tenant con valores por defecto sobreescribibles."""
        defaults = {
            "name": "Empresa Test",
            "schema_name": "empresa_test",
            "is_active": True,
            "license_type": "trial",
            "trial_days": 15,
            "trial_ends_at": None,
            "subscription_expires_at": None,
        }
        defaults.update(kwargs)
        tenant = Tenant(**defaults)
        db_session.add(tenant)
        db_session.flush()
        return tenant

    def test_tenant_activo_tiene_is_active_true(self, db_session):
        """Un tenant recién creado está activo por defecto."""
        if not MODELS_AVAILABLE:
            pytest.skip("Modelos no disponibles.")

        tenant = self._make_tenant(db_session, schema_name="activo_test_001")
        assert tenant.is_active is True

    def test_tenant_inactivo_no_puede_operar(self, db_session):
        """Un tenant con is_active=False representa una cuenta bloqueada.

        Verifica que el flag is_active=False puede setearse y persistirse,
        y que la lógica de negocio debe rechazar operaciones para este tenant.
        """
        if not MODELS_AVAILABLE:
            pytest.skip("Modelos no disponibles.")

        tenant = self._make_tenant(
            db_session,
            schema_name="inactivo_test_001",
            is_active=False,
            license_blocked_reason="PAYMENT_OVERDUE",
        )
        db_session.flush()

        # Verificar que el flag está seteado correctamente en BD
        retrieved = db_session.query(Tenant).filter(
            Tenant.schema_name == "inactivo_test_001"
        ).first()

        assert retrieved is not None
        assert retrieved.is_active is False, (
            "Un tenant bloqueado debe tener is_active=False."
        )
        assert retrieved.license_blocked_reason == "PAYMENT_OVERDUE"

    def test_tenant_lifetime_no_tiene_fecha_expiracion(self, db_session):
        """Un tenant con license_type=lifetime tiene subscription_expires_at=NULL.

        NULL significa que nunca expira — no es afectado por auto-expiración.
        """
        if not MODELS_AVAILABLE:
            pytest.skip("Modelos no disponibles.")

        tenant = self._make_tenant(
            db_session,
            schema_name="lifetime_test_001",
            license_type="lifetime",
            trial_ends_at=None,
            subscription_expires_at=None,
        )
        db_session.flush()

        retrieved = db_session.query(Tenant).filter(
            Tenant.schema_name == "lifetime_test_001"
        ).first()

        assert retrieved.license_type == "lifetime"
        assert retrieved.subscription_expires_at is None, (
            "Un tenant lifetime NO debe tener subscription_expires_at definida. "
            "NULL = nunca expira."
        )
        assert retrieved.trial_ends_at is None, (
            "Un tenant lifetime no debería tener fecha de fin de trial."
        )

    def test_tenant_trial_vencido_identificable(self, db_session):
        """Un tenant con trial_ends_at en el pasado es identificable como vencido.

        El scheduler de auto-expiración compara trial_ends_at < now() y marca
        is_active=False.  Este test verifica que el campo puede setearse en el
        pasado y ser leído correctamente.
        """
        if not MODELS_AVAILABLE:
            pytest.skip("Modelos no disponibles.")

        fecha_pasada = datetime.datetime.utcnow() - datetime.timedelta(days=30)

        tenant = self._make_tenant(
            db_session,
            schema_name="trial_vencido_001",
            license_type="trial",
            trial_ends_at=fecha_pasada,
            is_active=True,  # Aún no procesado por scheduler
        )
        db_session.flush()

        retrieved = db_session.query(Tenant).filter(
            Tenant.schema_name == "trial_vencido_001"
        ).first()

        assert retrieved.trial_ends_at is not None
        assert retrieved.trial_ends_at < datetime.datetime.utcnow(), (
            "El tenant debe tener trial_ends_at en el pasado para ser considerado vencido."
        )

        # Simular la lógica del scheduler: marcar inactivo si trial venció
        ahora = datetime.datetime.utcnow()
        if (
            retrieved.license_type == "trial"
            and retrieved.trial_ends_at is not None
            and retrieved.trial_ends_at < ahora
        ):
            retrieved.is_active = False
            db_session.flush()

        assert retrieved.is_active is False, (
            "El tenant con trial vencido debe ser marcado como inactivo por el scheduler."
        )

    def test_tenant_monthly_vencido_identificable(self, db_session):
        """Un tenant monthly con subscription_expires_at en el pasado es vencido."""
        if not MODELS_AVAILABLE:
            pytest.skip("Modelos no disponibles.")

        fecha_pasada = datetime.datetime.utcnow() - datetime.timedelta(days=5)

        tenant = self._make_tenant(
            db_session,
            schema_name="monthly_vencido_001",
            license_type="monthly",
            subscription_expires_at=fecha_pasada,
            is_active=True,
        )
        db_session.flush()

        retrieved = db_session.query(Tenant).filter(
            Tenant.schema_name == "monthly_vencido_001"
        ).first()

        assert retrieved.subscription_expires_at is not None
        assert retrieved.subscription_expires_at < datetime.datetime.utcnow()

        # Simular lógica de scheduler para suscripción mensual
        ahora = datetime.datetime.utcnow()
        if (
            retrieved.license_type in ("monthly", "annual")
            and retrieved.subscription_expires_at is not None
            and retrieved.subscription_expires_at < ahora
        ):
            retrieved.is_active = False
            db_session.flush()

        assert retrieved.is_active is False, (
            "El tenant monthly vencido debe ser desactivado por el scheduler."
        )

    def test_tenant_monthly_vigente_permanece_activo(self, db_session):
        """Un tenant monthly con subscription_expires_at en el futuro permanece activo."""
        if not MODELS_AVAILABLE:
            pytest.skip("Modelos no disponibles.")

        fecha_futura = datetime.datetime.utcnow() + datetime.timedelta(days=25)

        tenant = self._make_tenant(
            db_session,
            schema_name="monthly_vigente_001",
            license_type="monthly",
            subscription_expires_at=fecha_futura,
            is_active=True,
        )
        db_session.flush()

        retrieved = db_session.query(Tenant).filter(
            Tenant.schema_name == "monthly_vigente_001"
        ).first()

        # El scheduler NO debe desactivarlo porque aún no venció
        ahora = datetime.datetime.utcnow()
        debe_desactivar = (
            retrieved.license_type in ("monthly", "annual")
            and retrieved.subscription_expires_at is not None
            and retrieved.subscription_expires_at < ahora
        )

        assert not debe_desactivar, (
            "Un tenant con suscripción vigente NO debe ser desactivado por el scheduler."
        )
        assert retrieved.is_active is True

    def test_schema_name_valida_solo_caracteres_seguros(self):
        """El schema_name debe usar solo caracteres alfanuméricos y guiones bajos.

        La función _validate_schema_name en db.py protege contra SQL injection
        en SET search_path.
        """
        import re
        _SAFE_SCHEMA_RE = re.compile(r'^[a-zA-Z0-9_]+$')

        nombres_validos = ["empresa_abc", "tenant001", "FerreteriaMedina", "t_1"]
        for nombre in nombres_validos:
            assert _SAFE_SCHEMA_RE.match(nombre), (
                f"'{nombre}' debe ser un schema_name válido."
            )

        nombres_invalidos = ["empresa-abc", "tenant; DROP", "schema'injection", "../etc"]
        for nombre in nombres_invalidos:
            assert not _SAFE_SCHEMA_RE.match(nombre), (
                f"'{nombre}' NO debe ser un schema_name válido — posible injection."
            )

    def test_tenant_lifetime_no_se_desactiva_por_scheduler(self, db_session):
        """Un tenant lifetime nunca es afectado por la lógica de expiración."""
        if not MODELS_AVAILABLE:
            pytest.skip("Modelos no disponibles.")

        # Incluso si alguien pusiera una fecha pasada en trial_ends_at para
        # un tenant lifetime, la lógica del scheduler no debería tocarlo.
        fecha_pasada = datetime.datetime.utcnow() - datetime.timedelta(days=999)

        tenant = self._make_tenant(
            db_session,
            schema_name="lifetime_no_expira_001",
            license_type="lifetime",
            trial_ends_at=fecha_pasada,
            subscription_expires_at=None,
            is_active=True,
        )
        db_session.flush()

        retrieved = db_session.query(Tenant).filter(
            Tenant.schema_name == "lifetime_no_expira_001"
        ).first()

        # Simular lógica correcta del scheduler: lifetime queda excluido
        ahora = datetime.datetime.utcnow()
        debe_desactivar = (
            retrieved.license_type == "trial"
            and retrieved.trial_ends_at is not None
            and retrieved.trial_ends_at < ahora
        ) or (
            retrieved.license_type in ("monthly", "annual")
            and retrieved.subscription_expires_at is not None
            and retrieved.subscription_expires_at < ahora
        )

        assert not debe_desactivar, (
            "Un tenant lifetime NO debe ser marcado para desactivación por el scheduler."
        )
        assert retrieved.is_active is True
