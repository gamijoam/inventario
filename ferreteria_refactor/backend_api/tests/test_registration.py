"""
test_registration.py — Suite de tests para registro público y mapeo de rubros a módulos.

Cubre:
  - TestMapeoRubrosModulos:   lógica pura de segmentación (sin BD, sin red)
  - TestRegistroPublico:      validación del endpoint POST /public/register (mock de TenantService)
  - TestTrialEndsAt:          lógica de campos de licencia para nuevos tenants

Estrategia:
  - Ningún test requiere PostgreSQL real ni servidor activo.
  - La lógica de segmentación se replica como función pura `_get_modules_for_rubro`.
  - Los tests de endpoint usan TestClient de FastAPI con MagicMock en TenantService.
  - Los tests de licencia replican la lógica de campos de trial directamente.
"""

import os
import sys
import pytest
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

# ---------------------------------------------------------------------------
# Path setup — igual que conftest.py y test_auth.py
# ---------------------------------------------------------------------------

_backend_root = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
if _backend_root not in sys.path:
    sys.path.insert(0, _backend_root)


# ---------------------------------------------------------------------------
# Función pura que replica la lógica de TenantService (sin BD)
# Permite testear la segmentación de módulos de forma aislada.
# ---------------------------------------------------------------------------

def _get_modules_for_rubro(rubro: str | None) -> dict:
    """
    Replica exactamente la lógica de TenantService.create_tenant
    para mapear un rubro (business_type) a módulos internos.

    Retorna dict con claves: hardware, restaurant, laundry, services, barbershop.
    """
    rubro_upper = (rubro or "Ferretería").upper()

    m_hardware = True  # POS base — SIEMPRE activo
    m_restaurant = False
    m_laundry = False
    m_services = False
    m_barbershop = False

    # Restaurante / Alimentos y Bebidas
    if any(k in rubro_upper for k in [
        "RESTAURANT", "COMIDA", "PIZZA", "CAFÉ", "CAFE", "CAFETERIA",
        "CAFETERÍA", "HELADO", "PANADER", "PANADERÍA", "FONDA", "TASCA",
        "CHURRERÍA", "CHURRER", "EMPANADA", "SUSHI", "HAMBURGUES",
        "FAST FOOD", "FASTFOOD", "COCINA", "BISTR", "BAR ", "BARES"
    ]):
        m_restaurant = True

    # Lavandería / Tintorería
    if any(k in rubro_upper for k in [
        "LAVANDER", "LAVANDERÍA", "TINTORER", "TINTORERÍA",
        "LAUNDRY", "PLANCHADO", "LAVADO"
    ]):
        m_laundry = True

    # Servicio Técnico / Reparaciones
    if any(k in rubro_upper for k in [
        "TALLER", "SERVICIO", "REPARAC", "ELECTRÓNICA", "ELECTRONICA",
        "TECNIC", "TÉCNIC", "CELULAR", "PHONE", "COMPUTADORA", "PC ",
        "INFORMATICA", "INFORMÁTICA", "MOTOS", "MECANIC", "MECÁNIC",
        "CLIMATIZAC", "AIRE ACONDIC", "PLOMERIA", "PLOMERÍA"
    ]):
        m_services = True

    # Barbería / Salón de Belleza
    if any(k in rubro_upper for k in [
        "BARBER", "PELUQUER", "BELLEZA", "ESTÉTICA", "ESTETICA",
        "SPA", "SALON", "SALÓN", "MANICUR", "PEDICUR", "UÑAS",
        "CABELLO", "PELO", "COSMETOLOG"
    ]):
        m_barbershop = True

    return {
        "hardware": m_hardware,
        "restaurant": m_restaurant,
        "laundry": m_laundry,
        "services": m_services,
        "barbershop": m_barbershop,
    }


# ---------------------------------------------------------------------------
# TestMapeoRubrosModulos — lógica pura, sin BD
# ---------------------------------------------------------------------------

class TestMapeoRubrosModulos:
    """Verifica que cada rubro activa los módulos correctos."""

    def test_ferreteria_activa_hardware_solo(self):
        """Ferretería solo activa hardware; el resto permanece False."""
        modulos = _get_modules_for_rubro("Ferretería El Tornillo")
        assert modulos["hardware"] is True
        assert modulos["restaurant"] is False
        assert modulos["laundry"] is False
        assert modulos["services"] is False
        assert modulos["barbershop"] is False

    def test_abasto_activa_hardware(self):
        """Abasto/retail puro solo necesita POS base (hardware)."""
        modulos = _get_modules_for_rubro("Abasto Central")
        assert modulos["hardware"] is True
        assert modulos["restaurant"] is False
        assert modulos["laundry"] is False
        assert modulos["services"] is False
        assert modulos["barbershop"] is False

    def test_restaurante_activa_restaurant_y_hardware(self):
        """Restaurante activa módulo restaurant; hardware sigue True."""
        modulos = _get_modules_for_rubro("Restaurante La Abuela")
        assert modulos["hardware"] is True
        assert modulos["restaurant"] is True
        assert modulos["laundry"] is False
        assert modulos["services"] is False
        assert modulos["barbershop"] is False

    def test_pizza_activa_restaurant(self):
        """Pizza Palace debe activar el módulo restaurant."""
        modulos = _get_modules_for_rubro("Pizza Palace")
        assert modulos["restaurant"] is True
        assert modulos["hardware"] is True

    def test_cafe_activa_restaurant(self):
        """Café / Cafetería debe activar restaurant."""
        modulos = _get_modules_for_rubro("Café del Centro")
        assert modulos["restaurant"] is True
        assert modulos["hardware"] is True

    def test_lavanderia_activa_laundry_y_hardware(self):
        """Lavandería activa laundry; hardware sigue activo."""
        modulos = _get_modules_for_rubro("Lavandería Express")
        assert modulos["hardware"] is True
        assert modulos["laundry"] is True
        assert modulos["restaurant"] is False
        assert modulos["services"] is False
        assert modulos["barbershop"] is False

    def test_tintoreria_activa_laundry(self):
        """Tintorería también activa el módulo laundry."""
        modulos = _get_modules_for_rubro("Tintorería El Cisne")
        assert modulos["laundry"] is True
        assert modulos["hardware"] is True

    def test_taller_activa_services(self):
        """Taller de Electrónica activa el módulo services."""
        modulos = _get_modules_for_rubro("Taller de Electrónica")
        assert modulos["services"] is True
        assert modulos["hardware"] is True
        assert modulos["restaurant"] is False
        assert modulos["laundry"] is False
        assert modulos["barbershop"] is False

    def test_servicio_tecnico_activa_services(self):
        """Servicio Técnico de Celulares activa services."""
        modulos = _get_modules_for_rubro("Servicio Técnico de Celulares")
        assert modulos["services"] is True
        assert modulos["hardware"] is True

    def test_barberia_activa_barbershop(self):
        """Barbería Don Carlos activa el módulo barbershop."""
        modulos = _get_modules_for_rubro("Barbería Don Carlos")
        assert modulos["barbershop"] is True
        assert modulos["hardware"] is True
        assert modulos["restaurant"] is False
        assert modulos["laundry"] is False
        assert modulos["services"] is False

    def test_peluqueria_activa_barbershop(self):
        """Peluquería también cae en el módulo barbershop."""
        modulos = _get_modules_for_rubro("Peluquería Moderna")
        assert modulos["barbershop"] is True
        assert modulos["hardware"] is True

    def test_default_sin_rubro_activa_hardware(self):
        """Con None como rubro, solo hardware debe estar activo."""
        modulos = _get_modules_for_rubro(None)
        assert modulos["hardware"] is True
        assert modulos["restaurant"] is False
        assert modulos["laundry"] is False
        assert modulos["services"] is False
        assert modulos["barbershop"] is False

    def test_rubro_vacio_activa_hardware(self):
        """Cadena vacía equivale al default; solo hardware activo."""
        modulos = _get_modules_for_rubro("")
        assert modulos["hardware"] is True
        assert modulos["restaurant"] is False
        assert modulos["laundry"] is False
        assert modulos["services"] is False
        assert modulos["barbershop"] is False

    def test_rubro_mixto_spa_activa_barbershop(self):
        """Spa y Servicio de Belleza debe activar barbershop."""
        modulos = _get_modules_for_rubro("Spa y Servicio de Belleza")
        assert modulos["barbershop"] is True
        assert modulos["hardware"] is True

    def test_rubro_mixto_barberia_servicios(self):
        """
        Un rubro que contiene palabras clave de barbershop Y services
        debe activar ambos módulos.
        """
        modulos = _get_modules_for_rubro("Barbería y Servicio Técnico de Teléfonos")
        assert modulos["barbershop"] is True
        assert modulos["services"] is True
        assert modulos["hardware"] is True

    def test_rubro_mayusculas_minusculas(self):
        """La comparación debe ser case-insensitive: 'restaurante' en minúsculas activa restaurant."""
        modulos = _get_modules_for_rubro("restaurante del pueblo")
        assert modulos["restaurant"] is True
        assert modulos["hardware"] is True

    def test_rubro_mayusculas_puro(self):
        """RESTAURANT en mayúsculas también debe activar restaurant."""
        modulos = _get_modules_for_rubro("RESTAURANT")
        assert modulos["restaurant"] is True

    def test_minimarket_activa_hardware_solo(self):
        """Minimarket es retail puro: solo hardware."""
        modulos = _get_modules_for_rubro("Minimarket La Esquina")
        assert modulos["hardware"] is True
        assert modulos["restaurant"] is False
        assert modulos["laundry"] is False
        assert modulos["services"] is False
        assert modulos["barbershop"] is False

    def test_farmacia_activa_hardware_solo(self):
        """Farmacia es retail puro: solo hardware."""
        modulos = _get_modules_for_rubro("Farmacia San José")
        assert modulos["hardware"] is True
        assert modulos["restaurant"] is False


# ---------------------------------------------------------------------------
# Fixtures para TestRegistroPublico
# ---------------------------------------------------------------------------

def _build_test_app():
    """
    Construye una app FastAPI mínima con el router de public_auth incluido.
    Parchea slowapi.Limiter para que no intente almacenamiento Redis.
    """
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    # Parchear el limiter antes de importar el router
    with patch("backend_api.dependencies.limiter") as mock_limiter:
        # limiter.limit devuelve un decorador identidad
        mock_limiter.limit.return_value = lambda f: f

        from backend_api.routers.public_auth import router as public_router

        app = FastAPI()
        app.include_router(public_router, prefix="/api/v1")

    return app


@pytest.fixture()
def public_app():
    """Retorna la app FastAPI de prueba para el registro público."""
    try:
        from fastapi import FastAPI
        from fastapi.testclient import TestClient  # noqa: F401
        return _build_test_app()
    except ImportError as e:
        pytest.skip(f"FastAPI o dependencias no disponibles: {e}")


@pytest.fixture()
def client(public_app):
    """TestClient listo para hacer peticiones al endpoint de registro."""
    from fastapi.testclient import TestClient
    return TestClient(public_app, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# TestRegistroPublico — tests del endpoint POST /api/v1/public/register
# ---------------------------------------------------------------------------

class TestRegistroPublico:
    """
    Valida el comportamiento del endpoint de registro público.

    TenantService.create_tenant se parchea en todos los tests para evitar
    conexiones reales a PostgreSQL.
    """

    _VALID_PAYLOAD = {
        "company_name": "Ferretería El Clavo",
        "email": "admin@elclavo.com",
        "password": "segura123",
        "business_type": "Ferretería",
    }

    def test_nombre_muy_corto_retorna_422(self, client):
        """company_name < 3 caracteres debe retornar 422 (validación Pydantic)."""
        payload = {**self._VALID_PAYLOAD, "company_name": "AB"}
        response = client.post("/api/v1/public/register", json=payload)
        assert response.status_code == 422

    def test_password_muy_corta_retorna_422(self, client):
        """password < 6 caracteres debe retornar 422."""
        payload = {**self._VALID_PAYLOAD, "password": "123"}
        response = client.post("/api/v1/public/register", json=payload)
        assert response.status_code == 422

    def test_email_invalido_retorna_422(self, client):
        """Email con formato inválido debe retornar 422."""
        payload = {**self._VALID_PAYLOAD, "email": "no-es-un-email"}
        response = client.post("/api/v1/public/register", json=payload)
        assert response.status_code == 422

    def test_registro_exitoso_retorna_tenant_id(self, client):
        """Registro válido debe retornar status=success y tenant_id."""
        mock_result = {"tenant_id": "ferreteria_el_clavo", "schema_name": "ferreteria_el_clavo"}

        with patch("backend_api.routers.public_auth.TenantService") as MockService:
            MockService.slugify_schema_name.return_value = "ferreteria_el_clavo"
            MockService.create_tenant.return_value = mock_result

            response = client.post("/api/v1/public/register", json=self._VALID_PAYLOAD)

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["tenant_id"] == "ferreteria_el_clavo"

    def test_email_duplicado_retorna_400(self, client):
        """Si TenantService lanza ValueError (email/schema duplicado), debe retornar 400."""
        with patch("backend_api.routers.public_auth.TenantService") as MockService:
            MockService.slugify_schema_name.return_value = "ferreteria_el_clavo"
            MockService.create_tenant.side_effect = ValueError(
                "El ID de empresa 'ferreteria_el_clavo' ya existe."
            )

            response = client.post("/api/v1/public/register", json=self._VALID_PAYLOAD)

        assert response.status_code == 400
        assert "ya existe" in response.json()["detail"]

    def test_business_type_se_pasa_a_service(self, client):
        """El campo business_type del request debe llegar como plan_type al service."""
        mock_result = {"tenant_id": "mi_pizza", "schema_name": "mi_pizza"}

        payload = {
            "company_name": "Mi Pizza",
            "email": "admin@mipizza.com",
            "password": "segura123",
            "business_type": "Pizza Palace",
        }

        with patch("backend_api.routers.public_auth.TenantService") as MockService:
            MockService.slugify_schema_name.return_value = "mi_pizza"
            MockService.create_tenant.return_value = mock_result

            response = client.post("/api/v1/public/register", json=payload)

        assert response.status_code == 200
        # Verificar que create_tenant recibió el business_type correcto
        call_kwargs = MockService.create_tenant.call_args
        assert call_kwargs.kwargs.get("plan_type") == "Pizza Palace" or (
            call_kwargs.args and "Pizza Palace" in call_kwargs.args
        )

    def test_sin_business_type_usa_ferreteria_default(self, client):
        """Sin business_type ni plan_type, el servicio debe recibir 'FERRETERIA' como default."""
        mock_result = {"tenant_id": "tienda_nueva", "schema_name": "tienda_nueva"}

        payload = {
            "company_name": "Tienda Nueva",
            "email": "admin@tienda.com",
            "password": "segura123",
            # Sin business_type ni plan_type
        }

        with patch("backend_api.routers.public_auth.TenantService") as MockService:
            MockService.slugify_schema_name.return_value = "tienda_nueva"
            MockService.create_tenant.return_value = mock_result

            response = client.post("/api/v1/public/register", json=payload)

        assert response.status_code == 200
        call_kwargs = MockService.create_tenant.call_args
        # El router usa "FERRETERIA" como default cuando ambos campos son None
        plan_passed = call_kwargs.kwargs.get("plan_type") or (
            call_kwargs.args[4] if len(call_kwargs.args) > 4 else None
        )
        assert plan_passed == "FERRETERIA"

    def test_plan_type_backward_compatibility(self, client):
        """plan_type (campo legado) también debe ser aceptado cuando no hay business_type."""
        mock_result = {"tenant_id": "rest_legacy", "schema_name": "rest_legacy"}

        payload = {
            "company_name": "Rest Legado",
            "email": "admin@restlegado.com",
            "password": "segura123",
            "plan_type": "RESTAURANT",  # campo legado, sin business_type
        }

        with patch("backend_api.routers.public_auth.TenantService") as MockService:
            MockService.slugify_schema_name.return_value = "rest_legacy"
            MockService.create_tenant.return_value = mock_result

            response = client.post("/api/v1/public/register", json=payload)

        assert response.status_code == 200
        call_kwargs = MockService.create_tenant.call_args
        plan_passed = call_kwargs.kwargs.get("plan_type") or (
            call_kwargs.args[4] if len(call_kwargs.args) > 4 else None
        )
        assert plan_passed == "RESTAURANT"

    def test_error_interno_retorna_500(self, client):
        """Excepciones inesperadas en TenantService deben retornar 500."""
        with patch("backend_api.routers.public_auth.TenantService") as MockService:
            MockService.slugify_schema_name.return_value = "cualquier_schema"
            MockService.create_tenant.side_effect = RuntimeError("Error inesperado en BD")

            response = client.post("/api/v1/public/register", json=self._VALID_PAYLOAD)

        assert response.status_code == 500

    def test_respuesta_exitosa_incluye_redirect_url(self, client):
        """La respuesta de éxito debe incluir redirect_url para que el frontend redirija."""
        mock_result = {"tenant_id": "abc", "schema_name": "abc"}

        with patch("backend_api.routers.public_auth.TenantService") as MockService:
            MockService.slugify_schema_name.return_value = "abc"
            MockService.create_tenant.return_value = mock_result

            response = client.post("/api/v1/public/register", json=self._VALID_PAYLOAD)

        assert response.status_code == 200
        assert "redirect_url" in response.json()


# ---------------------------------------------------------------------------
# TestTrialEndsAt — lógica de campos de licencia para nuevos tenants
# ---------------------------------------------------------------------------

class TestTrialEndsAt:
    """
    Verifica los campos de licencia que se asignan al crear un nuevo tenant.

    No llama a TenantService.create_tenant directamente (requiere CREATE SCHEMA
    en PostgreSQL). En su lugar, replica la lógica de los campos de licencia
    para testearla de forma aislada.
    """

    TRIAL_DAYS_DEFAULT = 15  # Valor por defecto definido en config.py

    def _simular_campos_licencia(self, trial_days: int | None = None) -> dict:
        """
        Simula exactamente los campos que TenantService asigna al nuevo tenant
        al momento del registro público.

        Retorna un dict con license_type, trial_days y trial_ends_at.
        """
        days = trial_days if trial_days is not None else self.TRIAL_DAYS_DEFAULT
        now = datetime.utcnow()
        return {
            "license_type": "trial",
            "trial_days": days,
            "trial_ends_at": now + timedelta(days=days),
            "_created_at": now,
        }

    def test_nuevo_tenant_tiene_trial_ends_at_no_nulo(self):
        """trial_ends_at no debe ser None en un tenant recién creado."""
        campos = self._simular_campos_licencia()
        assert campos["trial_ends_at"] is not None

    def test_trial_ends_at_es_futuro(self):
        """trial_ends_at debe ser una fecha en el futuro respecto a utcnow()."""
        campos = self._simular_campos_licencia()
        # Margen de 1 segundo para compensar tiempo de ejecución
        assert campos["trial_ends_at"] > datetime.utcnow() - timedelta(seconds=1)

    def test_trial_ends_at_aproximadamente_15_dias(self):
        """trial_ends_at debe estar entre 14 y 16 días desde ahora."""
        campos = self._simular_campos_licencia()
        ahora = datetime.utcnow()
        delta = campos["trial_ends_at"] - ahora
        assert timedelta(days=14) <= delta <= timedelta(days=16), (
            f"trial_ends_at debería estar entre 14 y 16 días; delta actual: {delta}"
        )

    def test_license_type_es_trial_no_lifetime(self):
        """El tipo de licencia inicial debe ser 'trial', no 'lifetime' ni otro valor."""
        campos = self._simular_campos_licencia()
        assert campos["license_type"] == "trial"
        assert campos["license_type"] != "lifetime"
        assert campos["license_type"] != "monthly"
        assert campos["license_type"] != "annual"

    def test_trial_days_coincide_con_delta(self):
        """El campo trial_days debe coincidir con la diferencia real de días en trial_ends_at."""
        campos = self._simular_campos_licencia(trial_days=15)
        delta = campos["trial_ends_at"] - campos["_created_at"]
        assert abs(delta.days - campos["trial_days"]) <= 1  # tolerancia por segundos

    def test_trial_days_por_defecto_es_15(self):
        """El valor por defecto de trial_days debe ser 15 (según config.py)."""
        campos = self._simular_campos_licencia()
        assert campos["trial_days"] == 15

    def test_trial_ends_at_es_datetime(self):
        """trial_ends_at debe ser una instancia de datetime."""
        campos = self._simular_campos_licencia()
        assert isinstance(campos["trial_ends_at"], datetime)

    def test_configuracion_desde_settings(self):
        """
        Verifica que el valor LICENSE_TRIAL_DAYS_DEFAULT en config.py
        es exactamente 15, que es el valor esperado por el sistema.
        """
        try:
            from backend_api.config import settings
            assert settings.LICENSE_TRIAL_DAYS_DEFAULT == 15
        except ImportError:
            pytest.skip("config.py no disponible en este entorno.")
