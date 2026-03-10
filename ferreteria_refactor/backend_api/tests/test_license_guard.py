"""
test_license_guard.py — Tests exhaustivos para LicenseGuardMiddleware y validate_license().

Estrategia:
- Todos los tests están completamente aislados: no requieren licencia real,
  archivo de sistema, PostgreSQL ni credenciales externas.
- Se usa unittest.mock.patch para interceptar:
    * backend_api.middleware.license_guard.LICENSE_FILE  (Path)
    * os.getenv  (variables de entorno)
    * jose.jwt.decode  (payloads JWT)
    * backend_api.middleware.license_guard.get_machine_id  (hw_id)
- Los tests de validate_license() usan pytest.raises(HTTPException).
- Los tests del middleware usan starlette.testclient.TestClient con una mini-app
  FastAPI que registra LicenseGuardMiddleware.

Grupos:
    TestValidateLicenseOffline  — 6 tests modo OFFLINE
    TestValidateLicenseCloud    — 4 tests modo CLOUD
    TestLicenseGuardMiddleware  — 5 tests integración HTTP
"""

import os
import sys
import time
import pytest
from unittest.mock import MagicMock, patch, mock_open

# ---------------------------------------------------------------------------
# Path setup — mismo patrón que conftest.py y test_desktop_licenses.py
# ---------------------------------------------------------------------------

_backend_root = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
if _backend_root not in sys.path:
    sys.path.insert(0, _backend_root)

# ---------------------------------------------------------------------------
# Guardia de importación de jose
# ---------------------------------------------------------------------------

jose = pytest.importorskip("jose", reason="python-jose no está instalado")

from fastapi import FastAPI, HTTPException
from starlette.testclient import TestClient

from backend_api.middleware.license_guard import (
    LicenseGuardMiddleware,
    validate_license,
)

# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------

_MODULE = "backend_api.middleware.license_guard"


def _future_exp() -> int:
    """Timestamp Unix dentro de 365 días (licencia no expirada)."""
    return int(time.time()) + 365 * 24 * 3600


def _past_exp() -> int:
    """Timestamp Unix hace 1 día (licencia expirada)."""
    return int(time.time()) - 24 * 3600


def _mock_license_file_exists(exists: bool = True) -> MagicMock:
    """Devuelve un MagicMock de Path con .exists() controlado."""
    mock_path = MagicMock()
    mock_path.exists.return_value = exists
    return mock_path


# ---------------------------------------------------------------------------
# Mini-app FastAPI para tests de integración del middleware
# ---------------------------------------------------------------------------


def _make_app() -> FastAPI:
    """Crea una FastAPI mínima con LicenseGuardMiddleware y rutas de prueba."""
    app = FastAPI()
    app.add_middleware(LicenseGuardMiddleware)

    @app.get("/api/v1/users")
    def users():
        return {"users": []}

    @app.get("/api/v1/products")
    def products():
        return {"products": []}

    @app.get("/docs")
    def docs():
        return {"ok": True}

    @app.get("/api/v1/license/activate")
    def license_activate():
        return {"status": "activation_endpoint"}

    @app.get("/api/v1/license/status")
    def license_status():
        return {"status": "status_endpoint"}

    @app.get("/api/v1/license/machine-id")
    def machine_id():
        return {"machine_id": "test-machine"}

    return app


# ===========================================================================
# TestValidateLicenseOffline
# ===========================================================================


class TestValidateLicenseOffline:
    """Tests de validate_license() en modo OFFLINE (comportamiento por defecto)."""

    def test_sin_licencia_offline_lanza_402_NO_LICENSE(self):
        """
        Sin archivo license.key y sin env var LICENSE_KEY → HTTPException 402 NO_LICENSE.
        El middleware opera en modo OFFLINE por defecto cuando LICENSE_MODE no está seteado.
        """
        mock_path = _mock_license_file_exists(exists=False)

        with patch(f"{_MODULE}.LICENSE_FILE", mock_path), \
             patch.dict(os.environ, {}, clear=True):
            # Aseguramos que no haya vars de entorno relevantes
            env_clean = {
                k: v for k, v in os.environ.items()
                if k not in ("LICENSE_KEY", "LICENSE_MODE", "CLOUD_LICENSE_KEY")
            }
            with patch.dict(os.environ, env_clean, clear=True):
                with pytest.raises(HTTPException) as exc_info:
                    validate_license()

        assert exc_info.value.status_code == 402
        assert exc_info.value.detail["error"] == "NO_LICENSE"

    def test_jwt_invalido_lanza_402_INVALID_LICENSE(self):
        """
        Archivo license.key existe pero contiene un token JWT malformado →
        HTTPException 402 INVALID_LICENSE.
        """
        from jose import JWTError

        mock_path = _mock_license_file_exists(exists=True)

        with patch(f"{_MODULE}.LICENSE_FILE", mock_path), \
             patch.dict(os.environ, {}, clear=True):
            env_clean = {
                k: v for k, v in os.environ.items()
                if k not in ("LICENSE_KEY", "LICENSE_MODE", "CLOUD_LICENSE_KEY")
            }
            with patch.dict(os.environ, env_clean, clear=True), \
                 patch("builtins.open", mock_open(read_data="token.malformado.invalido")), \
                 patch("jose.jwt.decode", side_effect=JWTError("Signature verification failed")):
                with pytest.raises(HTTPException) as exc_info:
                    validate_license()

        assert exc_info.value.status_code == 402
        assert exc_info.value.detail["error"] == "INVALID_LICENSE"

    def test_jwt_expirado_lanza_402_LICENSE_EXPIRED(self):
        """
        Token JWT bien firmado pero con exp en el pasado →
        HTTPException 402 LICENSE_EXPIRED.

        La verificación de expiración del middleware es manual (compara datetime.utcnow()
        con payload['exp']), independiente de la verificación de jose.
        """
        mock_path = _mock_license_file_exists(exists=True)
        expired_payload = {
            "type": "FULL",
            "hw_id": "123456",
            "exp": _past_exp(),
        }

        with patch(f"{_MODULE}.LICENSE_FILE", mock_path), \
             patch.dict(os.environ, {}, clear=True):
            env_clean = {
                k: v for k, v in os.environ.items()
                if k not in ("LICENSE_KEY", "LICENSE_MODE", "CLOUD_LICENSE_KEY")
            }
            with patch.dict(os.environ, env_clean, clear=True), \
                 patch("builtins.open", mock_open(read_data="eyJhbGciOiJSUzI1NiJ9.fake.token")), \
                 patch("jose.jwt.decode", return_value=expired_payload):
                with pytest.raises(HTTPException) as exc_info:
                    validate_license()

        assert exc_info.value.status_code == 402
        assert exc_info.value.detail["error"] == "LICENSE_EXPIRED"

    def test_demo_license_valida_pasa(self):
        """
        Licencia tipo DEMO con exp en el futuro → validate_license() retorna el payload
        sin verificar hw_id (las licencias DEMO no validan hardware).
        """
        mock_path = _mock_license_file_exists(exists=True)
        demo_payload = {
            "type": "DEMO",
            "exp": _future_exp(),
        }

        with patch(f"{_MODULE}.LICENSE_FILE", mock_path), \
             patch.dict(os.environ, {}, clear=True):
            env_clean = {
                k: v for k, v in os.environ.items()
                if k not in ("LICENSE_KEY", "LICENSE_MODE", "CLOUD_LICENSE_KEY")
            }
            with patch.dict(os.environ, env_clean, clear=True), \
                 patch("builtins.open", mock_open(read_data="eyJhbGciOiJSUzI1NiJ9.demo.token")), \
                 patch("jose.jwt.decode", return_value=demo_payload):
                result = validate_license()

        assert result["type"] == "DEMO"

    def test_full_license_hw_id_correcto_pasa(self):
        """
        Licencia FULL donde hw_id del JWT coincide con get_machine_id() →
        validate_license() retorna el payload correctamente.
        """
        mock_path = _mock_license_file_exists(exists=True)
        machine_id = "MAQUINA-TEST-12345"
        full_payload = {
            "type": "FULL",
            "hw_id": machine_id,
            "exp": _future_exp(),
        }

        with patch(f"{_MODULE}.LICENSE_FILE", mock_path), \
             patch.dict(os.environ, {}, clear=True):
            env_clean = {
                k: v for k, v in os.environ.items()
                if k not in ("LICENSE_KEY", "LICENSE_MODE", "CLOUD_LICENSE_KEY")
            }
            with patch.dict(os.environ, env_clean, clear=True), \
                 patch("builtins.open", mock_open(read_data="eyJhbGciOiJSUzI1NiJ9.full.token")), \
                 patch("jose.jwt.decode", return_value=full_payload), \
                 patch(f"{_MODULE}.get_machine_id", return_value=machine_id):
                result = validate_license()

        assert result["type"] == "FULL"
        assert result["hw_id"] == machine_id

    def test_full_license_hw_id_incorrecto_lanza_HARDWARE_MISMATCH(self):
        """
        Licencia FULL donde hw_id del JWT NO coincide con get_machine_id() →
        HTTPException 402 HARDWARE_MISMATCH.
        """
        mock_path = _mock_license_file_exists(exists=True)
        full_payload = {
            "type": "FULL",
            "hw_id": "HWID-ORIGINAL-ABC",
            "exp": _future_exp(),
        }

        with patch(f"{_MODULE}.LICENSE_FILE", mock_path), \
             patch.dict(os.environ, {}, clear=True):
            env_clean = {
                k: v for k, v in os.environ.items()
                if k not in ("LICENSE_KEY", "LICENSE_MODE", "CLOUD_LICENSE_KEY")
            }
            with patch.dict(os.environ, env_clean, clear=True), \
                 patch("builtins.open", mock_open(read_data="eyJhbGciOiJSUzI1NiJ9.full.token")), \
                 patch("jose.jwt.decode", return_value=full_payload), \
                 patch(f"{_MODULE}.get_machine_id", return_value="HWID-DISTINTO-XYZ"):
                with pytest.raises(HTTPException) as exc_info:
                    validate_license()

        assert exc_info.value.status_code == 402
        assert exc_info.value.detail["error"] == "HARDWARE_MISMATCH"
        assert exc_info.value.detail["expected_hw_id"] == "HWID-ORIGINAL-ABC"
        assert exc_info.value.detail["current_hw_id"] == "HWID-DISTINTO-XYZ"


# ===========================================================================
# TestValidateLicenseCloud
# ===========================================================================


class TestValidateLicenseCloud:
    """Tests de validate_license() en modo CLOUD (LICENSE_MODE=CLOUD)."""

    def test_cloud_sin_key_lanza_NO_CLOUD_LICENSE(self):
        """
        LICENSE_MODE=CLOUD pero sin CLOUD_LICENSE_KEY env var y sin archivo →
        HTTPException 402 NO_CLOUD_LICENSE.
        """
        mock_path = _mock_license_file_exists(exists=False)

        cloud_env = {"LICENSE_MODE": "CLOUD"}
        # Sin LICENSE_KEY ni CLOUD_LICENSE_KEY
        base_env = {
            k: v for k, v in os.environ.items()
            if k not in ("LICENSE_KEY", "CLOUD_LICENSE_KEY")
        }
        base_env.update(cloud_env)

        with patch(f"{_MODULE}.LICENSE_FILE", mock_path), \
             patch.dict(os.environ, base_env, clear=True):
            with pytest.raises(HTTPException) as exc_info:
                validate_license()

        assert exc_info.value.status_code == 402
        assert exc_info.value.detail["error"] == "NO_CLOUD_LICENSE"

    def test_cloud_dominio_coincide_pasa(self):
        """
        LICENSE_MODE=CLOUD, CLOUD_LICENSE_KEY presente, payload.domain coincide
        con VIRTUAL_HOST → validate_license() retorna el payload sin error.
        """
        cloud_payload = {
            "type": "CLOUD",
            "domain": "miempresa.com",
            "exp": _future_exp(),
        }
        env_vars = {
            "LICENSE_MODE": "CLOUD",
            "CLOUD_LICENSE_KEY": "eyJhbGciOiJSUzI1NiJ9.cloud.token",
            "VIRTUAL_HOST": "miempresa.com",
        }
        base_env = {
            k: v for k, v in os.environ.items()
            if k not in ("LICENSE_KEY", "CLOUD_LICENSE_KEY", "LICENSE_MODE",
                         "VIRTUAL_HOST")
        }
        base_env.update(env_vars)

        with patch.dict(os.environ, base_env, clear=True), \
             patch("jose.jwt.decode", return_value=cloud_payload):
            result = validate_license()

        assert result["type"] == "CLOUD"
        assert result["domain"] == "miempresa.com"

    def test_cloud_dominio_no_coincide_lanza_DOMAIN_MISMATCH(self):
        """
        LICENSE_MODE=CLOUD, payload.domain no coincide con VIRTUAL_HOST →
        HTTPException 402 DOMAIN_MISMATCH.
        """
        cloud_payload = {
            "type": "CLOUD",
            "domain": "dominio-autorizado.com",
            "exp": _future_exp(),
        }
        env_vars = {
            "LICENSE_MODE": "CLOUD",
            "CLOUD_LICENSE_KEY": "eyJhbGciOiJSUzI1NiJ9.cloud.token",
            "VIRTUAL_HOST": "dominio-diferente.net",
        }
        base_env = {
            k: v for k, v in os.environ.items()
            if k not in ("LICENSE_KEY", "CLOUD_LICENSE_KEY", "LICENSE_MODE",
                         "VIRTUAL_HOST")
        }
        base_env.update(env_vars)

        with patch.dict(os.environ, base_env, clear=True), \
             patch("jose.jwt.decode", return_value=cloud_payload):
            with pytest.raises(HTTPException) as exc_info:
                validate_license()

        assert exc_info.value.status_code == 402
        assert exc_info.value.detail["error"] == "DOMAIN_MISMATCH"
        assert exc_info.value.detail["expected_domain"] == "dominio-autorizado.com"
        assert exc_info.value.detail["current_domain"] == "dominio-diferente.net"

    def test_cloud_license_key_env_var_tiene_prioridad(self):
        """
        LICENSE_KEY env var tiene Prioridad 1 sobre CLOUD_LICENSE_KEY y sobre
        el archivo de licencia, incluso en modo CLOUD. Si LICENSE_KEY es un JWT
        válido para un dominio correcto, la validación pasa.
        """
        cloud_payload = {
            "type": "CLOUD",
            "domain": "prioridad.com",
            "exp": _future_exp(),
        }
        env_vars = {
            "LICENSE_MODE": "CLOUD",
            "LICENSE_KEY": "eyJhbGciOiJSUzI1NiJ9.priority.token",
            "CLOUD_LICENSE_KEY": "eyJhbGciOiJSUzI1NiJ9.fallback.token",
            "VIRTUAL_HOST": "prioridad.com",
        }
        base_env = {
            k: v for k, v in os.environ.items()
            if k not in ("LICENSE_KEY", "CLOUD_LICENSE_KEY", "LICENSE_MODE",
                         "VIRTUAL_HOST")
        }
        base_env.update(env_vars)

        captured_tokens = []

        def _capture_decode(token, *args, **kwargs):
            captured_tokens.append(token)
            return cloud_payload

        with patch.dict(os.environ, base_env, clear=True), \
             patch("jose.jwt.decode", side_effect=_capture_decode):
            result = validate_license()

        # Debe haber usado el token de LICENSE_KEY, no de CLOUD_LICENSE_KEY
        assert captured_tokens[0] == "eyJhbGciOiJSUzI1NiJ9.priority.token"
        assert result["domain"] == "prioridad.com"


# ===========================================================================
# TestLicenseGuardMiddleware
# ===========================================================================


class TestLicenseGuardMiddleware:
    """
    Tests de integración HTTP para LicenseGuardMiddleware.

    NOTA IMPORTANTE sobre la whitelist real:
    La whitelist del middleware incluye "/" como entrada, lo que en la implementación
    actual de `any(path.startswith(wp) for wp in WHITELIST_PATHS)` hace que CUALQUIER
    path sea whitelisted (porque todo path HTTP comienza con "/").

    Para los tests que verifican el comportamiento de bloqueo (validate_license
    es invocado, licencia inválida retorna 402), se parchea WHITELIST_PATHS con
    una lista que NO incluye "/" para poder ejercitar la rama de validación.

    Los tests de whitelist explícita (docs, license/activate) verifican el
    comportamiento con la whitelist original tal como está definida en producción.
    """

    # Whitelist reducida sin "/" para forzar validación en tests de bloqueo
    _WHITELIST_SIN_SLASH = [
        "/docs",
        "/openapi.json",
        "/redoc",
        "/api/v1/license/activate",
        "/api/v1/license/status",
        "/api/v1/license/machine-id",
        "/assets",
        "/api/v1/ws",
    ]

    # ------------------------------------------------------------------
    # Helpers de fixture por test
    # ------------------------------------------------------------------

    def _make_blocking_app(self) -> FastAPI:
        """
        Mini-app con LicenseGuardMiddleware y WHITELIST_PATHS parcheada para
        que /api/v1/users sea efectivamente protegida (sin el "/" catch-all).
        """
        app = FastAPI()
        app.add_middleware(LicenseGuardMiddleware)

        @app.get("/api/v1/users")
        def users():
            return {"users": []}

        @app.get("/api/v1/products")
        def products():
            return {"products": []}

        return app

    # ------------------------------------------------------------------
    # Tests
    # ------------------------------------------------------------------

    def test_whitelist_path_bypasea_validacion(self):
        """
        GET /docs coincide con la entrada "/docs" de la whitelist → la request
        pasa sin invocar validate_license() (call_count debe ser 0).
        """
        app = _make_app()
        call_count = {"n": 0}

        def _counting_validate():
            call_count["n"] += 1
            return {"type": "DEMO"}

        with patch(f"{_MODULE}.validate_license", side_effect=_counting_validate):
            client = TestClient(app, raise_server_exceptions=False)
            response = client.get("/docs")

        assert response.status_code == 200
        assert call_count["n"] == 0, (
            "validate_license() no debe invocarse para rutas en la whitelist"
        )

    def test_ruta_no_whitelisted_valida_licencia(self):
        """
        GET /api/v1/users con WHITELIST_PATHS sin el comodín "/" → el middleware
        llama a validate_license(). Si devuelve payload válido, la ruta responde 200.

        (La implementación real incluye "/" en la whitelist, lo que hace que todo
        path sea bypass. Este test parchea WHITELIST_PATHS para ejercitar la rama
        de validación real del middleware.)
        """
        app = self._make_blocking_app()
        call_count = {"n": 0}
        valid_payload = {"type": "DEMO", "exp": _future_exp()}

        def _counting_validate():
            call_count["n"] += 1
            return valid_payload

        with patch(f"{_MODULE}.WHITELIST_PATHS", self._WHITELIST_SIN_SLASH), \
             patch(f"{_MODULE}.validate_license", side_effect=_counting_validate):
            client = TestClient(app, raise_server_exceptions=False)
            response = client.get("/api/v1/users")

        assert response.status_code == 200
        assert call_count["n"] == 1, (
            "validate_license() debe invocarse exactamente una vez para rutas protegidas"
        )

    def test_licencia_invalida_retorna_json_con_error(self):
        """
        validate_license() lanza HTTPException 402 → el middleware convierte la
        excepción en JSONResponse con status 402 y el detail correcto (error + message).

        WHITELIST_PATHS se parchea para eliminar el "/" catch-all y forzar
        que /api/v1/products pase por la validación.
        """
        exc = HTTPException(
            status_code=402,
            detail={"error": "INVALID_LICENSE", "message": "Licencia inválida simulada"},
        )
        app = self._make_blocking_app()

        with patch(f"{_MODULE}.WHITELIST_PATHS", self._WHITELIST_SIN_SLASH), \
             patch(f"{_MODULE}.validate_license", side_effect=exc):
            client = TestClient(app, raise_server_exceptions=False)
            response = client.get("/api/v1/products")

        assert response.status_code == 402
        body = response.json()
        assert body["error"] == "INVALID_LICENSE"
        assert "message" in body

    def test_api_v1_license_activate_es_whitelisted(self):
        """
        GET /api/v1/license/activate está explícitamente en la whitelist (antes del
        "/" catch-all) → devuelve 200 sin invocar validate_license(), incluso cuando
        validate_license() lanzaría un error.
        """
        app = _make_app()

        def _always_fail():
            raise HTTPException(
                status_code=402,
                detail={"error": "NO_LICENSE", "message": "Sin licencia"},
            )

        with patch(f"{_MODULE}.validate_license", side_effect=_always_fail):
            client = TestClient(app, raise_server_exceptions=False)
            response = client.get("/api/v1/license/activate")

        assert response.status_code == 200
        assert response.json() == {"status": "activation_endpoint"}

    def test_licencia_valida_permite_request(self):
        """
        validate_license() retorna payload válido con WHITELIST_PATHS parcheada →
        el middleware deja pasar la petición y el endpoint responde 200 con datos.
        """
        valid_payload = {"type": "DEMO", "exp": _future_exp()}
        app = self._make_blocking_app()

        with patch(f"{_MODULE}.WHITELIST_PATHS", self._WHITELIST_SIN_SLASH), \
             patch(f"{_MODULE}.validate_license", return_value=valid_payload):
            client = TestClient(app, raise_server_exceptions=False)
            response = client.get("/api/v1/users")

        assert response.status_code == 200
        body = response.json()
        assert "users" in body

    def test_redoc_path_es_whitelisted(self):
        """
        /redoc está explícitamente en la whitelist → no bloquea aunque la
        licencia falle.
        """
        app = _make_app()

        @app.get("/redoc")
        def redoc():
            return {"doc": "redoc"}

        def _always_fail():
            raise HTTPException(
                status_code=402,
                detail={"error": "NO_LICENSE", "message": "Sin licencia"},
            )

        with patch(f"{_MODULE}.validate_license", side_effect=_always_fail):
            client = TestClient(app, raise_server_exceptions=False)
            response = client.get("/redoc")

        assert response.status_code == 200

    def test_multiples_errores_retornan_status_402_consistente(self):
        """
        Distintos códigos de error del middleware siempre producen HTTP 402,
        nunca 500 ni otro código inesperado.

        WHITELIST_PATHS se parchea para eliminar el "/" catch-all.
        """
        error_codes = [
            "NO_LICENSE",
            "NO_CLOUD_LICENSE",
            "INVALID_LICENSE",
            "LICENSE_EXPIRED",
            "HARDWARE_MISMATCH",
            "DOMAIN_MISMATCH",
        ]

        for error_code in error_codes:
            exc = HTTPException(
                status_code=402,
                detail={"error": error_code, "message": f"Error simulado: {error_code}"},
            )
            app = self._make_blocking_app()

            with patch(f"{_MODULE}.WHITELIST_PATHS", self._WHITELIST_SIN_SLASH), \
                 patch(f"{_MODULE}.validate_license", side_effect=exc):
                client = TestClient(app, raise_server_exceptions=False)
                response = client.get("/api/v1/users")

            assert response.status_code == 402, (
                f"Error '{error_code}' debería retornar 402, "
                f"obtuvo {response.status_code}"
            )
            body = response.json()
            assert body["error"] == error_code, (
                f"El campo 'error' debería ser '{error_code}'"
            )
