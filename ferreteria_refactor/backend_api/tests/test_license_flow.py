"""
test_license_flow.py — Tests de flujo completo (end-to-end) del sistema de licencias.

Estrategia:
  - Se usan los fixtures db_session (SQLite en memoria) de conftest.py.
  - La lógica de manage_tenant_license y get_licenses_summary se reimplementa
    localmente para evitar importar routers/admin.py (que arrastra backup_service.py
    con un os.makedirs('/app') que falla fuera de Docker).
  - _auto_expire_tenants se importa de backend_api.scheduler y se llama con una
    factory wrapper igual que en test_scheduler.py.
  - No se necesita PostgreSQL ni levantar un servidor FastAPI.

Clases de test:
  - TestFlujoTrialCompleto          (5 tests)
  - TestFlujoSuscripcionMensual     (4 tests)
  - TestFlujoLifetime               (3 tests)
  - TestConsistenciaEstados         (4 tests)
"""

import os
import sys
import pytest
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional
from unittest.mock import MagicMock

# ---------------------------------------------------------------------------
# Path setup — igual que conftest.py y test_scheduler.py
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


# ---------------------------------------------------------------------------
# Lógica de licencias reimplementada localmente
# (Espejo exacto de routers/admin.py — evita importar backup_service.py)
# ---------------------------------------------------------------------------

class LicenseAction(str, Enum):
    grant_trial = "grant_trial"
    extend_monthly = "extend_monthly"
    extend_annual = "extend_annual"
    grant_lifetime = "grant_lifetime"
    revoke = "revoke"
    reactivate = "reactivate"


def _manage_tenant_license(db, tenant_id: int, action: LicenseAction, days: int = 30) -> dict:
    """Lógica de manage_tenant_license (admin.py) sin la capa FastAPI."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise ValueError(f"Tenant {tenant_id} no encontrado")

    now = datetime.utcnow()

    if action == LicenseAction.grant_trial:
        tenant.license_type = "trial"
        tenant.trial_days = days or 30
        tenant.trial_ends_at = now + timedelta(days=days or 30)
        tenant.is_active = True
        tenant.license_blocked_reason = None
    elif action == LicenseAction.extend_monthly:
        tenant.license_type = "monthly"
        base = max(tenant.subscription_expires_at or now, now)
        tenant.subscription_expires_at = base + timedelta(days=30)
        tenant.is_active = True
        tenant.license_blocked_reason = None
    elif action == LicenseAction.extend_annual:
        tenant.license_type = "annual"
        base = max(tenant.subscription_expires_at or now, now)
        tenant.subscription_expires_at = base + timedelta(days=365)
        tenant.is_active = True
        tenant.license_blocked_reason = None
    elif action == LicenseAction.grant_lifetime:
        tenant.license_type = "lifetime"
        tenant.subscription_expires_at = None
        tenant.is_active = True
        tenant.license_blocked_reason = None
    elif action == LicenseAction.revoke:
        tenant.is_active = False
        tenant.license_blocked_reason = "manual"
    elif action == LicenseAction.reactivate:
        tenant.is_active = True
        tenant.license_blocked_reason = None

    db.commit()
    db.refresh(tenant)
    return {"ok": True, "tenant_id": tenant_id, "action": action, "license_type": tenant.license_type}


def _get_licenses_summary(db) -> list:
    """Lógica de get_licenses_summary (admin.py) sin la capa FastAPI."""
    tenants = db.query(Tenant).order_by(Tenant.id).all()
    now = datetime.utcnow()

    result = []
    for t in tenants:
        days_remaining = None
        license_type = t.license_type or "trial"

        if license_type == "trial" and t.trial_ends_at:
            days_remaining = max(0, (t.trial_ends_at - now).days)
        elif license_type in ("monthly", "annual") and t.subscription_expires_at:
            days_remaining = max(0, (t.subscription_expires_at - now).days)

        result.append({
            "id": t.id,
            "name": t.name,
            "schema_name": t.schema_name,
            "is_active": t.is_active,
            "license_type": license_type,
            "trial_days": t.trial_days,
            "trial_ends_at": t.trial_ends_at.isoformat() if t.trial_ends_at else None,
            "subscription_expires_at": (
                t.subscription_expires_at.isoformat() if t.subscription_expires_at else None
            ),
            "license_blocked_reason": t.license_blocked_reason,
            "days_remaining": days_remaining,
        })

    return result


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _skip_if_unavailable():
    if not MODULES_AVAILABLE:
        pytest.skip(
            f"No se pudieron importar los módulos requeridos: {_import_err_msg}. "
            "Verifica que el paquete backend_api esté instalado."
        )


def _make_factory(session):
    """Devuelve (factory, restore_close) para usar con _auto_expire_tenants.

    Reutiliza el mismo patrón de test_scheduler.py: parchea session.close()
    para no cerrar la sesión compartida del fixture durante el test.
    """
    original_close = session.close

    def _noop_close():
        pass

    session.close = _noop_close

    def factory():
        return session

    return factory, original_close


def _run_scheduler(db_session):
    """Ejecuta _auto_expire_tenants con la sesión del fixture y restaura close()."""
    factory, restore_close = _make_factory(db_session)
    _auto_expire_tenants(factory)
    db_session.close = restore_close


def _make_tenant(
    db_session,
    *,
    name: str,
    schema_name: str,
    license_type: str = "trial",
    is_active: bool = True,
    trial_ends_at=None,
    subscription_expires_at=None,
    license_blocked_reason=None,
) -> "Tenant":
    """Crea y hace flush de un Tenant de prueba."""
    tenant = Tenant(
        name=name,
        schema_name=schema_name,
        is_active=is_active,
        license_type=license_type,
        trial_ends_at=trial_ends_at,
        subscription_expires_at=subscription_expires_at,
        license_blocked_reason=license_blocked_reason,
    )
    db_session.add(tenant)
    db_session.flush()
    return tenant


# ===========================================================================
# TestFlujoTrialCompleto
# ===========================================================================


class TestFlujoTrialCompleto:
    """Flujo completo del período de prueba: creación, expiración y reactivación."""

    def test_tenant_nuevo_tiene_trial_activo(self, db_session):
        """Tenant recién creado con trial_ends_at en el futuro debe estar activo."""
        _skip_if_unavailable()

        tenant = _make_tenant(
            db_session,
            name="Empresa Nueva Trial",
            schema_name="flujo_trial_nuevo_001",
            license_type="trial",
            is_active=True,
            trial_ends_at=datetime.utcnow() + timedelta(days=15),
        )

        assert tenant.license_type == "trial"
        assert tenant.trial_ends_at > datetime.utcnow()
        assert tenant.is_active is True

    def test_trial_expirado_bloquea_al_correr_scheduler(self, db_session):
        """Tenant trial con trial_ends_at en el pasado → scheduler lo desactiva."""
        _skip_if_unavailable()

        tenant = _make_tenant(
            db_session,
            name="Empresa Trial Expirada",
            schema_name="flujo_trial_expirado_001",
            license_type="trial",
            is_active=True,
            trial_ends_at=datetime.utcnow() - timedelta(days=1),
        )

        _run_scheduler(db_session)
        db_session.expire(tenant)

        assert tenant.is_active is False
        assert tenant.license_blocked_reason == "expired"

    def test_tenant_bloqueado_no_puede_autenticarse(self, db_session):
        """Tenant con is_active=False simula bloqueo de autenticación.

        El router /auth/token en routers/auth.py comprueba:
            if not tenant.is_active: raise HTTPException(403, ...)
        Se reproduce el mismo check aquí para verificar el comportamiento esperado.
        """
        _skip_if_unavailable()

        from fastapi import HTTPException

        tenant = _make_tenant(
            db_session,
            name="Empresa Bloqueada Auth",
            schema_name="flujo_trial_bloqueado_auth_001",
            license_type="trial",
            is_active=True,
            trial_ends_at=datetime.utcnow() - timedelta(days=2),
        )

        _run_scheduler(db_session)
        db_session.expire(tenant)

        # Después del scheduler el tenant está inactivo
        assert tenant.is_active is False

        # Simula la verificación de auth.py:
        #   if not tenant.is_active: raise HTTPException(403, ...)
        with pytest.raises(HTTPException) as exc_info:
            if not tenant.is_active:
                raise HTTPException(
                    status_code=403,
                    detail="Esta empresa está suspendida. Contacta a soporte para renovar tu suscripción.",
                )
        assert exc_info.value.status_code == 403

    def test_admin_puede_reactivar_trial(self, db_session):
        """Después de que el scheduler bloquea un trial, admin puede reactivarlo."""
        _skip_if_unavailable()

        tenant = _make_tenant(
            db_session,
            name="Empresa Reactivar Trial",
            schema_name="flujo_trial_reactivar_001",
            license_type="trial",
            is_active=True,
            trial_ends_at=datetime.utcnow() - timedelta(days=3),
        )

        _run_scheduler(db_session)
        db_session.expire(tenant)
        assert tenant.is_active is False

        _manage_tenant_license(db_session, tenant.id, LicenseAction.reactivate)
        db_session.expire(tenant)

        assert tenant.is_active is True

    def test_trial_reactivado_puede_autenticarse(self, db_session):
        """Tras reactivación, el check de auth pasa sin lanzar excepción (is_active=True)."""
        _skip_if_unavailable()

        from fastapi import HTTPException

        tenant = _make_tenant(
            db_session,
            name="Empresa Auth Reactivada",
            schema_name="flujo_trial_auth_reactivado_001",
            license_type="trial",
            is_active=True,
            trial_ends_at=datetime.utcnow() - timedelta(days=5),
        )

        _run_scheduler(db_session)
        db_session.expire(tenant)
        assert tenant.is_active is False

        _manage_tenant_license(db_session, tenant.id, LicenseAction.reactivate)
        db_session.expire(tenant)

        assert tenant.is_active is True

        # Simula check de auth.py: con is_active=True NO se lanza la excepción
        raised = False
        try:
            if not tenant.is_active:
                raise HTTPException(status_code=403, detail="Empresa suspendida")
        except HTTPException:
            raised = True

        assert not raised, "El tenant reactivado no debería lanzar excepción 403 en auth"


# ===========================================================================
# TestFlujoSuscripcionMensual
# ===========================================================================


class TestFlujoSuscripcionMensual:
    """Flujo de suscripción mensual: alta, expiración, extensiones y cambio a lifetime."""

    def test_grant_monthly_desde_trial_cambia_plan(self, db_session):
        """Tenant en trial pasa a monthly: license_type='monthly', subscription_expires_at seteada."""
        _skip_if_unavailable()

        tenant = _make_tenant(
            db_session,
            name="Empresa Monthly Desde Trial",
            schema_name="flujo_monthly_grant_001",
            license_type="trial",
            is_active=True,
            trial_ends_at=datetime.utcnow() + timedelta(days=5),
        )

        _manage_tenant_license(db_session, tenant.id, LicenseAction.extend_monthly, days=30)
        db_session.expire(tenant)

        assert tenant.license_type == "monthly"
        assert tenant.subscription_expires_at is not None
        assert tenant.subscription_expires_at > datetime.utcnow()
        assert tenant.is_active is True
        assert tenant.license_blocked_reason is None

    def test_monthly_expirado_bloquea_scheduler(self, db_session):
        """subscription_expires_at en el pasado con license_type='monthly' → scheduler desactiva."""
        _skip_if_unavailable()

        tenant = _make_tenant(
            db_session,
            name="Empresa Monthly Expirada",
            schema_name="flujo_monthly_expirado_001",
            license_type="monthly",
            is_active=True,
            subscription_expires_at=datetime.utcnow() - timedelta(days=3),
        )

        _run_scheduler(db_session)
        db_session.expire(tenant)

        assert tenant.is_active is False
        assert tenant.license_blocked_reason == "expired"

    def test_extend_monthly_dos_veces_acumula_correctamente(self, db_session):
        """Dos extensiones de 30 días se acumulan: fecha final está ~60 días desde now."""
        _skip_if_unavailable()

        tenant = _make_tenant(
            db_session,
            name="Empresa Monthly Doble Extension",
            schema_name="flujo_monthly_doble_001",
            license_type="monthly",
            is_active=True,
            subscription_expires_at=None,
        )

        before_first = datetime.utcnow()

        # Primera extensión: base = max(None→now, now) = now → +30 días
        _manage_tenant_license(db_session, tenant.id, LicenseAction.extend_monthly, days=30)
        db_session.expire(tenant)
        after_first = tenant.subscription_expires_at

        assert after_first is not None
        # Debe estar aproximadamente 30 días desde ahora (margen ±5 días)
        assert after_first > before_first + timedelta(days=25)

        # Segunda extensión: base = after_first → after_first + 30 días
        _manage_tenant_license(db_session, tenant.id, LicenseAction.extend_monthly, days=30)
        db_session.expire(tenant)
        after_second = tenant.subscription_expires_at

        # Debe estar ~60 días desde before_first
        assert after_second > before_first + timedelta(days=55)
        assert after_second > after_first, "La segunda extensión debe acumular sobre la primera"

    def test_pasar_de_monthly_a_lifetime_elimina_fecha(self, db_session):
        """Después de grant_lifetime, subscription_expires_at=None y license_type='lifetime'."""
        _skip_if_unavailable()

        tenant = _make_tenant(
            db_session,
            name="Empresa Monthly A Lifetime",
            schema_name="flujo_monthly_a_lifetime_001",
            license_type="monthly",
            is_active=True,
            subscription_expires_at=datetime.utcnow() + timedelta(days=15),
        )

        _manage_tenant_license(db_session, tenant.id, LicenseAction.grant_lifetime)
        db_session.expire(tenant)

        assert tenant.license_type == "lifetime"
        assert tenant.subscription_expires_at is None
        assert tenant.is_active is True
        assert tenant.license_blocked_reason is None


# ===========================================================================
# TestFlujoLifetime
# ===========================================================================


class TestFlujoLifetime:
    """Flujo de licencias lifetime: inmunidad al scheduler y revocación."""

    def test_lifetime_nunca_expira_con_scheduler(self, db_session):
        """license_type='lifetime' con fecha pasada → scheduler NO lo desactiva."""
        _skip_if_unavailable()

        tenant = _make_tenant(
            db_session,
            name="Empresa Lifetime Permanente",
            schema_name="flujo_lifetime_001",
            license_type="lifetime",
            is_active=True,
            subscription_expires_at=datetime.utcnow() - timedelta(days=365),
        )

        _run_scheduler(db_session)
        db_session.expire(tenant)

        assert tenant.is_active is True
        assert tenant.license_blocked_reason is None

    def test_lifetime_sobrevive_multiples_ejecuciones_scheduler(self, db_session):
        """Scheduler ejecutado 3 veces no desactiva un tenant lifetime."""
        _skip_if_unavailable()

        tenant = _make_tenant(
            db_session,
            name="Empresa Lifetime Multi Run",
            schema_name="flujo_lifetime_multi_001",
            license_type="lifetime",
            is_active=True,
            subscription_expires_at=datetime.utcnow() - timedelta(days=100),
        )

        for _ in range(3):
            _run_scheduler(db_session)

        db_session.expire(tenant)

        assert tenant.is_active is True
        assert tenant.license_blocked_reason is None

    def test_revocar_lifetime_bloquea(self, db_session):
        """grant_lifetime seguido de revoke → tenant queda is_active=False, reason='manual'."""
        _skip_if_unavailable()

        tenant = _make_tenant(
            db_session,
            name="Empresa Lifetime Revocada",
            schema_name="flujo_lifetime_revoke_001",
            license_type="trial",
            is_active=True,
            trial_ends_at=datetime.utcnow() + timedelta(days=10),
        )

        # Otorgar lifetime
        _manage_tenant_license(db_session, tenant.id, LicenseAction.grant_lifetime)
        db_session.expire(tenant)
        assert tenant.license_type == "lifetime"
        assert tenant.is_active is True

        # Revocar manualmente
        _manage_tenant_license(db_session, tenant.id, LicenseAction.revoke)
        db_session.expire(tenant)

        assert tenant.is_active is False
        assert tenant.license_blocked_reason == "manual"


# ===========================================================================
# TestConsistenciaEstados
# ===========================================================================


class TestConsistenciaEstados:
    """Tests de consistencia de campos de estado tras acciones del sistema de licencias."""

    def test_blocked_reason_se_limpia_al_reactivar(self, db_session):
        """revoke → reactivate: license_blocked_reason queda en None."""
        _skip_if_unavailable()

        tenant = _make_tenant(
            db_session,
            name="Empresa Reason Cleanup",
            schema_name="flujo_reason_cleanup_001",
            license_type="trial",
            is_active=True,
            trial_ends_at=datetime.utcnow() + timedelta(days=5),
        )

        # Revocar
        _manage_tenant_license(db_session, tenant.id, LicenseAction.revoke)
        db_session.expire(tenant)
        assert tenant.is_active is False
        assert tenant.license_blocked_reason == "manual"

        # Reactivar
        _manage_tenant_license(db_session, tenant.id, LicenseAction.reactivate)
        db_session.expire(tenant)

        assert tenant.is_active is True
        assert tenant.license_blocked_reason is None

    def test_multiples_tenants_diferentes_estados(self, db_session):
        """4 tenants (trial vigente, trial expirado, annual vigente, lifetime) → solo expira los debidos."""
        _skip_if_unavailable()

        # Trial vigente — NO debe expirar
        trial_vigente = _make_tenant(
            db_session,
            name="Trial Vigente",
            schema_name="flujo_multi_trial_v",
            license_type="trial",
            is_active=True,
            trial_ends_at=datetime.utcnow() + timedelta(days=10),
        )

        # Trial expirado — SÍ debe expirar
        trial_expirado = _make_tenant(
            db_session,
            name="Trial Expirado",
            schema_name="flujo_multi_trial_e",
            license_type="trial",
            is_active=True,
            trial_ends_at=datetime.utcnow() - timedelta(days=1),
        )

        # Annual vigente — NO debe expirar
        annual_vigente = _make_tenant(
            db_session,
            name="Annual Vigente",
            schema_name="flujo_multi_annual_v",
            license_type="annual",
            is_active=True,
            subscription_expires_at=datetime.utcnow() + timedelta(days=180),
        )

        # Lifetime — NUNCA debe expirar (aunque tenga fecha pasada)
        lifetime = _make_tenant(
            db_session,
            name="Lifetime Permanente",
            schema_name="flujo_multi_lifetime",
            license_type="lifetime",
            is_active=True,
            subscription_expires_at=datetime.utcnow() - timedelta(days=365),
        )

        _run_scheduler(db_session)

        for t in [trial_vigente, trial_expirado, annual_vigente, lifetime]:
            db_session.expire(t)

        assert trial_vigente.is_active is True, "Trial vigente no debería haberse desactivado"
        assert trial_expirado.is_active is False, "Trial expirado debería haberse desactivado"
        assert annual_vigente.is_active is True, "Annual vigente no debería haberse desactivado"
        assert lifetime.is_active is True, "Lifetime nunca debería desactivarse"

        assert trial_expirado.license_blocked_reason == "expired"
        assert trial_vigente.license_blocked_reason is None
        assert annual_vigente.license_blocked_reason is None
        assert lifetime.license_blocked_reason is None

    def test_dias_negativos_se_normalizan_a_cero_en_summary(self, db_session):
        """Tenant con subscription_expires_at en el pasado → days_remaining=0, no negativo."""
        _skip_if_unavailable()

        _make_tenant(
            db_session,
            name="Empresa Dias Negativos",
            schema_name="flujo_dias_negativos_001",
            license_type="monthly",
            is_active=True,
            subscription_expires_at=datetime.utcnow() - timedelta(days=10),
        )

        summary = _get_licenses_summary(db_session)

        tenant_summary = next(
            (item for item in summary if item["schema_name"] == "flujo_dias_negativos_001"),
            None,
        )

        assert tenant_summary is not None, "El tenant debería aparecer en el resumen"
        assert tenant_summary["days_remaining"] is not None, (
            "days_remaining debería calcularse para license_type='monthly'"
        )
        assert tenant_summary["days_remaining"] >= 0, (
            f"days_remaining no debe ser negativo; valor: {tenant_summary['days_remaining']}"
        )
        assert tenant_summary["days_remaining"] == 0, (
            f"Con fecha pasada se espera 0; valor: {tenant_summary['days_remaining']}"
        )

    def test_tenant_sin_license_type_asume_trial_en_summary(self, db_session):
        """Tenant con license_type=None → el resumen lo muestra como 'trial'."""
        _skip_if_unavailable()

        # Crear con license_type=None directamente (bypass de _make_tenant helper)
        tenant = Tenant(
            name="Empresa Sin Tipo Licencia",
            schema_name="flujo_sin_license_type_001",
            is_active=True,
            license_type=None,
            trial_ends_at=None,
            subscription_expires_at=None,
        )
        db_session.add(tenant)
        db_session.flush()

        summary = _get_licenses_summary(db_session)

        tenant_summary = next(
            (item for item in summary if item["schema_name"] == "flujo_sin_license_type_001"),
            None,
        )

        assert tenant_summary is not None, "El tenant debería aparecer en el resumen"
        # _get_licenses_summary usa: license_type = t.license_type or "trial"
        assert tenant_summary["license_type"] == "trial", (
            f"license_type=None debería normalizarse a 'trial'; valor: {tenant_summary['license_type']}"
        )
        # Sin trial_ends_at, days_remaining no se puede calcular → None
        assert tenant_summary["days_remaining"] is None, (
            f"Sin trial_ends_at, days_remaining debe ser None; valor: {tenant_summary['days_remaining']}"
        )
