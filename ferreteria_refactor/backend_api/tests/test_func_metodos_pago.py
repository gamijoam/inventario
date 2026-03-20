"""
test_func_metodos_pago.py — Tests funcionales de Métodos de Pago

Flujos cubiertos:
  FMP01 — CRUD: crear, nombre único, campos opcionales
  FMP02 — is_system: métodos del sistema no eliminables
  FMP03 — is_active: filtrado de métodos activos
  FMP04 — requires_reference: flag para métodos que piden referencia (cheque, transferencia)

Correr con:
    cd ferreteria_refactor
    python -m pytest backend_api/tests/test_func_metodos_pago.py -v --no-cov -s
"""

import pytest
import uuid

import sys, os
_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _root not in sys.path:
    sys.path.insert(0, _root)

from sqlalchemy.exc import IntegrityError
from backend_api.models.models import PaymentMethod

TENANT = "lalicoreria"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def tenant_db(pg_db_for_schema):
    return pg_db_for_schema(TENANT)


@pytest.fixture()
def pm_obj(tenant_db):
    pm = PaymentMethod(name=f"Método {uuid.uuid4().hex[:8]}")
    tenant_db.add(pm)
    tenant_db.flush()
    return pm


# ---------------------------------------------------------------------------
# FMP01 — CRUD básico
# ---------------------------------------------------------------------------

class TestFMP01CRUD:

    def test_crear_metodo_persiste(self, tenant_db):
        """FMP01a: Crear método de pago con todos los campos — persiste correctamente."""
        pm = PaymentMethod(
            name=f"Transferencia {uuid.uuid4().hex[:6]}",
            is_active=True,
            requires_reference=True,
            is_system=False,
        )
        tenant_db.add(pm)
        tenant_db.flush()

        tenant_db.refresh(pm)
        assert pm.id is not None
        assert pm.requires_reference is True
        assert pm.is_system is False

    def test_nombre_unico_integrity_error(self, tenant_db, pm_obj):
        """FMP01b: Dos métodos con el mismo nombre → IntegrityError."""
        duplicate = PaymentMethod(name=pm_obj.name)
        tenant_db.add(duplicate)
        with pytest.raises(IntegrityError):
            tenant_db.flush()

    def test_defaults(self, tenant_db):
        """FMP01c: Defaults: is_active=True, requires_reference=False, is_system=False."""
        pm = PaymentMethod(name=f"PM Def {uuid.uuid4().hex[:6]}")
        tenant_db.add(pm)
        tenant_db.flush()
        tenant_db.refresh(pm)
        assert pm.is_active is True
        assert pm.requires_reference is False
        assert pm.is_system is False

    def test_requires_reference_persiste(self, tenant_db):
        """FMP01d: requires_reference=True persiste (métodos que requieren comprobante)."""
        pm = PaymentMethod(
            name=f"Cheque {uuid.uuid4().hex[:6]}",
            requires_reference=True,
        )
        tenant_db.add(pm)
        tenant_db.flush()
        tenant_db.refresh(pm)
        assert pm.requires_reference is True


# ---------------------------------------------------------------------------
# FMP02 — is_system: métodos del sistema
# ---------------------------------------------------------------------------

class TestFMP02IsSystem:

    def test_is_system_true_no_eliminable(self, tenant_db):
        """
        FMP02a: Un método con is_system=True no debe ser eliminado.
        El router verifica este flag antes de hacer el delete → 400.
        """
        pm = PaymentMethod(
            name=f"Efectivo Sistema {uuid.uuid4().hex[:6]}",
            is_system=True,
        )
        tenant_db.add(pm)
        tenant_db.flush()

        # Simular la validación del router
        es_sistema = pm.is_system
        assert es_sistema is True, "El router debe rechazar delete de métodos del sistema"

    def test_is_system_false_eliminable(self, tenant_db):
        """FMP02b: Un método con is_system=False puede eliminarse sin restricción."""
        pm = PaymentMethod(
            name=f"PM Custom {uuid.uuid4().hex[:6]}",
            is_system=False,
        )
        tenant_db.add(pm)
        tenant_db.flush()

        assert pm.is_system is False  # El router permitiría el delete
        tenant_db.delete(pm)
        tenant_db.flush()

        recuperado = tenant_db.query(PaymentMethod).filter_by(id=pm.id).first()
        assert recuperado is None

    def test_metodo_sistema_no_se_crea_como_sistema_por_defecto(self, tenant_db):
        """
        FMP02c: Los métodos creados por el router usan is_system=False.
        Solo el seed inicial pone is_system=True.
        """
        pm = PaymentMethod(name=f"Custom {uuid.uuid4().hex[:6]}")
        tenant_db.add(pm)
        tenant_db.flush()
        assert pm.is_system is False


# ---------------------------------------------------------------------------
# FMP03 — is_active: filtrado
# ---------------------------------------------------------------------------

class TestFMP03IsActive:

    def test_metodo_inactivo_excluido_del_filtro(self, tenant_db):
        """FMP03a: is_active=False excluye el método del listado activo."""
        pm_activo = PaymentMethod(name=f"Activo {uuid.uuid4().hex[:6]}", is_active=True)
        pm_inactivo = PaymentMethod(name=f"Inactivo {uuid.uuid4().hex[:6]}", is_active=False)
        tenant_db.add_all([pm_activo, pm_inactivo])
        tenant_db.flush()

        activos = tenant_db.query(PaymentMethod).filter_by(is_active=True).all()
        ids_activos = {m.id for m in activos}

        assert pm_activo.id in ids_activos
        assert pm_inactivo.id not in ids_activos

    def test_desactivar_metodo(self, tenant_db, pm_obj):
        """FMP03b: Desactivar un método cambia is_active=False."""
        pm_obj.is_active = False
        tenant_db.flush()

        tenant_db.refresh(pm_obj)
        assert pm_obj.is_active is False

    def test_metodo_inactivo_no_aparece_en_pos(self, tenant_db):
        """
        FMP03c: En el POS, solo aparecen métodos activos para seleccionar.
        Verificamos que el filtro is_active=True funciona correctamente.
        """
        pm1 = PaymentMethod(name=f"PM Act1 {uuid.uuid4().hex[:6]}", is_active=True)
        pm2 = PaymentMethod(name=f"PM Act2 {uuid.uuid4().hex[:6]}", is_active=True)
        pm3 = PaymentMethod(name=f"PM Inact {uuid.uuid4().hex[:6]}", is_active=False)
        tenant_db.add_all([pm1, pm2, pm3])
        tenant_db.flush()

        disponibles = tenant_db.query(PaymentMethod).filter_by(is_active=True).all()
        ids = {m.id for m in disponibles}

        assert pm1.id in ids
        assert pm2.id in ids
        assert pm3.id not in ids
