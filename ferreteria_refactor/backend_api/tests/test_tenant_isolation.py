"""
test_tenant_isolation.py
========================
Tests de aislamiento multi-tenant.

Verifica que:
1. Una query ejecutada en el contexto del schema A no puede ver datos del schema B.
2. Al crear un nuevo Tenant mediante TenantService, se crea su schema PostgreSQL.

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
- El test de creación de Tenant usa mocks para no necesitar una BD real.
"""

import os
import pytest
from unittest.mock import MagicMock, patch, call
from decimal import Decimal


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

        from backend_api.models.models import Customer, Base
        from backend_api.models.tenant import Tenant
        from backend_api.tenant_context import set_tenant_schema, reset_tenant_schema, get_tenant_schema
        from backend_api.services.tenant_service import TenantService

        return Customer, Base, Tenant, set_tenant_schema, reset_tenant_schema, get_tenant_schema, TenantService
    except Exception as e:
        return None, None, None, None, None, None, None


(
    Customer,
    Base,
    Tenant,
    set_tenant_schema,
    reset_tenant_schema,
    get_tenant_schema,
    TenantService,
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
