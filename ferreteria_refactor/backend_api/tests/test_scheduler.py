"""
test_scheduler.py — Tests unitarios para la lógica de auto-expiración de tenants.

Estrategia:
  - Se importa y ejecuta _auto_expire_tenants directamente (sin APScheduler activo).
  - La función recibe una *factory* que retorna una session de BD, por lo que se
    construye una factory wrapper que devuelve la misma db_session del fixture.
  - SQLite en memoria — usa el fixture db_session de conftest.py.
  - No se levanta servidor FastAPI ni se inicia el scheduler real.

Clases de test:
  - TestAutoExpireTenants (6 tests): casos de expiración trial, monthly, lifetime,
    ya-inactivo y múltiples tenants.
"""

import os
import sys
import pytest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch, call

# ---------------------------------------------------------------------------
# Path setup — igual que conftest.py
# ---------------------------------------------------------------------------

_backend_root = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
if _backend_root not in sys.path:
    sys.path.insert(0, _backend_root)


# ---------------------------------------------------------------------------
# Importaciones condicionales
# ---------------------------------------------------------------------------

try:
    from backend_api.models.tenant import Tenant
    from backend_api.scheduler import _auto_expire_tenants

    MODULES_AVAILABLE = True
except Exception as _import_err:
    MODULES_AVAILABLE = False
    _import_err_msg = str(_import_err)


def _skip_if_unavailable():
    if not MODULES_AVAILABLE:
        pytest.skip(
            f"No se pudieron importar los módulos requeridos: {_import_err_msg}. "
            "Verifica que el paquete backend_api esté instalado."
        )


# ---------------------------------------------------------------------------
# Helper: construye una session_factory que devuelve la db_session del fixture
# ---------------------------------------------------------------------------

def _make_factory(session):
    """Retorna una callable que siempre devuelve la misma session de prueba.

    _auto_expire_tenants llama a db_session_factory() para obtener la session
    y luego llama a db.close() en el bloque finally.  Se parcheamos close()
    para que no cierre la connection compartida del fixture.
    """
    original_close = session.close

    def _noop_close():
        # No cerramos la sesión compartida durante el test; el fixture lo hace.
        pass

    session.close = _noop_close

    def factory():
        return session

    return factory, original_close


# ===========================================================================
# TestAutoExpireTenants
# ===========================================================================


class TestAutoExpireTenants:
    """Lógica de expiración automática de tenants (_auto_expire_tenants)."""

    def test_tenant_trial_expirado_se_desactiva(self, db_session):
        """trial_ends_at en el pasado y license_type='trial' → is_active=False, reason='expired'."""
        _skip_if_unavailable()

        tenant = Tenant(
            name="Empresa Trial Vencida",
            schema_name="trial_vencida_001",
            is_active=True,
            license_type="trial",
            trial_ends_at=datetime.utcnow() - timedelta(days=1),
        )
        db_session.add(tenant)
        db_session.flush()

        factory, restore_close = _make_factory(db_session)
        _auto_expire_tenants(factory)
        db_session.close = restore_close

        db_session.expire(tenant)
        assert tenant.is_active is False
        assert tenant.license_blocked_reason == "expired"

    def test_tenant_trial_vigente_no_se_toca(self, db_session):
        """trial_ends_at en el futuro → tenant permanece activo sin cambios."""
        _skip_if_unavailable()

        tenant = Tenant(
            name="Empresa Trial Vigente",
            schema_name="trial_vigente_001",
            is_active=True,
            license_type="trial",
            trial_ends_at=datetime.utcnow() + timedelta(days=10),
        )
        db_session.add(tenant)
        db_session.flush()

        factory, restore_close = _make_factory(db_session)
        _auto_expire_tenants(factory)
        db_session.close = restore_close

        db_session.expire(tenant)
        assert tenant.is_active is True
        assert tenant.license_blocked_reason is None

    def test_tenant_monthly_expirado_se_desactiva(self, db_session):
        """subscription_expires_at en el pasado con license_type='monthly' → se desactiva."""
        _skip_if_unavailable()

        tenant = Tenant(
            name="Empresa Monthly Vencida",
            schema_name="monthly_vencida_001",
            is_active=True,
            license_type="monthly",
            subscription_expires_at=datetime.utcnow() - timedelta(days=5),
        )
        db_session.add(tenant)
        db_session.flush()

        factory, restore_close = _make_factory(db_session)
        _auto_expire_tenants(factory)
        db_session.close = restore_close

        db_session.expire(tenant)
        assert tenant.is_active is False
        assert tenant.license_blocked_reason == "expired"

    def test_tenant_lifetime_nunca_expira(self, db_session):
        """license_type='lifetime' nunca debe desactivarse aunque tenga fecha pasada."""
        _skip_if_unavailable()

        tenant = Tenant(
            name="Empresa Lifetime",
            schema_name="lifetime_001",
            is_active=True,
            license_type="lifetime",
            # Fecha en el pasado, pero no aplica para lifetime
            subscription_expires_at=datetime.utcnow() - timedelta(days=365),
        )
        db_session.add(tenant)
        db_session.flush()

        factory, restore_close = _make_factory(db_session)
        _auto_expire_tenants(factory)
        db_session.close = restore_close

        db_session.expire(tenant)
        assert tenant.is_active is True
        assert tenant.license_blocked_reason is None

    def test_tenant_ya_inactivo_no_se_modifica(self, db_session):
        """Tenant con is_active=False ya no debe ser tocado por el scheduler."""
        _skip_if_unavailable()

        tenant = Tenant(
            name="Empresa Ya Suspendida",
            schema_name="ya_suspendida_001",
            is_active=False,
            license_type="trial",
            trial_ends_at=datetime.utcnow() - timedelta(days=30),
            license_blocked_reason="manual_suspend",
        )
        db_session.add(tenant)
        db_session.flush()

        factory, restore_close = _make_factory(db_session)
        _auto_expire_tenants(factory)
        db_session.close = restore_close

        db_session.expire(tenant)
        # La razón original debe permanecer; no debe sobreescribirse
        assert tenant.is_active is False
        assert tenant.license_blocked_reason == "manual_suspend"

    def test_multiples_tenants_expirados_todos_se_desactivan(self, db_session):
        """Varios tenants vencidos (trial + monthly) → todos quedan is_active=False."""
        _skip_if_unavailable()

        tenants = [
            Tenant(
                name="Trial A",
                schema_name="multi_trial_a",
                is_active=True,
                license_type="trial",
                trial_ends_at=datetime.utcnow() - timedelta(days=2),
            ),
            Tenant(
                name="Trial B",
                schema_name="multi_trial_b",
                is_active=True,
                license_type="trial",
                trial_ends_at=datetime.utcnow() - timedelta(hours=1),
            ),
            Tenant(
                name="Monthly C",
                schema_name="multi_monthly_c",
                is_active=True,
                license_type="monthly",
                subscription_expires_at=datetime.utcnow() - timedelta(days=10),
            ),
            Tenant(
                name="Annual D",
                schema_name="multi_annual_d",
                is_active=True,
                license_type="annual",
                subscription_expires_at=datetime.utcnow() - timedelta(days=1),
            ),
        ]
        for t in tenants:
            db_session.add(t)
        db_session.flush()

        factory, restore_close = _make_factory(db_session)
        _auto_expire_tenants(factory)
        db_session.close = restore_close

        for t in tenants:
            db_session.expire(t)
            assert t.is_active is False, f"Tenant {t.schema_name} debería estar inactivo"
            assert t.license_blocked_reason == "expired"

    def test_tenant_annual_vigente_no_se_toca(self, db_session):
        """subscription_expires_at en el futuro con license_type='annual' → sin cambios."""
        _skip_if_unavailable()

        tenant = Tenant(
            name="Empresa Annual Vigente",
            schema_name="annual_vigente_001",
            is_active=True,
            license_type="annual",
            subscription_expires_at=datetime.utcnow() + timedelta(days=180),
        )
        db_session.add(tenant)
        db_session.flush()

        factory, restore_close = _make_factory(db_session)
        _auto_expire_tenants(factory)
        db_session.close = restore_close

        db_session.expire(tenant)
        assert tenant.is_active is True
        assert tenant.license_blocked_reason is None

    def test_tenant_trial_sin_fecha_no_expira(self, db_session):
        """trial con trial_ends_at=None → no se desactiva (fecha no configurada)."""
        _skip_if_unavailable()

        tenant = Tenant(
            name="Empresa Trial Sin Fecha",
            schema_name="trial_sin_fecha_001",
            is_active=True,
            license_type="trial",
            trial_ends_at=None,
        )
        db_session.add(tenant)
        db_session.flush()

        factory, restore_close = _make_factory(db_session)
        _auto_expire_tenants(factory)
        db_session.close = restore_close

        db_session.expire(tenant)
        assert tenant.is_active is True


# ===========================================================================
# TestAutoExpireTenantsConMock
# ===========================================================================


class TestAutoExpireTenantsConMock:
    """Tests de _auto_expire_tenants usando MagicMock de session (sin BD real)."""

    def test_llama_commit_cuando_hay_expirados(self):
        """La función llama db.commit() si encuentra tenants vencidos."""
        _skip_if_unavailable()

        mock_tenant = MagicMock()
        mock_tenant.is_active = True
        mock_tenant.schema_name = "tenant_vencido"

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.all.return_value = [mock_tenant]

        factory = MagicMock(return_value=mock_db)

        _auto_expire_tenants(factory)

        mock_db.commit.assert_called_once()
        assert mock_tenant.is_active is False
        assert mock_tenant.license_blocked_reason == "expired"

    def test_llama_commit_cuando_no_hay_expirados(self):
        """La función llama db.commit() aunque no haya tenants vencidos."""
        _skip_if_unavailable()

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.all.return_value = []

        factory = MagicMock(return_value=mock_db)

        _auto_expire_tenants(factory)

        mock_db.commit.assert_called_once()

    def test_rollback_si_hay_excepcion(self):
        """Si ocurre un error inesperado, la función hace rollback y no propaga."""
        _skip_if_unavailable()

        mock_db = MagicMock()
        mock_db.query.side_effect = RuntimeError("Error de prueba simulado")

        factory = MagicMock(return_value=mock_db)

        # No debe propagar la excepción — la función la captura internamente
        _auto_expire_tenants(factory)

        mock_db.rollback.assert_called_once()

    def test_close_siempre_se_llama(self):
        """db.close() se llama en el bloque finally, incluso si hay error."""
        _skip_if_unavailable()

        mock_db = MagicMock()
        mock_db.query.side_effect = Exception("Fallo catastrófico")

        factory = MagicMock(return_value=mock_db)

        _auto_expire_tenants(factory)

        mock_db.close.assert_called_once()
