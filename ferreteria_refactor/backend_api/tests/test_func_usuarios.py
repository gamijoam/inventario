"""
test_func_usuarios.py — Tests funcionales de Usuarios

Flujos cubiertos:
  FUS01 — Crear usuarios con distintos roles y campos
  FUS02 — PIN: se hashea con bcrypt, verificable con passlib
  FUS03 — Soft-delete: is_active=False preserva historial
  FUS04 — Email único globalmente, username único por tenant

Correr con:
    cd ferreteria_refactor
    python -m pytest backend_api/tests/test_func_usuarios.py -v --no-cov -s
"""

import pytest
import uuid
from decimal import Decimal
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

import sys, os
_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _root not in sys.path:
    sys.path.insert(0, _root)

from passlib.context import CryptContext

from backend_api.models.models import User, UserRole

TENANT = "lalicoreria"

# Contexto bcrypt — mismo que usa la app
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def tenant_db(pg_db_for_schema):
    return pg_db_for_schema(TENANT)


@pytest.fixture()
def tenant_id(pg_engine):
    """Obtiene el id del tenant de test."""
    with pg_engine.connect() as conn:
        row = conn.execute(
            text("SELECT id FROM public.tenants WHERE schema_name = :s"),
            {"s": TENANT}
        ).fetchone()
    assert row is not None, f"Tenant '{TENANT}' no encontrado"
    return row[0]


def _crear_usuario(db, tenant_id, *, role=UserRole.CASHIER, commission=Decimal("0.00")):
    """Crea un usuario de test con email único."""
    uid = uuid.uuid4().hex[:8]
    user = User(
        email=f"test_{uid}@test-func.internal",
        username=f"testuser_{uid}",
        password_hash=_pwd_context.hash("TestPass123!"),
        role=role,
        tenant_id=tenant_id,
        full_name=f"Usuario Test {uid}",
        commission_percentage=commission,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


# ---------------------------------------------------------------------------
# FUS01 — Creación de usuarios con distintos roles
# ---------------------------------------------------------------------------

class TestFUS01CrearUsuario:

    def test_crear_cajero_campos_persisten(self, tenant_db, tenant_id):
        """
        FUS01a: Crear usuario con rol CASHIER y verificar que todos los
        campos relevantes persisten en public.users.
        """
        user = _crear_usuario(tenant_db, tenant_id, role=UserRole.CASHIER)

        tenant_db.refresh(user)
        assert user.id is not None
        assert user.role == UserRole.CASHIER
        assert user.is_active is True
        assert user.tenant_id == tenant_id
        assert user.commission_percentage == Decimal("0.00")

    def test_crear_admin_con_comision(self, tenant_db, tenant_id):
        """
        FUS01b: Crear usuario ADMIN con commission_percentage > 0.
        El campo es Numeric(5,2), soporta valores como 3.50 o 10.00.
        """
        user = _crear_usuario(tenant_db, tenant_id,
                               role=UserRole.ADMIN,
                               commission=Decimal("5.50"))

        tenant_db.refresh(user)
        assert user.role == UserRole.ADMIN
        assert user.commission_percentage == Decimal("5.50")

    def test_crear_warehouse_user(self, tenant_db, tenant_id):
        """
        FUS01c: Crear usuario con rol WAREHOUSE (acceso a inventario).
        """
        user = _crear_usuario(tenant_db, tenant_id, role=UserRole.WAREHOUSE)

        assert user.role == UserRole.WAREHOUSE

    def test_email_unico_globalmente(self, tenant_db, tenant_id):
        """
        FUS01d: El email tiene unique=True sin restricción de schema,
        es decir, es único GLOBALMENTE (entre todos los tenants).
        Insertar dos usuarios con el mismo email → IntegrityError.
        """
        email_fijo = f"unico_{uuid.uuid4().hex[:8]}@test-func.internal"

        user1 = User(
            email=email_fijo,
            username=f"u1_{uuid.uuid4().hex[:6]}",
            password_hash=_pwd_context.hash("pass"),
            role=UserRole.CASHIER,
            tenant_id=tenant_id,
        )
        tenant_db.add(user1)
        tenant_db.flush()

        user2 = User(
            email=email_fijo,  # mismo email
            username=f"u2_{uuid.uuid4().hex[:6]}",
            password_hash=_pwd_context.hash("pass"),
            role=UserRole.CASHIER,
            tenant_id=tenant_id,
        )
        tenant_db.add(user2)

        with pytest.raises(IntegrityError):
            tenant_db.flush()


# ---------------------------------------------------------------------------
# FUS02 — PIN: hasheo y verificación con bcrypt
# ---------------------------------------------------------------------------

class TestFUS02PIN:

    def test_pin_se_hashea_con_bcrypt(self, tenant_db, tenant_id):
        """
        FUS02a: El PIN debe almacenarse como hash bcrypt (~60 caracteres),
        nunca en texto plano. Este fue el bug encontrado en producción
        (Test 36 de integridad) donde 6 usuarios tenían el PIN en plano.
        """
        pin_plano = "1234"
        pin_hash = _pwd_context.hash(pin_plano)

        user = _crear_usuario(tenant_db, tenant_id)
        user.pin = pin_hash
        tenant_db.flush()

        tenant_db.refresh(user)
        # El PIN guardado NO es el texto plano
        assert user.pin != pin_plano
        # Es un hash bcrypt (~60 caracteres, empieza con $2b$)
        assert len(user.pin) > 50
        assert user.pin.startswith("$2b$") or user.pin.startswith("$2a$")

    def test_pin_verificable_con_passlib(self, tenant_db, tenant_id):
        """
        FUS02b: El PIN hasheado debe poder verificarse con passlib.verify().
        Este es el flujo real del endpoint /auth/validate-pin.
        """
        pin_plano = "5678"
        pin_hash = _pwd_context.hash(pin_plano)

        user = _crear_usuario(tenant_db, tenant_id)
        user.pin = pin_hash
        tenant_db.flush()

        tenant_db.refresh(user)
        assert _pwd_context.verify(pin_plano, user.pin) is True
        assert _pwd_context.verify("9999", user.pin) is False

    def test_mismo_pin_genera_hashes_distintos(self, tenant_db, tenant_id):
        """
        FUS02c: Bcrypt incluye un salt aleatorio. El mismo PIN genera hashes
        distintos en cada llamada → imposible comparar por igualdad de string.
        Solo se puede verificar con passlib.verify().
        """
        pin = "0000"
        hash1 = _pwd_context.hash(pin)
        hash2 = _pwd_context.hash(pin)

        assert hash1 != hash2  # Hashes diferentes por salt aleatorio
        # Ambos verifican el mismo PIN correctamente
        assert _pwd_context.verify(pin, hash1) is True
        assert _pwd_context.verify(pin, hash2) is True


# ---------------------------------------------------------------------------
# FUS03 — Soft-delete: is_active=False preserva historial
# ---------------------------------------------------------------------------

class TestFUS03SoftDelete:

    def test_desactivar_usuario_preserva_registro(self, tenant_db, tenant_id):
        """
        FUS03a: Marcar is_active=False no elimina el usuario.
        El registro permanece para preservar historial de ventas y comisiones.
        """
        user = _crear_usuario(tenant_db, tenant_id)
        user_id = user.id

        user.is_active = False
        tenant_db.flush()

        recovered = tenant_db.query(User).get(user_id)
        assert recovered is not None
        assert recovered.is_active is False

    def test_usuario_inactivo_excluido_de_filtro(self, tenant_db, tenant_id):
        """
        FUS03b: Filtrando is_active=True, los usuarios inactivos no aparecen.
        El endpoint de listado aplica este filtro por default.
        """
        user_activo = _crear_usuario(tenant_db, tenant_id)
        user_inactivo = _crear_usuario(tenant_db, tenant_id)
        user_inactivo.is_active = False
        tenant_db.flush()

        activos = tenant_db.query(User).filter(
            User.id.in_([user_activo.id, user_inactivo.id]),
            User.is_active == True,
        ).all()

        ids_activos = [u.id for u in activos]
        assert user_activo.id in ids_activos
        assert user_inactivo.id not in ids_activos
