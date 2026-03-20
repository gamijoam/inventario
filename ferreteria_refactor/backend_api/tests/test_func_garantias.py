"""
test_func_garantias.py — Tests funcionales de Garantías

Flujos cubiertos:
  FGA01 — WarrantyPolicy: crear, tipos (DAYS/MONTHS/YEARS/LIFETIME), is_default
  FGA02 — WarrantyClaim: crear, flujo PENDING→COMPLETED→REJECTED, resolved_at auto-set
  FGA03 — Casos borde: LIFETIME sin duration, múltiples políticas

Correr con:
    cd ferreteria_refactor
    python -m pytest backend_api/tests/test_func_garantias.py -v --no-cov -s
"""

import pytest
import uuid
from datetime import datetime
from sqlalchemy import text

import sys, os
_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _root not in sys.path:
    sys.path.insert(0, _root)

from backend_api.models.models import WarrantyPolicy, WarrantyClaim, Customer

TENANT = "lalicoreria"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def tenant_db(pg_db_for_schema):
    return pg_db_for_schema(TENANT)


@pytest.fixture()
def tenant_id(pg_engine):
    """Obtiene el tenant_id desde public.tenants para el schema lalicoreria."""
    with pg_engine.connect() as conn:
        row = conn.execute(text(
            "SELECT id FROM public.tenants WHERE schema_name = :schema LIMIT 1"
        ), {"schema": TENANT}).fetchone()
    assert row is not None, f"Tenant '{TENANT}' no encontrado en public.tenants"
    return row[0]


@pytest.fixture()
def customer_obj(tenant_db):
    cust = Customer(
        name=f"Cliente Garantía {uuid.uuid4().hex[:6]}",
        is_active=True,
    )
    tenant_db.add(cust)
    tenant_db.flush()
    return cust


@pytest.fixture()
def policy_obj(tenant_db, tenant_id):
    policy = WarrantyPolicy(
        tenant_id=tenant_id,
        name=f"Garantía 12 Meses {uuid.uuid4().hex[:6]}",
        type="MONTHS",
        duration=12,
        is_active=True,
        is_default=False,
    )
    tenant_db.add(policy)
    tenant_db.flush()
    return policy


# ---------------------------------------------------------------------------
# FGA01 — WarrantyPolicy
# ---------------------------------------------------------------------------

class TestFGA01WarrantyPolicy:

    def test_crear_policy_meses(self, tenant_db, tenant_id):
        """FGA01a: Crear política de garantía en MONTHS — todos los campos persisten."""
        policy = WarrantyPolicy(
            tenant_id=tenant_id,
            name=f"Garantía 6M {uuid.uuid4().hex[:6]}",
            type="MONTHS",
            duration=6,
            description="Garantía de 6 meses por defectos de fabricación",
            is_active=True,
        )
        tenant_db.add(policy)
        tenant_db.flush()

        tenant_db.refresh(policy)
        assert policy.id is not None
        assert policy.type == "MONTHS"
        assert policy.duration == 6
        assert policy.description is not None
        assert policy.is_active is True

    def test_crear_policy_lifetime_sin_duration(self, tenant_db, tenant_id):
        """FGA01b: Garantía de tipo LIFETIME no tiene duration (nullable)."""
        policy = WarrantyPolicy(
            tenant_id=tenant_id,
            name=f"Garantía Lifetime {uuid.uuid4().hex[:6]}",
            type="LIFETIME",
            duration=None,  # LIFETIME no tiene duración
        )
        tenant_db.add(policy)
        tenant_db.flush()

        tenant_db.refresh(policy)
        assert policy.type == "LIFETIME"
        assert policy.duration is None

    def test_is_default_persiste(self, tenant_db, tenant_id):
        """FGA01c: Una política puede marcarse como default."""
        policy = WarrantyPolicy(
            tenant_id=tenant_id,
            name=f"Garantía Default {uuid.uuid4().hex[:6]}",
            type="DAYS",
            duration=365,
            is_default=True,
        )
        tenant_db.add(policy)
        tenant_db.flush()

        tenant_db.refresh(policy)
        assert policy.is_default is True

    def test_policy_inactiva_excluida(self, tenant_db, tenant_id):
        """FGA01d: Políticas inactivas (is_active=False) no aparecen en el listado activo."""
        p_activa = WarrantyPolicy(
            tenant_id=tenant_id,
            name=f"P Activa {uuid.uuid4().hex[:6]}",
            type="YEARS",
            duration=1,
            is_active=True,
        )
        p_inactiva = WarrantyPolicy(
            tenant_id=tenant_id,
            name=f"P Inactiva {uuid.uuid4().hex[:6]}",
            type="MONTHS",
            duration=3,
            is_active=False,
        )
        tenant_db.add_all([p_activa, p_inactiva])
        tenant_db.flush()

        activas = tenant_db.query(WarrantyPolicy).filter_by(
            tenant_id=tenant_id, is_active=True
        ).all()
        ids = {p.id for p in activas}

        assert p_activa.id in ids
        assert p_inactiva.id not in ids

    def test_multiples_tipos_aceptados(self, tenant_db, tenant_id):
        """FGA01e: Los tipos DAYS, MONTHS, YEARS, LIFETIME son todos válidos."""
        tipos = ["DAYS", "MONTHS", "YEARS", "LIFETIME"]
        for tipo in tipos:
            p = WarrantyPolicy(
                tenant_id=tenant_id,
                name=f"P-{tipo} {uuid.uuid4().hex[:6]}",
                type=tipo,
                duration=None if tipo == "LIFETIME" else 30,
            )
            tenant_db.add(p)

        tenant_db.flush()  # Si ningún tipo falla, todos son válidos


# ---------------------------------------------------------------------------
# FGA02 — WarrantyClaim
# ---------------------------------------------------------------------------

class TestFGA02WarrantyClaim:

    def test_claim_creado_con_status_pending(self, tenant_db, tenant_id, customer_obj, policy_obj):
        """FGA02a: Un reclamo nuevo tiene status=PENDING y claimed_at auto-set."""
        claim = WarrantyClaim(
            tenant_id=tenant_id,
            sale_item_id=9999,  # ID simulado (no FK real)
            customer_id=customer_obj.id,
            reason="Producto defectuoso — no enciende",
            status="PENDING",
        )
        tenant_db.add(claim)
        tenant_db.flush()

        tenant_db.refresh(claim)
        assert claim.id is not None
        assert claim.status == "PENDING"
        assert claim.claimed_at is not None
        assert claim.resolved_at is None

    def test_claim_pendiente_a_completado(self, tenant_db, tenant_id, customer_obj):
        """
        FGA02b: Al completar un reclamo (status=COMPLETED), resolved_at se setea.
        El router lo hace automáticamente si resolved_at está vacío.
        """
        claim = WarrantyClaim(
            tenant_id=tenant_id,
            sale_item_id=9998,
            customer_id=customer_obj.id,
            reason="Falla de batería",
        )
        tenant_db.add(claim)
        tenant_db.flush()

        # Simular la lógica del router: completar el reclamo
        claim.status = "COMPLETED"
        claim.resolution_type = "REPLACE"
        claim.resolution_notes = "Se reemplazó el producto"
        if not claim.resolved_at:
            claim.resolved_at = datetime.utcnow()
        tenant_db.flush()

        tenant_db.refresh(claim)
        assert claim.status == "COMPLETED"
        assert claim.resolved_at is not None
        assert claim.resolution_type == "REPLACE"

    def test_claim_rechazado(self, tenant_db, tenant_id, customer_obj):
        """FGA02c: Un reclamo puede ser rechazado (REJECTED) con diagnóstico."""
        claim = WarrantyClaim(
            tenant_id=tenant_id,
            sale_item_id=9997,
            customer_id=customer_obj.id,
            reason="Pantalla rota",
        )
        tenant_db.add(claim)
        tenant_db.flush()

        claim.status = "REJECTED"
        claim.diagnosis = "Daño físico por mal uso — no cubre garantía"
        claim.resolved_at = datetime.utcnow()
        tenant_db.flush()

        tenant_db.refresh(claim)
        assert claim.status == "REJECTED"
        assert claim.diagnosis is not None
        assert claim.resolved_at is not None

    def test_claim_aprobado_con_snapshot_policy(self, tenant_db, tenant_id, customer_obj, policy_obj):
        """FGA02d: Un reclamo puede almacenar un snapshot JSON de la política."""
        snapshot = {
            "policy_id": policy_obj.id,
            "name": policy_obj.name,
            "type": policy_obj.type,
            "duration": policy_obj.duration,
        }
        claim = WarrantyClaim(
            tenant_id=tenant_id,
            sale_item_id=9996,
            customer_id=customer_obj.id,
            reason="Defecto de fabricación",
            status="APPROVED",
            policy_snapshot=snapshot,
        )
        tenant_db.add(claim)
        tenant_db.flush()

        tenant_db.refresh(claim)
        assert claim.status == "APPROVED"
        assert claim.policy_snapshot is not None
        assert claim.policy_snapshot["policy_id"] == policy_obj.id


# ---------------------------------------------------------------------------
# FGA03 — Casos borde
# ---------------------------------------------------------------------------

class TestFGA03CasosBorde:

    def test_claim_sin_policy_snapshot(self, tenant_db, tenant_id, customer_obj):
        """FGA03a: policy_snapshot es nullable — un reclamo puede crearse sin snapshot."""
        claim = WarrantyClaim(
            tenant_id=tenant_id,
            sale_item_id=9995,
            customer_id=customer_obj.id,
            reason="Motor quemado",
            policy_snapshot=None,
        )
        tenant_db.add(claim)
        tenant_db.flush()

        tenant_db.refresh(claim)
        assert claim.policy_snapshot is None

    def test_multiples_claims_por_cliente(self, tenant_db, tenant_id, customer_obj):
        """FGA03b: Un cliente puede tener múltiples reclamos activos simultáneamente."""
        claims = []
        for i in range(3):
            c = WarrantyClaim(
                tenant_id=tenant_id,
                sale_item_id=9000 + i,
                customer_id=customer_obj.id,
                reason=f"Defecto #{i+1}",
            )
            tenant_db.add(c)
            claims.append(c)
        tenant_db.flush()

        customer_claims = tenant_db.query(WarrantyClaim).filter_by(
            customer_id=customer_obj.id
        ).all()
        ids = {c.id for c in customer_claims}
        for c in claims:
            assert c.id in ids

    def test_filtrar_claims_por_status(self, tenant_db, tenant_id, customer_obj):
        """FGA03c: Filtrar reclamos por status funciona correctamente."""
        c_pending = WarrantyClaim(
            tenant_id=tenant_id, sale_item_id=8001,
            customer_id=customer_obj.id, reason="Pending test"
        )
        c_completed = WarrantyClaim(
            tenant_id=tenant_id, sale_item_id=8002,
            customer_id=customer_obj.id, reason="Completed test",
            status="COMPLETED", resolved_at=datetime.utcnow()
        )
        tenant_db.add_all([c_pending, c_completed])
        tenant_db.flush()

        pendientes = tenant_db.query(WarrantyClaim).filter_by(
            customer_id=customer_obj.id, status="PENDING"
        ).all()
        completados = tenant_db.query(WarrantyClaim).filter_by(
            customer_id=customer_obj.id, status="COMPLETED"
        ).all()

        pending_ids = {c.id for c in pendientes}
        completed_ids = {c.id for c in completados}

        assert c_pending.id in pending_ids
        assert c_completed.id in completed_ids
        assert c_pending.id not in completed_ids
        assert c_completed.id not in pending_ids
