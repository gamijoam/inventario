"""
test_desktop_licenses.py — Tests para el sistema de licencias desktop.

Dado que routers/desktop_licenses.py y models/desktop_license.py aún no existen
en el repositorio, este archivo define:
  1. Un modelo SQLAlchemy DesktopLicense in-line (compatible con SQLite en memoria).
  2. Lógica de activación y validación extraída como funciones puras testeables.
  3. Tests de modelo (constraints, valores por defecto).
  4. Tests de lógica de negocio (activación, licencia expirada, revocada, etc.).
  5. Tests de CRUD admin simulados con MagicMock.

Estrategia:
  - SQLite en memoria propio (no reutiliza sqlite_engine de conftest para evitar
    conflictos con el schema "public" de Base global).
  - Todos los tests pasan sin PostgreSQL real, sin APScheduler ni servidor FastAPI.
"""

import os
import sys
import pytest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

# ---------------------------------------------------------------------------
# Path setup
# ---------------------------------------------------------------------------

_backend_root = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
if _backend_root not in sys.path:
    sys.path.insert(0, _backend_root)


# ---------------------------------------------------------------------------
# Modelo DesktopLicense standalone (SQLite-compatible, sin schema "public")
# ---------------------------------------------------------------------------

from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    create_engine,
)
from sqlalchemy.orm import declarative_base, sessionmaker

_LicenseBase = declarative_base()

VALID_PLANS = ("trial", "monthly", "annual", "lifetime")


class DesktopLicense(_LicenseBase):
    """Modelo de licencia para la aplicación desktop Tauri.

    Nota: Esta definición sirve como especificación de referencia.
    Cuando se cree models/desktop_license.py, debe ser compatible con esta API.
    """

    __tablename__ = "desktop_licenses"
    # Sin __table_args__ schema para SQLite

    id = Column(Integer, primary_key=True, autoincrement=True)
    license_key = Column(String(64), unique=True, nullable=False, index=True)
    plan = Column(String(20), nullable=False, default="trial")
    is_active = Column(Boolean, default=True, nullable=False)
    is_revoked = Column(Boolean, default=False, nullable=False)
    activations_count = Column(Integer, default=0, nullable=False)
    max_activations = Column(Integer, default=1, nullable=False)
    expires_at = Column(DateTime, nullable=True)  # NULL = lifetime
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    tenant_schema = Column(String(100), nullable=True)
    device_id = Column(String(200), nullable=True)
    revoked_reason = Column(String(100), nullable=True)

    def __repr__(self):
        return f"<DesktopLicense(key={self.license_key!r}, plan={self.plan!r})>"


# ---------------------------------------------------------------------------
# Lógica de activación — funciones puras testeables
# (Cuando se cree el router real, debe delegar en funciones similares a estas)
# ---------------------------------------------------------------------------


class LicenseNotFoundError(Exception):
    pass


class LicenseExpiredError(Exception):
    pass


class LicenseRevokedError(Exception):
    pass


class LicenseMaxActivationsError(Exception):
    pass


def activate_license(db, license_key: str, device_id: str) -> dict:
    """Activa una licencia desktop dado su license_key y device_id.

    Retorna un dict con los datos relevantes de la licencia.
    Lanza excepciones tipadas para cada condición de error.
    """
    lic = db.query(DesktopLicense).filter(
        DesktopLicense.license_key == license_key
    ).first()

    if lic is None:
        raise LicenseNotFoundError(f"License not found: {license_key}")

    if lic.is_revoked:
        raise LicenseRevokedError(f"License is revoked: {license_key}")

    if lic.expires_at is not None and lic.expires_at < datetime.utcnow():
        raise LicenseExpiredError(f"License expired at {lic.expires_at}")

    if lic.activations_count >= lic.max_activations:
        raise LicenseMaxActivationsError(
            f"Max activations reached ({lic.max_activations})"
        )

    lic.activations_count += 1
    lic.device_id = device_id
    db.flush()

    return {
        "license_key": lic.license_key,
        "plan": lic.plan,
        "expires_at": lic.expires_at,
        "activations_count": lic.activations_count,
        "tenant_schema": lic.tenant_schema,
    }


def revoke_license(db, license_key: str, reason: str = "manual") -> DesktopLicense:
    """Revoca una licencia. Lanza LicenseNotFoundError si no existe."""
    lic = db.query(DesktopLicense).filter(
        DesktopLicense.license_key == license_key
    ).first()

    if lic is None:
        raise LicenseNotFoundError(f"License not found: {license_key}")

    lic.is_revoked = True
    lic.revoked_reason = reason
    lic.is_active = False
    db.flush()
    return lic


# ---------------------------------------------------------------------------
# Fixtures SQLite standalone para tests de licencias
# ---------------------------------------------------------------------------


@pytest.fixture(scope="function")
def license_engine():
    """Engine SQLite en memoria exclusivo para tests de licencias desktop."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        echo=False,
    )
    _LicenseBase.metadata.create_all(engine)
    yield engine
    _LicenseBase.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture()
def lic_session(license_engine):
    """Sesión SQLAlchemy con rollback automático al finalizar cada test."""
    SessionFactory = sessionmaker(bind=license_engine, autocommit=False, autoflush=False)
    session = SessionFactory()
    yield session
    session.rollback()
    session.close()


# ---------------------------------------------------------------------------
# Helpers de datos
# ---------------------------------------------------------------------------


def _make_license(
    key: str = "TEST-KEY-0001",
    plan: str = "monthly",
    is_revoked: bool = False,
    expires_at: datetime | None = None,
    activations_count: int = 0,
    max_activations: int = 1,
    tenant_schema: str | None = "empresa_test",
) -> DesktopLicense:
    return DesktopLicense(
        license_key=key,
        plan=plan,
        is_active=True,
        is_revoked=is_revoked,
        expires_at=expires_at,
        activations_count=activations_count,
        max_activations=max_activations,
        tenant_schema=tenant_schema,
    )


# ===========================================================================
# TestLicenseModel
# ===========================================================================


class TestLicenseModel:
    """Persistencia y constraints del modelo DesktopLicense."""

    def test_licencia_nueva_tiene_activaciones_cero(self, lic_session):
        """Una licencia recién creada tiene activations_count=0 por defecto."""
        lic = DesktopLicense(
            license_key="KEY-ZERO-ACTS",
            plan="monthly",
        )
        lic_session.add(lic)
        lic_session.flush()

        retrieved = lic_session.query(DesktopLicense).filter_by(
            license_key="KEY-ZERO-ACTS"
        ).first()

        assert retrieved is not None
        assert retrieved.activations_count == 0

    def test_licencia_tiene_key_unica(self, lic_session):
        """Insertar dos licencias con el mismo license_key viola el constraint UNIQUE."""
        from sqlalchemy.exc import IntegrityError

        lic_session.add(DesktopLicense(license_key="DUPLICATE-KEY", plan="trial"))
        lic_session.flush()

        lic_session.add(DesktopLicense(license_key="DUPLICATE-KEY", plan="annual"))
        with pytest.raises((IntegrityError, Exception)):
            lic_session.flush()

    def test_expires_at_none_es_lifetime(self, lic_session):
        """expires_at=None significa que la licencia no caduca (lifetime)."""
        lic = DesktopLicense(
            license_key="KEY-LIFETIME-001",
            plan="lifetime",
            expires_at=None,
        )
        lic_session.add(lic)
        lic_session.flush()

        retrieved = lic_session.query(DesktopLicense).filter_by(
            license_key="KEY-LIFETIME-001"
        ).first()

        assert retrieved.expires_at is None

    def test_planes_validos_se_persisten(self, lic_session):
        """Todos los planes válidos (trial, monthly, annual, lifetime) se guardan correctamente."""
        for plan in VALID_PLANS:
            lic = DesktopLicense(
                license_key=f"KEY-PLAN-{plan.upper()}",
                plan=plan,
            )
            lic_session.add(lic)
        lic_session.flush()

        for plan in VALID_PLANS:
            retrieved = lic_session.query(DesktopLicense).filter_by(
                license_key=f"KEY-PLAN-{plan.upper()}"
            ).first()
            assert retrieved is not None, f"No se encontró la licencia con plan={plan}"
            assert retrieved.plan == plan

    def test_licencia_no_revocada_por_defecto(self, lic_session):
        """is_revoked=False por defecto al crear una licencia."""
        lic = DesktopLicense(license_key="KEY-NOT-REVOKED", plan="monthly")
        lic_session.add(lic)
        lic_session.flush()

        retrieved = lic_session.query(DesktopLicense).filter_by(
            license_key="KEY-NOT-REVOKED"
        ).first()

        assert retrieved.is_revoked is False

    def test_licencia_activa_por_defecto(self, lic_session):
        """is_active=True por defecto al crear una licencia."""
        lic = DesktopLicense(license_key="KEY-ACTIVE-DEFAULT", plan="annual")
        lic_session.add(lic)
        lic_session.flush()

        retrieved = lic_session.query(DesktopLicense).filter_by(
            license_key="KEY-ACTIVE-DEFAULT"
        ).first()

        assert retrieved.is_active is True


# ===========================================================================
# TestLicenseActivation
# ===========================================================================


class TestLicenseActivation:
    """Lógica de activación de licencias desktop."""

    def test_activar_licencia_valida_retorna_datos_correctos(self, lic_session):
        """Licencia válida → activate_license retorna dict con los campos esperados."""
        lic = _make_license(
            key="VALID-LICENSE-001",
            plan="annual",
            expires_at=datetime.utcnow() + timedelta(days=365),
        )
        lic_session.add(lic)
        lic_session.flush()

        result = activate_license(lic_session, "VALID-LICENSE-001", device_id="DEV-ABC")

        assert result["license_key"] == "VALID-LICENSE-001"
        assert result["plan"] == "annual"
        assert result["activations_count"] == 1
        assert result["tenant_schema"] == "empresa_test"

    def test_licencia_inexistente_retorna_404(self, lic_session):
        """Clave inexistente → LicenseNotFoundError (mapea a HTTP 404)."""
        with pytest.raises(LicenseNotFoundError):
            activate_license(lic_session, "NO-EXISTE-ESTA-KEY", device_id="DEV-XYZ")

    def test_licencia_expirada_retorna_error(self, lic_session):
        """expires_at en el pasado → LicenseExpiredError."""
        lic = _make_license(
            key="EXPIRED-LICENSE-001",
            plan="monthly",
            expires_at=datetime.utcnow() - timedelta(days=10),
        )
        lic_session.add(lic)
        lic_session.flush()

        with pytest.raises(LicenseExpiredError):
            activate_license(lic_session, "EXPIRED-LICENSE-001", device_id="DEV-001")

    def test_licencia_revocada_no_puede_activarse(self, lic_session):
        """is_revoked=True → LicenseRevokedError, sin incrementar contador."""
        lic = _make_license(
            key="REVOKED-LICENSE-001",
            plan="lifetime",
            is_revoked=True,
        )
        lic_session.add(lic)
        lic_session.flush()

        with pytest.raises(LicenseRevokedError):
            activate_license(lic_session, "REVOKED-LICENSE-001", device_id="DEV-001")

        lic_session.expire(lic)
        assert lic.activations_count == 0  # No debe haberse incrementado

    def test_activar_incrementa_activations_count(self, lic_session):
        """Activación exitosa → activations_count sube de 0 a 1."""
        lic = _make_license(
            key="COUNT-TEST-001",
            plan="lifetime",
            expires_at=None,
            activations_count=0,
            max_activations=3,
        )
        lic_session.add(lic)
        lic_session.flush()

        assert lic.activations_count == 0

        activate_license(lic_session, "COUNT-TEST-001", device_id="DEV-FIRST")
        lic_session.expire(lic)
        assert lic.activations_count == 1

        activate_license(lic_session, "COUNT-TEST-001", device_id="DEV-SECOND")
        lic_session.expire(lic)
        assert lic.activations_count == 2

    def test_max_activations_alcanzado_lanza_error(self, lic_session):
        """activations_count >= max_activations → LicenseMaxActivationsError."""
        lic = _make_license(
            key="MAX-ACTS-001",
            plan="monthly",
            expires_at=datetime.utcnow() + timedelta(days=30),
            activations_count=1,
            max_activations=1,
        )
        lic_session.add(lic)
        lic_session.flush()

        with pytest.raises(LicenseMaxActivationsError):
            activate_license(lic_session, "MAX-ACTS-001", device_id="DEV-EXTRA")

    def test_licencia_lifetime_sin_fecha_es_valida(self, lic_session):
        """expires_at=None (lifetime) nunca levanta LicenseExpiredError."""
        lic = _make_license(
            key="LIFETIME-VALID-001",
            plan="lifetime",
            expires_at=None,
        )
        lic_session.add(lic)
        lic_session.flush()

        result = activate_license(lic_session, "LIFETIME-VALID-001", device_id="DEV-LT")

        assert result["expires_at"] is None
        assert result["activations_count"] == 1

    def test_activacion_guarda_device_id(self, lic_session):
        """El device_id se persiste en la licencia al activar."""
        lic = _make_license(
            key="DEVICE-ID-TEST-001",
            plan="annual",
            expires_at=datetime.utcnow() + timedelta(days=200),
        )
        lic_session.add(lic)
        lic_session.flush()

        activate_license(lic_session, "DEVICE-ID-TEST-001", device_id="UNIQUE-DEVICE-XYZ")
        lic_session.expire(lic)

        assert lic.device_id == "UNIQUE-DEVICE-XYZ"


# ===========================================================================
# TestLicenseCRUD
# ===========================================================================


class TestLicenseCRUD:
    """Tests de CRUD administrativo de licencias (simulados con MagicMock)."""

    def test_crear_licencia_requiere_superuser(self):
        """Solo un superuser puede crear licencias (simulación de guard RBAC)."""

        def create_license_endpoint(current_user, db, payload):
            """Simula la guard de superuser del endpoint POST /admin/licenses."""
            if not current_user.is_superuser:
                from fastapi import HTTPException
                raise HTTPException(status_code=403, detail="Superuser required")
            lic = DesktopLicense(**payload)
            db.add(lic)
            db.flush()
            return lic

        from fastapi import HTTPException

        non_superuser = MagicMock()
        non_superuser.is_superuser = False

        mock_db = MagicMock()

        with pytest.raises(HTTPException) as exc_info:
            create_license_endpoint(
                current_user=non_superuser,
                db=mock_db,
                payload={"license_key": "SHOULD-FAIL", "plan": "trial"},
            )

        assert exc_info.value.status_code == 403

    def test_crear_licencia_como_superuser_es_exitoso(self, lic_session):
        """Superuser puede crear una licencia correctamente."""

        def create_license_endpoint(current_user, db, payload):
            if not current_user.is_superuser:
                from fastapi import HTTPException
                raise HTTPException(status_code=403, detail="Superuser required")
            lic = DesktopLicense(**payload)
            db.add(lic)
            db.flush()
            return lic

        superuser = MagicMock()
        superuser.is_superuser = True

        lic = create_license_endpoint(
            current_user=superuser,
            db=lic_session,
            payload={
                "license_key": "SUPERUSER-CREATED-001",
                "plan": "annual",
                "max_activations": 2,
            },
        )

        assert lic.license_key == "SUPERUSER-CREATED-001"
        assert lic.plan == "annual"

    def test_listar_licencias_retorna_todas(self, lic_session):
        """Endpoint de listado retorna todas las licencias registradas."""
        keys = ["LIST-KEY-A", "LIST-KEY-B", "LIST-KEY-C"]
        for key in keys:
            lic_session.add(DesktopLicense(license_key=key, plan="monthly"))
        lic_session.flush()

        def list_licenses_endpoint(db):
            return db.query(DesktopLicense).all()

        result = list_licenses_endpoint(lic_session)

        assert len(result) >= 3
        result_keys = {r.license_key for r in result}
        for key in keys:
            assert key in result_keys

    def test_actualizar_licencia_cambia_plan(self, lic_session):
        """PATCH sobre una licencia permite cambiar el plan."""
        lic = DesktopLicense(license_key="UPDATE-PLAN-001", plan="trial")
        lic_session.add(lic)
        lic_session.flush()

        def update_license_endpoint(db, license_key, new_plan):
            target = db.query(DesktopLicense).filter_by(
                license_key=license_key
            ).first()
            if target is None:
                from fastapi import HTTPException
                raise HTTPException(status_code=404, detail="Not found")
            target.plan = new_plan
            db.flush()
            return target

        updated = update_license_endpoint(lic_session, "UPDATE-PLAN-001", "annual")

        assert updated.plan == "annual"
        lic_session.expire(lic)
        assert lic.plan == "annual"

    def test_revocar_licencia_bloquea_activacion(self, lic_session):
        """Revocar una licencia impide activaciones posteriores."""
        lic = _make_license(
            key="REVOKE-BLOCKS-001",
            plan="monthly",
            expires_at=datetime.utcnow() + timedelta(days=30),
        )
        lic_session.add(lic)
        lic_session.flush()

        # Primero se revoca
        revoke_license(lic_session, "REVOKE-BLOCKS-001", reason="payment_failed")
        lic_session.expire(lic)

        assert lic.is_revoked is True
        assert lic.revoked_reason == "payment_failed"

        # Luego se intenta activar → debe fallar
        with pytest.raises(LicenseRevokedError):
            activate_license(lic_session, "REVOKE-BLOCKS-001", device_id="DEV-POST-REVOKE")

    def test_revocar_licencia_inexistente_lanza_error(self, lic_session):
        """revoke_license sobre clave inexistente → LicenseNotFoundError."""
        with pytest.raises(LicenseNotFoundError):
            revoke_license(lic_session, "NO-EXISTE-PARA-REVOCAR")
