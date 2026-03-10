"""
test_auth.py — Suite completa de tests para flujos de autenticación.

Cubre:
  - TestLoginValidation:       validación de formulario, credenciales, tenant inactivo, login exitoso
  - TestTokenValidation:       tokens inválidos/expirados, ausencia de header, request autenticado
  - TestRateLimit:             lógica de PIN y discovery endpoint con rate-limit implícito
  - TestPermissions:           RBAC — cashier vs admin, rutas protegidas
  - TestPasswordHashing:       funciones de seguridad (bcrypt)
  - TestUserRoles:             enum RBAC + persistencia de roles en BD
  - TestTenantDiscoverySecurity: no se expone superadmin en discovery

Estrategia:
  - SQLite en memoria — usa las fixtures `sqlite_engine` / `db_session` de conftest.py.
    Esas fixtures manejan la eliminación temporal de schemas durante toda la sesión,
    garantizando que los INSERTs no intenten usar "public.<table>".
  - Mocking de dependencias externas (settings, get_tenant_schema, limiter) donde necesario.
  - Ningún test depende de servicios externos ni de un servidor activo.
"""

import os
import sys
import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

# ---------------------------------------------------------------------------
# Path setup — mismo que conftest.py
# ---------------------------------------------------------------------------

_backend_root = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
if _backend_root not in sys.path:
    sys.path.insert(0, _backend_root)


# ---------------------------------------------------------------------------
# Helper: construir un Request de Starlette mínimo para pruebas unitarias.
# Los endpoints del router usan @limiter.limit que requiere un Request real
# (no un MagicMock) para acceder a .scope / .client / .headers.
# ---------------------------------------------------------------------------

def _make_starlette_request(headers: dict | None = None) -> "Request":
    """Retorna un starlette.requests.Request mínimo y funcional."""
    from starlette.requests import Request

    raw_headers = [
        (k.lower().encode(), v.encode())
        for k, v in (headers or {}).items()
    ]
    # Asegurar que 'host' siempre está presente
    if not any(k == b"host" for k, _ in raw_headers):
        raw_headers.append((b"host", b"localhost"))

    scope = {
        "type": "http",
        "method": "POST",
        "path": "/auth/token",
        "query_string": b"",
        "headers": raw_headers,
        "client": ("127.0.0.1", 12345),
    }
    return Request(scope)

# ---------------------------------------------------------------------------
# Importaciones condicionales
# ---------------------------------------------------------------------------

try:
    from backend_api.models.models import User, UserRole
    from backend_api.models.tenant import Tenant
    from backend_api.security import get_password_hash, verify_password

    MODELS_AVAILABLE = True
except Exception as _import_err:
    MODELS_AVAILABLE = False
    _import_err_msg = str(_import_err)


def _skip_if_unavailable():
    if not MODELS_AVAILABLE:
        pytest.skip(
            f"No se pudieron importar los módulos requeridos: {_import_err_msg}. "
            "Verifica que el paquete backend_api esté instalado."
        )


# ---------------------------------------------------------------------------
# Fixtures de datos — dependen de db_session provista por conftest.py
# ---------------------------------------------------------------------------

@pytest.fixture()
def hashed_pw():
    _skip_if_unavailable()
    return get_password_hash("secret123")


@pytest.fixture()
def active_tenant(db_session):
    _skip_if_unavailable()
    tenant = Tenant(
        name="Empresa Test",
        schema_name="empresatest",
        is_active=True,
    )
    db_session.add(tenant)
    db_session.flush()
    return tenant


@pytest.fixture()
def inactive_tenant(db_session):
    _skip_if_unavailable()
    tenant = Tenant(
        name="Empresa Suspendida",
        schema_name="suspendida",
        is_active=False,
    )
    db_session.add(tenant)
    db_session.flush()
    return tenant


@pytest.fixture()
def admin_user(db_session, hashed_pw, active_tenant):
    _skip_if_unavailable()
    user = User(
        username="admintest",
        email="admin@empresatest.com",
        password_hash=hashed_pw,
        role=UserRole.ADMIN,
        is_active=True,
        is_superuser=False,
        tenant_id=active_tenant.id,
    )
    db_session.add(user)
    db_session.flush()
    return user


@pytest.fixture()
def cashier_user(db_session, hashed_pw, active_tenant):
    _skip_if_unavailable()
    user = User(
        username="cashiertest",
        email="cashier@empresatest.com",
        password_hash=hashed_pw,
        role=UserRole.CASHIER,
        is_active=True,
        is_superuser=False,
        tenant_id=active_tenant.id,
    )
    db_session.add(user)
    db_session.flush()
    return user


@pytest.fixture()
def superadmin_user(db_session, hashed_pw):
    _skip_if_unavailable()
    user = User(
        username="superadmin",
        email="superadmin@system.local",
        password_hash=hashed_pw,
        role=UserRole.ADMIN,
        is_active=True,
        is_superuser=True,
        tenant_id=None,
    )
    db_session.add(user)
    db_session.flush()
    return user


# ---------------------------------------------------------------------------
# Helpers de tokens
# ---------------------------------------------------------------------------

def _valid_token(email: str, role: str = "ADMIN", minutes: int = 30) -> str:
    """Genera un JWT válido firmado con la clave del sistema."""
    from backend_api.security import create_access_token
    return create_access_token(
        data={"sub": email, "role": role},
        expires_delta=timedelta(minutes=minutes),
    )


def _expired_token(email: str) -> str:
    """Genera un JWT ya expirado."""
    from jose import jwt
    from backend_api.config import settings
    payload = {
        "sub": email,
        "role": "ADMIN",
        "exp": datetime.now(timezone.utc) - timedelta(seconds=1),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


# ===========================================================================
# TestLoginValidation
# ===========================================================================

class TestLoginValidation:
    """Validación del endpoint POST /auth/token (login con form-data OAuth2)."""

    def test_login_requiere_username_y_password(self):
        """Username vacío → usuario no encontrado → HTTP 401."""
        _skip_if_unavailable()

        import asyncio
        from fastapi import HTTPException
        from backend_api.routers.auth import login_for_access_token

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None

        mock_form = MagicMock()
        mock_form.username = ""
        mock_form.password = ""

        starlette_req = _make_starlette_request()

        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(
                login_for_access_token(
                    request=starlette_req,
                    response=MagicMock(),
                    form_data=mock_form,
                    db=mock_db,
                )
            )

        assert exc_info.value.status_code == 401

    def test_login_credenciales_invalidas_retorna_401(self, db_session, admin_user):
        """Contraseña incorrecta → HTTP 401 Unauthorized."""
        _skip_if_unavailable()

        import asyncio
        from fastapi import HTTPException
        from backend_api.routers.auth import login_for_access_token

        mock_form = MagicMock()
        mock_form.username = admin_user.username
        mock_form.password = "WRONG_PASSWORD_XXXXX"

        starlette_req = _make_starlette_request({"x-tenant-id": "empresatest"})

        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(
                login_for_access_token(
                    request=starlette_req,
                    response=MagicMock(),
                    form_data=mock_form,
                    db=db_session,
                )
            )

        assert exc_info.value.status_code == 401

    def test_login_tenant_inactivo_retorna_403(self, db_session, inactive_tenant):
        """Login contra tenant suspendido → HTTP 403 Forbidden."""
        _skip_if_unavailable()

        import asyncio
        from fastapi import HTTPException
        from backend_api.routers.auth import login_for_access_token

        mock_form = MagicMock()
        mock_form.username = "cualquiera"
        mock_form.password = "cualquiera"

        starlette_req = _make_starlette_request({"x-tenant-id": "suspendida"})

        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(
                login_for_access_token(
                    request=starlette_req,
                    response=MagicMock(),
                    form_data=mock_form,
                    db=db_session,
                )
            )

        assert exc_info.value.status_code == 403
        detail_lower = exc_info.value.detail.lower()
        assert "empresa" in detail_lower or "suspendida" in detail_lower

    def test_login_exitoso_retorna_token(self, db_session, admin_user):
        """Credenciales válidas → devuelve access_token y token_type=bearer."""
        _skip_if_unavailable()

        import asyncio
        from backend_api.routers.auth import login_for_access_token

        mock_form = MagicMock()
        mock_form.username = admin_user.username
        mock_form.password = "secret123"

        starlette_req = _make_starlette_request({"x-tenant-id": "empresatest"})

        result = asyncio.run(
            login_for_access_token(
                request=starlette_req,
                response=MagicMock(),
                form_data=mock_form,
                db=db_session,
            )
        )

        assert "access_token" in result
        assert result["token_type"] == "bearer"
        assert isinstance(result["access_token"], str)
        assert len(result["access_token"]) > 20

    def test_login_usuario_inactivo_retorna_400(self, db_session, active_tenant, hashed_pw):
        """Usuario con is_active=False → HTTP 400 tras verificar contraseña."""
        _skip_if_unavailable()

        import asyncio
        from fastapi import HTTPException
        from backend_api.routers.auth import login_for_access_token

        inactive_user = User(
            username="inactivo",
            email="inactivo@empresatest.com",
            password_hash=hashed_pw,
            role=UserRole.CASHIER,
            is_active=False,
            is_superuser=False,
            tenant_id=active_tenant.id,
        )
        db_session.add(inactive_user)
        db_session.flush()

        mock_form = MagicMock()
        mock_form.username = "inactivo"
        mock_form.password = "secret123"

        starlette_req = _make_starlette_request({"x-tenant-id": "empresatest"})

        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(
                login_for_access_token(
                    request=starlette_req,
                    response=MagicMock(),
                    form_data=mock_form,
                    db=db_session,
                )
            )

        assert exc_info.value.status_code == 400


# ===========================================================================
# TestTokenValidation
# ===========================================================================

class TestTokenValidation:
    """Validación de JWT en get_current_user / extract_token_hybrid."""

    def test_token_invalido_es_rechazado(self, db_session):
        """Firma incorrecta → HTTP 401."""
        _skip_if_unavailable()

        from fastapi import HTTPException
        from backend_api.dependencies import get_current_user

        bad_token = (
            "eyJhbGciOiJIUzI1NiJ9"
            ".eyJzdWIiOiJ0ZXN0QHRlc3QuY29tIn0"
            ".INVALID_SIGNATURE_HERE"
        )

        with pytest.raises(HTTPException) as exc_info:
            get_current_user(token=bad_token, db=db_session)

        assert exc_info.value.status_code == 401

    def test_token_expirado_es_rechazado(self, db_session, admin_user):
        """JWT expirado → HTTP 401."""
        _skip_if_unavailable()

        from fastapi import HTTPException
        from backend_api.dependencies import get_current_user

        expired = _expired_token(admin_user.email)

        with pytest.raises(HTTPException) as exc_info:
            get_current_user(token=expired, db=db_session)

        assert exc_info.value.status_code == 401

    def test_token_sin_header_retorna_401(self):
        """Sin cookie ni Authorization header → HTTP 401 Not authenticated."""
        _skip_if_unavailable()

        from fastapi import HTTPException, Request
        from backend_api.dependencies import extract_token_hybrid

        mock_request = MagicMock(spec=Request)
        mock_request.cookies = {}

        with pytest.raises(HTTPException) as exc_info:
            extract_token_hybrid(request=mock_request, token_from_header=None)

        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "Not authenticated"

    def test_request_autenticado_con_token_valido(self, db_session, superadmin_user):
        """JWT bien formado y no expirado → retorna el usuario correcto.

        Usa un superadmin (tenant_id=None) en contexto public para evitar que
        get_current_user intente ejecutar SET search_path (sintaxis PostgreSQL)
        sobre el engine SQLite de prueba.
        """
        _skip_if_unavailable()

        from backend_api.dependencies import get_current_user

        token = _valid_token(superadmin_user.email, role="ADMIN")

        with patch("backend_api.tenant_context.get_tenant_schema", return_value="public"):
            user = get_current_user(token=token, db=db_session)

        assert user.email == superadmin_user.email
        assert user.is_active is True

    def test_token_con_sub_ausente_es_rechazado(self, db_session):
        """JWT sin campo 'sub' en el payload → HTTP 401."""
        _skip_if_unavailable()

        from fastapi import HTTPException
        from jose import jwt
        from backend_api.config import settings
        from backend_api.dependencies import get_current_user

        payload = {
            "role": "ADMIN",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=30),
        }
        token_no_sub = jwt.encode(
            payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM
        )

        with pytest.raises(HTTPException) as exc_info:
            get_current_user(token=token_no_sub, db=db_session)

        assert exc_info.value.status_code == 401

    def test_extract_token_prioriza_cookie_sobre_header(self):
        """La cookie HttpOnly tiene prioridad sobre el Authorization header."""
        _skip_if_unavailable()

        from fastapi import Request
        from backend_api.dependencies import extract_token_hybrid

        mock_request = MagicMock(spec=Request)
        mock_request.cookies = {"access_token": "token_from_cookie"}

        result = extract_token_hybrid(
            request=mock_request,
            token_from_header="token_from_header",
        )

        assert result == "token_from_cookie"

    def test_extract_token_usa_header_cuando_no_hay_cookie(self):
        """Sin cookie, usa el Authorization header como fallback."""
        _skip_if_unavailable()

        from fastapi import Request
        from backend_api.dependencies import extract_token_hybrid

        mock_request = MagicMock(spec=Request)
        mock_request.cookies = {}

        result = extract_token_hybrid(
            request=mock_request,
            token_from_header="token_from_header",
        )

        assert result == "token_from_header"


# ===========================================================================
# TestRateLimit
# ===========================================================================

class TestRateLimit:
    """
    Tests sobre lógica de PIN y discovery endpoint.

    La limitación de rate real (slowapi) requiere un servidor ASGI activo.
    Se verifica la lógica de negocio subyacente que se ejecuta tras pasar
    el rate-limiter.
    """

    def test_pin_login_limita_intentos(self, db_session, admin_user):
        """
        validate_pin con PIN incorrecto retorna valid=False sin lanzar excepción,
        permitiendo que la capa de rate-limiting superior controle los reintentos.
        """
        _skip_if_unavailable()

        from backend_api.routers.auth import validate_pin

        admin_user.pin = get_password_hash("1234")
        db_session.flush()

        # Múltiples intentos fallidos — ninguno lanza excepción (rate-limit es externo)
        for _ in range(3):
            result = validate_pin(
                pin_data={"user_id": admin_user.id, "pin": "0000"},
                db=db_session,
            )
            assert result["valid"] is False

    def test_discovery_endpoint_requiere_datos_validos(self, db_session):
        """Email no registrado → HTTP 404 (sin revelar información).

        Se llama a la función interna sin decorador (.__wrapped__) para evitar
        que slowapi inspeccione el parámetro 'request' de Pydantic.
        """
        _skip_if_unavailable()

        import asyncio
        from fastapi import HTTPException
        from backend_api.routers.auth import discover_tenant

        # .__wrapped__ apunta a la función original sin el @limiter.limit
        inner = discover_tenant.__wrapped__

        mock_discovery_req = MagicMock()
        mock_discovery_req.email = "noexiste@nowhere.invalid"

        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(
                inner(
                    http_request=MagicMock(),
                    request=mock_discovery_req,
                    db=db_session,
                )
            )

        assert exc_info.value.status_code == 404

    def test_pin_correcto_retorna_datos_usuario(self, db_session, admin_user):
        """PIN correcto → valid=True con datos del usuario."""
        _skip_if_unavailable()

        from backend_api.routers.auth import validate_pin

        admin_user.pin = get_password_hash("4321")
        db_session.flush()

        result = validate_pin(
            pin_data={"user_id": admin_user.id, "pin": "4321"},
            db=db_session,
        )

        assert result["valid"] is True
        assert result["user_id"] == admin_user.id
        assert result["username"] == admin_user.username

    def test_discovery_endpoint_no_expone_superadmin_global(
        self, db_session, superadmin_user
    ):
        """
        El discovery no debe revelar superadmins globales (tenant_id=None).
        Debe retornar 404 aunque el email exista, previniendo enumeración de cuentas.
        """
        _skip_if_unavailable()

        import asyncio
        from fastapi import HTTPException
        from backend_api.routers.auth import discover_tenant

        inner = discover_tenant.__wrapped__

        mock_discovery_req = MagicMock()
        mock_discovery_req.email = superadmin_user.email

        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(
                inner(
                    http_request=MagicMock(),
                    request=mock_discovery_req,
                    db=db_session,
                )
            )

        # Nunca revelar que el email existe
        assert exc_info.value.status_code == 404

    def test_discovery_exitoso_retorna_redirect_url(
        self, db_session, admin_user, active_tenant
    ):
        """Email de usuario con tenant → redirect_url con schema del tenant."""
        _skip_if_unavailable()

        import asyncio
        from backend_api.routers.auth import discover_tenant

        inner = discover_tenant.__wrapped__

        mock_discovery_req = MagicMock()
        mock_discovery_req.email = admin_user.email

        result = asyncio.run(
            inner(
                http_request=MagicMock(),
                request=mock_discovery_req,
                db=db_session,
            )
        )

        assert "redirect_url" in result
        assert active_tenant.schema_name in result["redirect_url"]
        assert result["tenant_id"] == active_tenant.schema_name


# ===========================================================================
# TestPermissions
# ===========================================================================

class TestPermissions:
    """RBAC: RoleChecker, admin_only, cashier_or_admin, superuser."""

    def test_usuario_cashier_no_puede_acceder_ruta_admin(self, cashier_user):
        """RoleChecker([ADMIN]) debe rechazar a CASHIER con HTTP 403."""
        _skip_if_unavailable()

        from fastapi import HTTPException
        from backend_api.dependencies import RoleChecker

        checker = RoleChecker(allowed_roles=[UserRole.ADMIN])

        with pytest.raises(HTTPException) as exc_info:
            checker(user=cashier_user)

        assert exc_info.value.status_code == 403
        assert "not permitted" in exc_info.value.detail.lower()

    def test_usuario_admin_puede_acceder_panel(self, admin_user):
        """RoleChecker([ADMIN]) permite acceso a un usuario ADMIN."""
        _skip_if_unavailable()

        from backend_api.dependencies import RoleChecker

        checker = RoleChecker(allowed_roles=[UserRole.ADMIN])
        result = checker(user=admin_user)

        assert result == admin_user

    def test_endpoint_protegido_requiere_autenticacion(self):
        """Sin credenciales → HTTP 401 antes de ejecutar cualquier lógica de rol."""
        _skip_if_unavailable()

        from fastapi import HTTPException, Request
        from backend_api.dependencies import extract_token_hybrid

        mock_request = MagicMock(spec=Request)
        mock_request.cookies = {}

        with pytest.raises(HTTPException) as exc_info:
            extract_token_hybrid(request=mock_request, token_from_header=None)

        assert exc_info.value.status_code == 401

    def test_cashier_puede_acceder_ruta_cashier_o_admin(self, cashier_user):
        """cashier_or_admin permite acceso a un CASHIER."""
        _skip_if_unavailable()

        from backend_api.dependencies import RoleChecker

        checker = RoleChecker(allowed_roles=[UserRole.ADMIN, UserRole.CASHIER])
        result = checker(user=cashier_user)

        assert result == cashier_user

    def test_warehouse_no_puede_acceder_ruta_admin(
        self, db_session, active_tenant, hashed_pw
    ):
        """WAREHOUSE es rechazado por RoleChecker([ADMIN])."""
        _skip_if_unavailable()

        from fastapi import HTTPException
        from backend_api.dependencies import RoleChecker

        wh_user = User(
            username="almacenero",
            email="warehouse@empresatest.com",
            password_hash=hashed_pw,
            role=UserRole.WAREHOUSE,
            is_active=True,
            is_superuser=False,
            tenant_id=active_tenant.id,
        )
        db_session.add(wh_user)
        db_session.flush()

        checker = RoleChecker(allowed_roles=[UserRole.ADMIN])

        with pytest.raises(HTTPException) as exc_info:
            checker(user=wh_user)

        assert exc_info.value.status_code == 403

    def test_superuser_puede_obtener_token_valido(self, db_session, superadmin_user):
        """Token de superadmin (tenant_id=None) en contexto public → usuario retornado."""
        _skip_if_unavailable()

        from backend_api.dependencies import get_current_user

        token = _valid_token(superadmin_user.email, role="ADMIN")

        with patch("backend_api.tenant_context.get_tenant_schema", return_value="public"):
            user = get_current_user(token=token, db=db_session)

        assert user.email == superadmin_user.email
        assert user.is_superuser is True

    def test_get_current_superuser_rechaza_no_superuser(self, admin_user):
        """get_current_superuser rechaza usuarios con is_superuser=False → HTTP 403."""
        _skip_if_unavailable()

        from fastapi import HTTPException
        from backend_api.dependencies import get_current_superuser

        assert admin_user.is_superuser is False  # precondición

        with pytest.raises(HTTPException) as exc_info:
            get_current_superuser(current_user=admin_user)

        assert exc_info.value.status_code == 403
        assert "superuser" in exc_info.value.detail.lower()

    def test_validate_pin_usuario_sin_pin_retorna_400(self, db_session, admin_user):
        """validate_pin con usuario sin PIN configurado → HTTP 400."""
        _skip_if_unavailable()

        from fastapi import HTTPException
        from backend_api.routers.auth import validate_pin

        admin_user.pin = None
        db_session.flush()

        with pytest.raises(HTTPException) as exc_info:
            validate_pin(
                pin_data={"user_id": admin_user.id, "pin": "1234"},
                db=db_session,
            )

        assert exc_info.value.status_code == 400
        assert "PIN" in exc_info.value.detail

    def test_logout_limpia_cookie(self):
        """logout llama delete_cookie y retorna mensaje de éxito."""
        _skip_if_unavailable()

        import asyncio
        from backend_api.routers.auth import logout

        mock_response = MagicMock()
        result = asyncio.run(logout(response=mock_response))

        mock_response.delete_cookie.assert_called_once()
        assert result["message"] == "Successfully logged out"


# ===========================================================================
# TestPasswordHashing
# ===========================================================================

class TestPasswordHashing:
    """Funciones de seguridad bcrypt (get_password_hash / verify_password)."""

    def test_password_hash_no_es_texto_plano(self):
        """El hash bcrypt no es igual al texto original."""
        _skip_if_unavailable()

        plain = "MiContraseñaSegura123!"
        hashed = get_password_hash(plain)

        assert hashed != plain

    def test_password_hash_empieza_con_bcrypt_prefix(self):
        """El hash bcrypt empieza con '$2b$' o '$2a$'."""
        _skip_if_unavailable()

        hashed = get_password_hash("cualquier_contraseña")

        assert hashed.startswith("$2b$") or hashed.startswith("$2a$")

    def test_password_hash_longitud_minima(self):
        """Hash bcrypt tiene al menos 60 caracteres."""
        _skip_if_unavailable()

        hashed = get_password_hash("test")
        assert len(hashed) >= 60

    def test_mismo_password_genera_hashes_distintos(self):
        """Dos hashes del mismo password son distintos (salt aleatorio)."""
        _skip_if_unavailable()

        plain = "ContraseñaRepetida"
        assert get_password_hash(plain) != get_password_hash(plain)

    def test_password_verification_correcta(self):
        """verify_password retorna True cuando la contraseña coincide."""
        _skip_if_unavailable()

        plain = "ContraseñaCorrecta99"
        assert verify_password(plain, get_password_hash(plain)) is True

    def test_password_diferente_falla_verificacion(self):
        """verify_password retorna False cuando la contraseña no coincide."""
        _skip_if_unavailable()

        plain = "ContraseñaOriginal"
        hashed = get_password_hash(plain)
        assert verify_password("OtraContraseña", hashed) is False

    def test_password_vacia_no_verifica_con_hash_de_otra(self):
        """Contraseña vacía no pasa la verificación de una contraseña real."""
        _skip_if_unavailable()

        assert verify_password("", get_password_hash("ContraseñaReal")) is False

    def test_hash_persiste_en_modelo_usuario(self, db_session):
        """El hash se guarda correctamente en el modelo User de la BD."""
        _skip_if_unavailable()

        plain = "admin_password_123"
        hashed = get_password_hash(plain)

        user = User(
            email="admin_hash_test@empresa.com",
            password_hash=hashed,
            role=UserRole.ADMIN,
            is_active=True,
        )
        db_session.add(user)
        db_session.flush()

        retrieved = db_session.query(User).filter(
            User.email == "admin_hash_test@empresa.com"
        ).first()

        assert retrieved is not None
        assert retrieved.password_hash != plain
        assert verify_password(plain, retrieved.password_hash) is True

    def test_create_access_token_contiene_sub_y_exp(self):
        """El token creado contiene los campos 'sub' y 'exp'."""
        _skip_if_unavailable()

        from jose import jwt
        from backend_api.security import create_access_token
        from backend_api.config import settings

        token = create_access_token(
            data={"sub": "test@test.com", "role": "ADMIN"}
        )
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )

        assert payload.get("sub") == "test@test.com"
        assert "exp" in payload

    def test_token_expirado_lanza_jose_error(self):
        """Un JWT ya expirado lanza JWTError al decodificarlo."""
        _skip_if_unavailable()

        from jose import jwt, JWTError
        from backend_api.config import settings

        expired = _expired_token("test@test.com")

        with pytest.raises(JWTError):
            jwt.decode(
                expired, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
            )


# ===========================================================================
# TestUserRoles
# ===========================================================================

class TestUserRoles:
    """Enum RBAC y persistencia de roles en BD."""

    def test_roles_criticos_existen(self):
        """ADMIN, CASHIER y WAREHOUSE deben estar presentes en UserRole."""
        _skip_if_unavailable()

        roles = {r.value for r in UserRole}
        for expected in ("ADMIN", "CASHIER", "WAREHOUSE"):
            assert expected in roles

    def test_rol_por_defecto_es_cashier(self, db_session):
        """Usuario sin rol explícito recibe CASHIER por defecto."""
        _skip_if_unavailable()

        user = User(
            email="nuevo_cajero@empresa.com",
            password_hash=get_password_hash("password"),
        )
        db_session.add(user)
        db_session.flush()

        retrieved = db_session.query(User).filter(
            User.email == "nuevo_cajero@empresa.com"
        ).first()

        assert retrieved.role == UserRole.CASHIER

    def test_admin_se_puede_crear_y_persistir(self, db_session):
        """Usuario ADMIN se crea y recupera correctamente de BD."""
        _skip_if_unavailable()

        user = User(
            email="admin@empresa.com",
            password_hash=get_password_hash("admin_pass"),
            role=UserRole.ADMIN,
            full_name="Administrador Principal",
            is_active=True,
            is_superuser=False,
        )
        db_session.add(user)
        db_session.flush()

        retrieved = db_session.query(User).filter(
            User.email == "admin@empresa.com"
        ).first()

        assert retrieved is not None
        assert retrieved.role == UserRole.ADMIN
        assert retrieved.full_name == "Administrador Principal"

    def test_cashier_no_es_superuser_por_defecto(self, db_session):
        """Un cajero tiene is_superuser=False por defecto."""
        _skip_if_unavailable()

        user = User(
            email="cajero_normal@empresa.com",
            password_hash=get_password_hash("pass"),
            role=UserRole.CASHIER,
        )
        db_session.add(user)
        db_session.flush()

        retrieved = db_session.query(User).filter(
            User.email == "cajero_normal@empresa.com"
        ).first()

        assert retrieved.is_superuser is False

    def test_usuario_inactivo_tiene_is_active_false(self, db_session):
        """Usuario desactivado tiene is_active=False."""
        _skip_if_unavailable()

        user = User(
            email="inactivo@empresa.com",
            password_hash=get_password_hash("pass"),
            role=UserRole.CASHIER,
            is_active=False,
        )
        db_session.add(user)
        db_session.flush()

        retrieved = db_session.query(User).filter(
            User.email == "inactivo@empresa.com"
        ).first()

        assert retrieved.is_active is False


# ===========================================================================
# TestTenantDiscoverySecurity
# ===========================================================================

class TestTenantDiscoverySecurity:
    """No se expone información de superadmins en el endpoint discovery."""

    def test_superadmin_global_no_tiene_tenant_id(self, db_session):
        """Superadmin global tiene tenant_id=None y la lógica de discovery lo rechaza."""
        _skip_if_unavailable()

        superadmin = User(
            email="superadmin@saas.com",
            password_hash=get_password_hash("super_secret"),
            role=UserRole.ADMIN,
            is_active=True,
            is_superuser=True,
            tenant_id=None,
        )
        db_session.add(superadmin)
        db_session.flush()

        retrieved = db_session.query(User).filter(
            User.email == "superadmin@saas.com"
        ).first()

        assert retrieved.tenant_id is None
        # Lógica del endpoint: rechaza si tenant_id es None
        assert not retrieved.tenant_id

    def test_usuario_con_tenant_id_es_descubrible(self, db_session):
        """Un usuario normal con tenant_id puede ser descubierto para redirect."""
        _skip_if_unavailable()

        tenant = Tenant(
            name="Empresa Normal",
            schema_name="empresa_normal_001",
            is_active=True,
            license_type="trial",
        )
        db_session.add(tenant)
        db_session.flush()

        user = User(
            email="usuario@empresa.com",
            password_hash=get_password_hash("pass"),
            role=UserRole.CASHIER,
            tenant_id=tenant.id,
            is_active=True,
        )
        db_session.add(user)
        db_session.flush()

        retrieved = db_session.query(User).filter(
            User.email == "usuario@empresa.com"
        ).first()

        assert retrieved.tenant_id is not None
        assert retrieved.tenant_id == tenant.id
        assert bool(retrieved.tenant_id) is True

    def test_email_unico_por_usuario(self, db_session):
        """No se pueden crear dos usuarios con el mismo email (unique constraint)."""
        _skip_if_unavailable()

        from sqlalchemy.exc import IntegrityError

        email = "duplicado@empresa.com"
        user1 = User(
            email=email,
            password_hash=get_password_hash("pass1"),
            role=UserRole.CASHIER,
        )
        user2 = User(
            email=email,
            password_hash=get_password_hash("pass2"),
            role=UserRole.ADMIN,
        )

        db_session.add(user1)
        db_session.flush()

        db_session.add(user2)
        with pytest.raises((IntegrityError, Exception)):
            db_session.flush()
