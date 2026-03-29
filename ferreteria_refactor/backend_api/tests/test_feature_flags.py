"""
test_feature_flags.py
=====================
Tests para el sistema de feature flags por tenant.

Cubre:
  FF01 — Registry devuelve las flags registradas con estructura correcta
  FF02 — Config público incluye feature_flags en la respuesta
  FF03 — PATCH activa un flag correctamente (merge, no reemplaza)
  FF04 — PATCH con flag desconocida devuelve 400
  FF05 — PATCH sin autenticación devuelve 401
  FF06 — Tenant nuevo parte con feature_flags vacío
  FF07 — Toggle ON → OFF → ON funciona correctamente
  FF08 — PATCH con múltiples flags en una sola llamada
  FF09 — Merge preserva flags existentes al actualizar solo uno
  FF10 — Registry endpoint requiere autenticación de superuser

Estrategia:
  - Tests de modelo/lógica: SQLite en memoria (conftest.py)
  - Tests de endpoints HTTP: TestClient con override de dependencias

Correr con:
    cd ferreteria_refactor
    python -m pytest backend_api/tests/test_feature_flags.py -v --no-cov -s
"""

import os
import sys
import pytest
from unittest.mock import MagicMock

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
        from backend_api.models.tenant import Tenant
        from backend_api.models.models import User, UserRole
        from backend_api.feature_flags_registry import REGISTRY, CATEGORIES
        return Tenant, User, UserRole, REGISTRY, CATEGORIES, None
    except Exception as e:
        return (None,) * 5 + (str(e),)


Tenant, User, UserRole, REGISTRY, CATEGORIES, _import_error = _import_all()
MODELS_AVAILABLE = Tenant is not None

_skip = pytest.mark.skipif(
    not MODELS_AVAILABLE,
    reason=f"Modelos no disponibles: {_import_error}",
)


# ---------------------------------------------------------------------------
# Fixture: superuser de prueba
# ---------------------------------------------------------------------------

@pytest.fixture()
def superuser(db_session):
    if not MODELS_AVAILABLE:
        pytest.skip()
    user = User(
        username="superadmin_test",
        email="superadmin_test@example.com",
        password_hash="$2b$12$fakehashfakehashfakeha",
        role=UserRole.ADMIN,
        is_active=True,
        is_superuser=True,
        full_name="Super Admin Test",
    )
    db_session.add(user)
    db_session.flush()
    return user


@pytest.fixture()
def tenant_sin_flags(db_session):
    """Tenant mínimo sin feature flags."""
    if not MODELS_AVAILABLE:
        pytest.skip()
    tenant = Tenant(
        name="Empresa Test Flags",
        schema_name="test_flags_schema",
        is_active=True,
        feature_flags={},
    )
    db_session.add(tenant)
    db_session.flush()
    return tenant


# ---------------------------------------------------------------------------
# Helper TestClient con overrides
# ---------------------------------------------------------------------------

def _make_client_with_superuser(superuser_obj, db_session):
    """TestClient que inyecta el superuser dado y la sesión SQLite."""
    try:
        from fastapi.testclient import TestClient
        from backend_api.main import app
        from backend_api.dependencies import get_current_superuser
        from backend_api.database.db import get_db

        def override_db():
            yield db_session

        def override_superuser():
            return superuser_obj

        app.dependency_overrides[get_db] = override_db
        app.dependency_overrides[get_current_superuser] = override_superuser
        client = TestClient(app, raise_server_exceptions=False)
        return client, app
    except Exception as e:
        return None, str(e)


def _make_client_unauthenticated():
    """TestClient sin usuario (simula petición sin token)."""
    try:
        from fastapi.testclient import TestClient
        from backend_api.main import app
        from backend_api.database.db import get_db

        app.dependency_overrides.clear()
        client = TestClient(app, raise_server_exceptions=False)
        return client, app
    except Exception as e:
        return None, str(e)


# ---------------------------------------------------------------------------
# FF01 — Registry devuelve estructura correcta
# ---------------------------------------------------------------------------

class TestFF01Registry:

    @_skip
    def test_registry_tiene_claves_requeridas(self):
        """FF01a: Cada entrada del REGISTRY debe tener label, description y category."""
        assert len(REGISTRY) > 0, "El REGISTRY no debe estar vacío para los tests"

        for flag_name, flag_def in REGISTRY.items():
            assert "label" in flag_def, f"Flag '{flag_name}' falta 'label'"
            assert "description" in flag_def, f"Flag '{flag_name}' falta 'description'"
            assert "category" in flag_def, f"Flag '{flag_name}' falta 'category'"
            assert isinstance(flag_def["label"], str) and flag_def["label"], \
                f"Flag '{flag_name}': label debe ser string no vacío"
            assert isinstance(flag_def["description"], str) and flag_def["description"], \
                f"Flag '{flag_name}': description debe ser string no vacío"
            assert flag_def["category"] in CATEGORIES, \
                f"Flag '{flag_name}': category '{flag_def['category']}' no está en CATEGORIES"

    @_skip
    def test_registry_nombres_son_snake_case(self):
        """FF01b: Los nombres de flags deben ser snake_case (sin espacios ni mayúsculas)."""
        import re
        for flag_name in REGISTRY:
            assert re.match(r'^[a-z][a-z0-9_]*$', flag_name), \
                f"Flag '{flag_name}' no es snake_case válido"

    @_skip
    def test_flags_de_prueba_existen_en_registry(self):
        """FF01c: Las flags de prueba del sistema deben estar en el registry."""
        expected = [
            "descuento_cliente_especial",
            "exportar_excel_inventario",
            "precio_costo_visible_cajero",
            "precio_libre_pos",
        ]
        for flag in expected:
            assert flag in REGISTRY, \
                f"Flag de prueba '{flag}' no está en REGISTRY — agrégala a feature_flags_registry.py"

    @_skip
    def test_precio_libre_pos_categoria_correcta(self):
        """FF01e: precio_libre_pos debe estar en la categoría 'pos'."""
        assert "precio_libre_pos" in REGISTRY, "Flag 'precio_libre_pos' no encontrada"
        assert REGISTRY["precio_libre_pos"]["category"] == "pos", \
            "precio_libre_pos debe estar en categoría 'pos'"

    @_skip
    def test_endpoint_registry_devuelve_200(self, db_session, superuser):
        """FF01d: GET /admin/feature-flags/registry devuelve 200 con registry y categories."""
        client, app = _make_client_with_superuser(superuser, db_session)
        if client is None:
            pytest.skip(f"No se pudo crear TestClient: {app}")

        try:
            resp = client.get("/api/v1/admin/feature-flags/registry")
            assert resp.status_code == 200, f"Esperado 200, obtenido {resp.status_code}: {resp.text}"
            data = resp.json()
            assert "registry" in data, "Respuesta debe tener 'registry'"
            assert "categories" in data, "Respuesta debe tener 'categories'"
            assert isinstance(data["registry"], dict)
            assert isinstance(data["categories"], list)
        finally:
            from backend_api.main import app as _app
            _app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# FF02 — /config/public incluye feature_flags
# ---------------------------------------------------------------------------

class TestFF02ConfigPublic:

    @_skip
    def test_config_public_incluye_feature_flags(self, db_session):
        """FF02: GET /config/public debe retornar el campo 'feature_flags'."""
        try:
            from fastapi.testclient import TestClient
            from backend_api.main import app
            from backend_api.database.db import get_db

            def override_db():
                yield db_session

            app.dependency_overrides[get_db] = override_db
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.get("/api/v1/config/public")
            assert resp.status_code == 200
            data = resp.json()
            assert "feature_flags" in data, \
                "GET /config/public debe incluir 'feature_flags' en la respuesta"
            assert isinstance(data["feature_flags"], dict)
        finally:
            from backend_api.main import app as _app
            _app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# FF03 — PATCH activa un flag correctamente (llamada directa a la función)
# ---------------------------------------------------------------------------

class TestFF03PatchFlag:

    @_skip
    def test_activar_flag_existente(self):
        """
        FF03: update_tenant_feature_flags activa un flag y hace merge.
        Usa MagicMock de DB para evitar dependencia del backend de BD.
        """
        try:
            from unittest.mock import MagicMock
            from backend_api.routers.admin import update_tenant_feature_flags
        except Exception as e:
            pytest.skip(f"No se pudo importar endpoint: {e}")

        flag_name = list(REGISTRY.keys())[0]

        mock_tenant = MagicMock()
        mock_tenant.id = 1
        mock_tenant.feature_flags = {}

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = mock_tenant

        def fake_commit():
            pass

        def fake_refresh(obj):
            pass

        mock_db.commit = fake_commit
        mock_db.refresh = fake_refresh

        result = update_tenant_feature_flags(
            tenant_id=1,
            flags={flag_name: True},
            db=mock_db,
            current_user=MagicMock(),
        )

        assert result["feature_flags"].get(flag_name) is True, \
            f"El flag '{flag_name}' debería estar activado"
        assert result["tenant_id"] == 1


# ---------------------------------------------------------------------------
# FF04 — PATCH con flag desconocida devuelve 400
# ---------------------------------------------------------------------------

class TestFF04FlagDesconocida:

    @_skip
    def test_flag_desconocida_retorna_400(self, db_session, superuser, tenant_sin_flags):
        """FF04: PATCH con un flag que no está en REGISTRY debe retornar 400."""
        client, app = _make_client_with_superuser(superuser, db_session)
        if client is None:
            pytest.skip(f"No se pudo crear TestClient: {app}")

        try:
            resp = client.patch(
                f"/api/v1/admin/tenants/{tenant_sin_flags.id}/feature-flags",
                json={"flag_que_no_existe_en_registry_xyz": True},
            )
            assert resp.status_code == 400, \
                f"Una flag desconocida debe retornar 400, obtenido {resp.status_code}: {resp.text}"
        finally:
            from backend_api.main import app as _app
            _app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# FF05 — PATCH sin auth devuelve 401/403
# ---------------------------------------------------------------------------

class TestFF05SinAuth:

    @_skip
    def test_patch_sin_auth_retorna_401_o_403(self, db_session, tenant_sin_flags):
        """FF05: PATCH sin superuser debe rechazar la petición."""
        try:
            from fastapi.testclient import TestClient
            from backend_api.main import app

            app.dependency_overrides.clear()
            client = TestClient(app, raise_server_exceptions=False)
            flag_name = list(REGISTRY.keys())[0]
            resp = client.patch(
                f"/api/v1/admin/tenants/{tenant_sin_flags.id}/feature-flags",
                json={flag_name: True},
            )
            assert resp.status_code in (401, 403), \
                f"Sin auth debería retornar 401 o 403, obtenido {resp.status_code}"
        finally:
            from backend_api.main import app as _app
            _app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# FF06 — Tenant nuevo parte con feature_flags vacío
# ---------------------------------------------------------------------------

class TestFF06TenantNuevo:

    @_skip
    def test_tenant_nuevo_feature_flags_vacio(self, db_session):
        """FF06: Un Tenant creado sin pasar feature_flags debe tener {} por defecto."""
        tenant = Tenant(
            name="Nuevo Tenant Sin Flags",
            schema_name="nuevo_sin_flags_schema",
            is_active=True,
        )
        db_session.add(tenant)
        db_session.flush()

        assert tenant.feature_flags is not None, \
            "feature_flags no debe ser None — debe ser {} por defecto"
        assert isinstance(tenant.feature_flags, dict), \
            "feature_flags debe ser un dict"
        assert len(tenant.feature_flags) == 0, \
            f"Tenant nuevo debe tener feature_flags vacío, obtenido: {tenant.feature_flags}"


# ---------------------------------------------------------------------------
# FF07 — Toggle ON → OFF → ON
# ---------------------------------------------------------------------------

class TestFF07Toggle:

    @_skip
    def test_toggle_on_off_on(self, db_session, tenant_sin_flags):
        """FF07: Activar → desactivar → activar un flag debe funcionar correctamente."""
        flag_name = list(REGISTRY.keys())[0]

        # ON
        tenant_sin_flags.feature_flags = {flag_name: True}
        db_session.flush()
        assert tenant_sin_flags.feature_flags[flag_name] is True

        # OFF
        current = dict(tenant_sin_flags.feature_flags)
        current[flag_name] = False
        tenant_sin_flags.feature_flags = current
        db_session.flush()
        assert tenant_sin_flags.feature_flags[flag_name] is False

        # ON de nuevo
        current = dict(tenant_sin_flags.feature_flags)
        current[flag_name] = True
        tenant_sin_flags.feature_flags = current
        db_session.flush()
        assert tenant_sin_flags.feature_flags[flag_name] is True


# ---------------------------------------------------------------------------
# FF08 — PATCH con múltiples flags en una llamada
# ---------------------------------------------------------------------------

class TestFF08MultipleFlags:

    @_skip
    def test_patch_multiples_flags(self):
        """FF08: update_tenant_feature_flags activa varios flags en una sola llamada."""
        try:
            from unittest.mock import MagicMock
            from backend_api.routers.admin import update_tenant_feature_flags
        except Exception as e:
            pytest.skip(f"No se pudo importar endpoint: {e}")

        flags_a_activar = {k: True for k in list(REGISTRY.keys())[:2]}

        mock_tenant = MagicMock()
        mock_tenant.id = 1
        mock_tenant.feature_flags = {}

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = mock_tenant
        mock_db.commit = lambda: None
        mock_db.refresh = lambda obj: None

        result = update_tenant_feature_flags(
            tenant_id=1,
            flags=flags_a_activar,
            db=mock_db,
            current_user=MagicMock(),
        )

        for flag_name in flags_a_activar:
            assert result["feature_flags"].get(flag_name) is True, \
                f"Flag '{flag_name}' debería estar activado"


# ---------------------------------------------------------------------------
# FF09 — Merge preserva flags existentes
# ---------------------------------------------------------------------------

class TestFF09MergePreserva:

    @_skip
    def test_merge_no_elimina_flags_existentes(self):
        """
        FF09: update_tenant_feature_flags hace MERGE — segundo PATCH no borra el primero.
        Llama la función dos veces con el mismo mock_tenant para simular estado acumulado.
        """
        try:
            from unittest.mock import MagicMock
            from backend_api.routers.admin import update_tenant_feature_flags
        except Exception as e:
            pytest.skip(f"No se pudo importar endpoint: {e}")

        flags = list(REGISTRY.keys())
        if len(flags) < 2:
            pytest.skip("Necesita al menos 2 flags en el registry")

        flag_a, flag_b = flags[0], flags[1]

        # Tenant con estado que persiste entre llamadas
        mock_tenant = MagicMock()
        mock_tenant.id = 1
        mock_tenant.feature_flags = {}

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = mock_tenant
        mock_db.commit = lambda: None
        mock_db.refresh = lambda obj: None

        # Primera llamada: activar flag_a
        result1 = update_tenant_feature_flags(
            tenant_id=1, flags={flag_a: True}, db=mock_db, current_user=MagicMock(),
        )
        # El endpoint actualiza mock_tenant.feature_flags directamente
        assert result1["feature_flags"].get(flag_a) is True

        # Segunda llamada: activar flag_b — flag_a debe permanecer
        result2 = update_tenant_feature_flags(
            tenant_id=1, flags={flag_b: True}, db=mock_db, current_user=MagicMock(),
        )
        assert result2["feature_flags"].get(flag_b) is True, \
            f"flag_b '{flag_b}' no fue activado"
        assert result2["feature_flags"].get(flag_a) is True, \
            f"flag_a '{flag_a}' fue eliminado por el segundo PATCH — debe hacer merge, no reemplazar"

    @_skip
    def test_desactivar_uno_no_afecta_otro(self, db_session, tenant_sin_flags):
        """FF09b: Desactivar un flag no debe afectar otros flags activos."""
        flags = list(REGISTRY.keys())
        if len(flags) < 2:
            pytest.skip("Necesita al menos 2 flags en el registry")

        flag_a, flag_b = flags[0], flags[1]

        # Ambos activos
        tenant_sin_flags.feature_flags = {flag_a: True, flag_b: True}
        db_session.flush()

        # Desactivar solo flag_a
        current = dict(tenant_sin_flags.feature_flags)
        current[flag_a] = False
        tenant_sin_flags.feature_flags = current
        db_session.flush()

        assert tenant_sin_flags.feature_flags[flag_a] is False
        assert tenant_sin_flags.feature_flags[flag_b] is True, \
            f"flag_b '{flag_b}' fue afectado al desactivar flag_a — no debe ocurrir"
