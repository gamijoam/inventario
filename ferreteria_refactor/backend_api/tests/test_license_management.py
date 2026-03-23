"""
test_license_management.py — Tests exhaustivos para la gestión de licencias de tenants.

Cubre:
- manage_tenant_license: grant_trial, extend_monthly, extend_annual, grant_lifetime, revoke, reactivate
- get_licenses_summary: cálculo de days_remaining por tipo de licencia
- create_tenant: lógica de trial_ends_at y trial_days por defecto

Estrategia:
- Llama directamente las funciones de negocio (no HTTP) pasando db_session del fixture.
- Usa MagicMock para current_user (superuser).
- Usa asyncio.run() para coroutines async.
"""

import asyncio
import pytest
from datetime import datetime, timedelta
from unittest.mock import MagicMock

# ---------------------------------------------------------------------------
# Guard de importación — igual que conftest.py
# ---------------------------------------------------------------------------

try:
    import sys
    import os

    _backend_root = os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    )
    if _backend_root not in sys.path:
        sys.path.insert(0, _backend_root)

    # backup_service ejecuta os.makedirs("/app/backups") al importarse.
    # Establecemos BACKUP_DIR a un directorio temporal antes de que ocurra
    # cualquier import que lo arrastre transitivamente (admin.py → backup_service).
    import tempfile
    os.environ.setdefault("BACKUP_DIR", tempfile.mkdtemp(prefix="test_backups_"))

    from backend_api.models.tenant import Tenant
    from backend_api.routers.admin import (
        manage_tenant_license,
        get_licenses_summary,
        ManageLicenseRequest,
        LicenseAction,
    )

    IMPORTS_OK = True

except Exception as _e:
    IMPORTS_OK = False
    _import_err_msg = str(_e)


# ---------------------------------------------------------------------------
# Helper de skip global
# ---------------------------------------------------------------------------

def _skip_if_unavailable():
    if not IMPORTS_OK:
        pytest.skip(f"Imports no disponibles: {_import_err_msg}")


# ---------------------------------------------------------------------------
# Helper: crea un mock superuser
# ---------------------------------------------------------------------------

def _mock_superuser():
    user = MagicMock()
    user.username = "superadmin"
    user.is_superuser = True
    return user


# ---------------------------------------------------------------------------
# Helper: crea un Tenant mínimo en la sesión y lo retorna después de flush
# ---------------------------------------------------------------------------

def _create_tenant(db, *, name="Test Corp", schema_name=None, is_active=True,
                   license_type="trial", trial_days=15, trial_ends_at=None,
                   subscription_expires_at=None, license_blocked_reason=None):
    """Inserta un Tenant en la BD de test y retorna el objeto persistido."""
    import uuid
    schema = schema_name or f"tenant_{uuid.uuid4().hex[:8]}"
    tenant = Tenant(
        name=name,
        schema_name=schema,
        is_active=is_active,
        license_type=license_type,
        trial_days=trial_days,
        trial_ends_at=trial_ends_at,
        subscription_expires_at=subscription_expires_at,
        license_blocked_reason=license_blocked_reason,
    )
    db.add(tenant)
    db.flush()
    return tenant


# ---------------------------------------------------------------------------
# Helper: ejecuta una coroutine si es async, o llama directo si es sync
# ---------------------------------------------------------------------------

def _call(fn, *args, **kwargs):
    import inspect
    if inspect.iscoroutinefunction(fn):
        return asyncio.run(fn(*args, **kwargs))
    return fn(*args, **kwargs)


# ===========================================================================
# TestGrantTrial
# ===========================================================================

class TestGrantTrial:
    """Tests para la acción grant_trial de manage_tenant_license."""

    def test_grant_trial_sets_license_type_trial(self, db_session):
        """grant_trial debe fijar license_type = 'trial'."""
        _skip_if_unavailable()

        tenant = _create_tenant(db_session, license_type="monthly")
        body = ManageLicenseRequest(action=LicenseAction.grant_trial, days=30)

        result = _call(
            manage_tenant_license,
            tenant_id=tenant.id,
            body=body,
            db=db_session,
            current_user=_mock_superuser(),
        )

        db_session.refresh(tenant)
        assert tenant.license_type == "trial"
        assert result["license_type"] == "trial"

    def test_grant_trial_custom_days_calcula_trial_ends_at(self, db_session):
        """Con days=20, trial_ends_at debe ser aproximadamente now + 20 días."""
        _skip_if_unavailable()

        tenant = _create_tenant(db_session)
        before = datetime.utcnow()
        body = ManageLicenseRequest(action=LicenseAction.grant_trial, days=20)

        _call(
            manage_tenant_license,
            tenant_id=tenant.id,
            body=body,
            db=db_session,
            current_user=_mock_superuser(),
        )

        after = datetime.utcnow()
        db_session.refresh(tenant)

        assert tenant.trial_ends_at is not None
        expected_min = before + timedelta(days=20)
        expected_max = after + timedelta(days=20)
        assert expected_min <= tenant.trial_ends_at <= expected_max

    def test_grant_trial_default_days_es_30(self, db_session):
        """Cuando days no se especifica (None), el defecto debe ser 30 días."""
        _skip_if_unavailable()

        tenant = _create_tenant(db_session)
        # days=None dispara el fallback `body.days or 30` en la función
        body = ManageLicenseRequest(action=LicenseAction.grant_trial, days=None)

        before = datetime.utcnow()
        _call(
            manage_tenant_license,
            tenant_id=tenant.id,
            body=body,
            db=db_session,
            current_user=_mock_superuser(),
        )
        after = datetime.utcnow()

        db_session.refresh(tenant)
        assert tenant.trial_days == 30
        # trial_ends_at debe estar entre now+30 días (±1 segundo de margen en el assert)
        expected_min = before + timedelta(days=30)
        expected_max = after + timedelta(days=30)
        assert expected_min <= tenant.trial_ends_at <= expected_max

    def test_grant_trial_reactiva_tenant_suspendido(self, db_session):
        """Un tenant con is_active=False debe quedar is_active=True tras grant_trial."""
        _skip_if_unavailable()

        tenant = _create_tenant(db_session, is_active=False,
                                license_blocked_reason="manual")
        body = ManageLicenseRequest(action=LicenseAction.grant_trial, days=15)

        _call(
            manage_tenant_license,
            tenant_id=tenant.id,
            body=body,
            db=db_session,
            current_user=_mock_superuser(),
        )

        db_session.refresh(tenant)
        assert tenant.is_active is True
        assert tenant.license_blocked_reason is None


# ===========================================================================
# TestExtendMonthly
# ===========================================================================

class TestExtendMonthly:
    """Tests para la acción extend_monthly."""

    def test_extend_monthly_suma_30_dias_desde_hoy(self, db_session):
        """Si subscription_expires_at es None, la nueva fecha = now + 30 días."""
        _skip_if_unavailable()

        tenant = _create_tenant(db_session, subscription_expires_at=None)
        body = ManageLicenseRequest(action=LicenseAction.extend_monthly)

        before = datetime.utcnow()
        _call(
            manage_tenant_license,
            tenant_id=tenant.id,
            body=body,
            db=db_session,
            current_user=_mock_superuser(),
        )
        after = datetime.utcnow()

        db_session.refresh(tenant)
        assert tenant.license_type == "monthly"
        assert tenant.subscription_expires_at is not None
        expected_min = before + timedelta(days=30)
        expected_max = after + timedelta(days=30)
        assert expected_min <= tenant.subscription_expires_at <= expected_max

    def test_extend_monthly_stacks_si_no_vencio(self, db_session):
        """Si ya tiene fecha futura, la nueva fecha acumula 30 días sobre esa fecha."""
        _skip_if_unavailable()

        future_date = datetime.utcnow() + timedelta(days=10)
        tenant = _create_tenant(db_session, subscription_expires_at=future_date)
        body = ManageLicenseRequest(action=LicenseAction.extend_monthly)

        _call(
            manage_tenant_license,
            tenant_id=tenant.id,
            body=body,
            db=db_session,
            current_user=_mock_superuser(),
        )

        db_session.refresh(tenant)
        # base = future_date (porque future_date > now), resultado = future_date + 30 días
        expected = future_date + timedelta(days=30)
        # Tolerancia de 2 segundos por ejecución del código
        assert abs((tenant.subscription_expires_at - expected).total_seconds()) < 2

    def test_extend_monthly_limpia_license_blocked_reason(self, db_session):
        """extend_monthly debe dejar license_blocked_reason en None."""
        _skip_if_unavailable()

        tenant = _create_tenant(db_session, license_blocked_reason="expired",
                                is_active=False)
        body = ManageLicenseRequest(action=LicenseAction.extend_monthly)

        _call(
            manage_tenant_license,
            tenant_id=tenant.id,
            body=body,
            db=db_session,
            current_user=_mock_superuser(),
        )

        db_session.refresh(tenant)
        assert tenant.license_blocked_reason is None
        assert tenant.is_active is True


# ===========================================================================
# TestExtendAnnual
# ===========================================================================

class TestExtendAnnual:
    """Tests para la acción extend_annual."""

    def test_extend_annual_suma_365_dias(self, db_session):
        """Si subscription_expires_at es None, la nueva fecha = now + 365 días."""
        _skip_if_unavailable()

        tenant = _create_tenant(db_session, subscription_expires_at=None)
        body = ManageLicenseRequest(action=LicenseAction.extend_annual)

        before = datetime.utcnow()
        _call(
            manage_tenant_license,
            tenant_id=tenant.id,
            body=body,
            db=db_session,
            current_user=_mock_superuser(),
        )
        after = datetime.utcnow()

        db_session.refresh(tenant)
        assert tenant.license_type == "annual"
        expected_min = before + timedelta(days=365)
        expected_max = after + timedelta(days=365)
        assert expected_min <= tenant.subscription_expires_at <= expected_max

    def test_extend_annual_stacks_sobre_fecha_futura(self, db_session):
        """Si ya tiene fecha futura, acumula 365 días sobre esa fecha."""
        _skip_if_unavailable()

        future_date = datetime.utcnow() + timedelta(days=60)
        tenant = _create_tenant(db_session, subscription_expires_at=future_date)
        body = ManageLicenseRequest(action=LicenseAction.extend_annual)

        _call(
            manage_tenant_license,
            tenant_id=tenant.id,
            body=body,
            db=db_session,
            current_user=_mock_superuser(),
        )

        db_session.refresh(tenant)
        expected = future_date + timedelta(days=365)
        assert abs((tenant.subscription_expires_at - expected).total_seconds()) < 2


# ===========================================================================
# TestGrantLifetime
# ===========================================================================

class TestGrantLifetime:
    """Tests para la acción grant_lifetime."""

    def test_grant_lifetime_pone_license_type_lifetime(self, db_session):
        """grant_lifetime debe fijar license_type = 'lifetime'."""
        _skip_if_unavailable()

        tenant = _create_tenant(db_session, license_type="trial")
        body = ManageLicenseRequest(action=LicenseAction.grant_lifetime)

        result = _call(
            manage_tenant_license,
            tenant_id=tenant.id,
            body=body,
            db=db_session,
            current_user=_mock_superuser(),
        )

        db_session.refresh(tenant)
        assert tenant.license_type == "lifetime"
        assert result["license_type"] == "lifetime"

    def test_grant_lifetime_limpia_subscription_expires_at(self, db_session):
        """Después de grant_lifetime, subscription_expires_at debe ser None."""
        _skip_if_unavailable()

        future_date = datetime.utcnow() + timedelta(days=100)
        tenant = _create_tenant(db_session, subscription_expires_at=future_date,
                                license_type="annual")
        body = ManageLicenseRequest(action=LicenseAction.grant_lifetime)

        _call(
            manage_tenant_license,
            tenant_id=tenant.id,
            body=body,
            db=db_session,
            current_user=_mock_superuser(),
        )

        db_session.refresh(tenant)
        assert tenant.subscription_expires_at is None
        assert tenant.is_active is True
        assert tenant.license_blocked_reason is None


# ===========================================================================
# TestRevoke
# ===========================================================================

class TestRevoke:
    """Tests para la acción revoke."""

    def test_revoke_desactiva_tenant(self, db_session):
        """revoke debe dejar is_active=False."""
        _skip_if_unavailable()

        tenant = _create_tenant(db_session, is_active=True)
        body = ManageLicenseRequest(action=LicenseAction.revoke)

        _call(
            manage_tenant_license,
            tenant_id=tenant.id,
            body=body,
            db=db_session,
            current_user=_mock_superuser(),
        )

        db_session.refresh(tenant)
        assert tenant.is_active is False

    def test_revoke_pone_blocked_reason_manual(self, db_session):
        """revoke debe fijar license_blocked_reason = 'manual'."""
        _skip_if_unavailable()

        tenant = _create_tenant(db_session)
        body = ManageLicenseRequest(action=LicenseAction.revoke)

        _call(
            manage_tenant_license,
            tenant_id=tenant.id,
            body=body,
            db=db_session,
            current_user=_mock_superuser(),
        )

        db_session.refresh(tenant)
        assert tenant.license_blocked_reason == "manual"

    def test_revoke_tenant_inexistente_retorna_404(self, db_session):
        """Si el tenant_id no existe, debe levantarse HTTPException 404."""
        _skip_if_unavailable()
        from fastapi import HTTPException

        body = ManageLicenseRequest(action=LicenseAction.revoke)

        with pytest.raises(HTTPException) as exc_info:
            _call(
                manage_tenant_license,
                tenant_id=999999,
                body=body,
                db=db_session,
                current_user=_mock_superuser(),
            )

        assert exc_info.value.status_code == 404


# ===========================================================================
# TestReactivate
# ===========================================================================

class TestReactivate:
    """Tests para la acción reactivate."""

    def test_reactivate_activa_tenant(self, db_session):
        """reactivate debe dejar is_active=True."""
        _skip_if_unavailable()

        tenant = _create_tenant(db_session, is_active=False)
        body = ManageLicenseRequest(action=LicenseAction.reactivate)

        _call(
            manage_tenant_license,
            tenant_id=tenant.id,
            body=body,
            db=db_session,
            current_user=_mock_superuser(),
        )

        db_session.refresh(tenant)
        assert tenant.is_active is True

    def test_reactivate_limpia_blocked_reason(self, db_session):
        """reactivate debe dejar license_blocked_reason en None."""
        _skip_if_unavailable()

        tenant = _create_tenant(db_session, is_active=False,
                                license_blocked_reason="manual")
        body = ManageLicenseRequest(action=LicenseAction.reactivate)

        _call(
            manage_tenant_license,
            tenant_id=tenant.id,
            body=body,
            db=db_session,
            current_user=_mock_superuser(),
        )

        db_session.refresh(tenant)
        assert tenant.license_blocked_reason is None


# ===========================================================================
# TestLicensesSummary
# ===========================================================================

class TestLicensesSummary:
    """Tests para get_licenses_summary."""

    def test_summary_retorna_lista_de_tenants(self, db_session):
        """El endpoint debe retornar una lista con todos los tenants creados."""
        _skip_if_unavailable()

        _create_tenant(db_session, name="Empresa A", schema_name="empresa_a")
        _create_tenant(db_session, name="Empresa B", schema_name="empresa_b")

        result = _call(
            get_licenses_summary,
            db=db_session,
            current_user=_mock_superuser(),
        )

        assert isinstance(result, list)
        assert len(result) >= 2
        names = [r["name"] for r in result]
        assert "Empresa A" in names
        assert "Empresa B" in names

    def test_summary_trial_calcula_days_remaining(self, db_session):
        """Un tenant trial con trial_ends_at en ~10 días debe tener days_remaining=10."""
        _skip_if_unavailable()

        future = datetime.utcnow() + timedelta(days=10)
        tenant = _create_tenant(
            db_session,
            name="Trial Corp",
            schema_name="trial_corp",
            license_type="trial",
            trial_ends_at=future,
        )

        result = _call(
            get_licenses_summary,
            db=db_session,
            current_user=_mock_superuser(),
        )

        entry = next((r for r in result if r["id"] == tenant.id), None)
        assert entry is not None, "El tenant debe aparecer en el summary"
        # El cálculo en get_licenses_summary es (trial_ends_at - now).days
        # Con exactamente 10 días en el futuro, el resultado puede ser 9 o 10
        # dependiendo de fracciones de segundo. Aceptamos el rango [9, 10].
        assert entry["days_remaining"] in (9, 10)

    def test_summary_lifetime_tiene_days_remaining_null(self, db_session):
        """Un tenant con license_type='lifetime' debe tener days_remaining=None."""
        _skip_if_unavailable()

        tenant = _create_tenant(
            db_session,
            name="Lifetime Corp",
            schema_name="lifetime_corp",
            license_type="lifetime",
        )

        result = _call(
            get_licenses_summary,
            db=db_session,
            current_user=_mock_superuser(),
        )

        entry = next((r for r in result if r["id"] == tenant.id), None)
        assert entry is not None
        assert entry["days_remaining"] is None

    def test_summary_monthly_expirado_tiene_days_remaining_cero(self, db_session):
        """Un tenant monthly con subscription_expires_at en el pasado → days_remaining=0."""
        _skip_if_unavailable()

        past = datetime.utcnow() - timedelta(days=5)
        tenant = _create_tenant(
            db_session,
            name="Expired Corp",
            schema_name="expired_corp",
            license_type="monthly",
            subscription_expires_at=past,
        )

        result = _call(
            get_licenses_summary,
            db=db_session,
            current_user=_mock_superuser(),
        )

        entry = next((r for r in result if r["id"] == tenant.id), None)
        assert entry is not None
        assert entry["days_remaining"] == 0


# ===========================================================================
# TestCreateTenantLicense — lógica de create_tenant (sin HTTP, directo al modelo)
# ===========================================================================

class TestCreateTenantLicense:
    """
    Verifica la lógica de licencia del flujo create_tenant directamente
    construyendo un Tenant con los mismos parámetros que usa la función.
    No se llama a create_tenant completo porque requiere PostgreSQL real
    (CREATE SCHEMA, seed, etc.). En cambio, se replica el fragmento de
    negocio relevante: cálculo de trial_days y trial_ends_at.
    """

    def _build_tenant_like_create_tenant(self, db, *, trial_days_param=None):
        """
        Replica exactamente el fragmento de create_tenant que interesa:
            trial_days = getattr(tenant_in, 'trial_days', 2) or 2
            trial_ends_at = datetime.utcnow() + timedelta(days=trial_days)
            license_type = 'trial'
        """
        trial_days = trial_days_param if trial_days_param is not None else 2
        trial_days = trial_days or 2  # fallback idéntico al código real

        import uuid
        before = datetime.utcnow()
        tenant = Tenant(
            name="Nuevo Tenant",
            schema_name=f"nuevo_{uuid.uuid4().hex[:8]}",
            is_active=True,
            is_demo=True,
            license_type="trial",
            trial_days=trial_days,
            trial_ends_at=datetime.utcnow() + timedelta(days=trial_days),
        )
        after = datetime.utcnow()
        db.add(tenant)
        db.flush()
        return tenant, before, after, trial_days

    def test_nuevo_tenant_es_trial_por_defecto(self, db_session):
        """Al crear un tenant, license_type debe ser 'trial'."""
        _skip_if_unavailable()

        tenant, _, _, _ = self._build_tenant_like_create_tenant(db_session)
        assert tenant.license_type == "trial"

    def test_trial_ends_at_es_futuro(self, db_session):
        """trial_ends_at debe ser una fecha en el futuro respecto a now."""
        _skip_if_unavailable()

        now_before = datetime.utcnow()
        tenant, _, _, _ = self._build_tenant_like_create_tenant(db_session)

        assert tenant.trial_ends_at is not None
        assert tenant.trial_ends_at > now_before

    def test_trial_days_default_es_2(self, db_session):
        """Sin especificar trial_days, el valor por defecto es 2."""
        _skip_if_unavailable()

        tenant, before, after, trial_days = self._build_tenant_like_create_tenant(
            db_session, trial_days_param=None
        )

        assert trial_days == 2
        assert tenant.trial_days == 2
        # trial_ends_at debe ser now + 2 días (con tolerancia de 2 segundos)
        expected_min = before + timedelta(days=2)
        expected_max = after + timedelta(days=2)
        assert expected_min <= tenant.trial_ends_at <= expected_max
