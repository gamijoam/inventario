"""
Commission Engine v2 — Motor centralizado de cálculo de comisiones.

Jerarquía (mayor prioridad primero):
  1. Regla por CATEGORÍA del producto (commission_rules)
  2. % del usuario (commission_vendor_pct o commission_technician_pct)
  3. Sin comisión (strict_mode=True, sin categoría = sin comisión)

Uso:
    from .commission_engine import CommissionEngine
    engine = CommissionEngine(db, tenant_schema)
    engine.record_vendor_commission(sale_id, detail, salesperson)
    engine.record_technician_commission(order_id, item, technician)
"""

from decimal import Decimal
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from .models import models
from .utils.time_utils import get_venezuela_now


class CommissionEngine:
    def __init__(self, db: Session, feature_flags: dict):
        self.db = db
        self.enabled = feature_flags.get("modulo_comisiones", False)
        self._settings: Optional[models.CommissionSettings] = None

    def _get_settings(self) -> models.CommissionSettings:
        if self._settings is None:
            s = self.db.query(models.CommissionSettings).first()
            if not s:
                s = models.CommissionSettings(global_enabled=False)
                self.db.add(s)
                self.db.flush()
            self._settings = s
        return self._settings

    def is_active_for_module(self, module: str) -> bool:
        """Verifica si el motor está activo para un módulo dado (POS o TALLER)."""
        if not self.enabled:
            return False
        settings = self._get_settings()
        if not settings.global_enabled:
            return False
        if module == "POS":
            return settings.pos_module_enabled
        if module == "TALLER":
            return settings.taller_module_enabled
        return False

    def _get_rule_for_category(self, category_id: Optional[int], module: str) -> Optional[Decimal]:
        """
        Busca la regla activa con mayor prioridad para la categoría dada.
        Retorna el % o None si no hay regla.
        """
        if category_id is None:
            return None

        rule = (
            self.db.query(models.CommissionRule)
            .filter(
                models.CommissionRule.category_id == category_id,
                models.CommissionRule.is_active == True,
                models.CommissionRule.module.in_([module, None])
            )
            .order_by(models.CommissionRule.priority.desc())
            .first()
        )
        return Decimal(str(rule.percentage)) if rule else None

    def _get_percentage(self, category_id: Optional[int], module: str, user_pct: Decimal) -> Optional[Decimal]:
        """
        Retorna el % a aplicar según la jerarquía:
          1. Regla de categoría  →  % específico de la categoría
          2. % del usuario       →  fallback cuando no hay regla de categoría
          3. None                →  sin comisión

        strict_mode: si está activo Y el producto no tiene categoría
          Y el usuario tampoco tiene % configurado → sin comisión.
          Si el usuario tiene % configurado, siempre aplica como fallback.
        """
        settings = self._get_settings()

        # Prioridad 1: regla de categoría (si el producto tiene categoría)
        if category_id is not None:
            rule_pct = self._get_rule_for_category(category_id, module)
            if rule_pct is not None:
                return rule_pct if rule_pct > 0 else None

        # Prioridad 2: % individual del usuario (fallback universal)
        # Aplica tanto si no hay categoría como si hay categoría pero sin regla
        if user_pct and user_pct > 0:
            return user_pct

        # Sin categoría + strict_mode + sin % de usuario = sin comisión
        # Sin categoría + strict_mode desactivado = sin comisión igualmente
        # (ya no hay más niveles de fallback)
        return None

    # ─────────────────────────────────────────────
    # VENDEDOR — POS
    # ─────────────────────────────────────────────
    def record_vendor_commission(
        self,
        sale_id: int,
        detail: models.SaleDetail,
        salesperson: models.User,
    ) -> Optional[models.CommissionLog]:
        """
        Registra comisión de vendedor para un ítem de venta (POS).
        Usa commission_vendor_pct del usuario.
        """
        if not self.is_active_for_module("POS"):
            return None

        product = detail.product
        category_id = product.category_id if product else None
        subtotal = Decimal(str(detail.subtotal))
        vendor_pct = Decimal(str(salesperson.commission_vendor_pct or 0))

        pct = self._get_percentage(category_id, "POS", vendor_pct)
        if not pct:
            return None

        amount = subtotal * (pct / Decimal("100"))
        if amount <= 0:
            return None

        log = models.CommissionLog(
            user_id=salesperson.id,
            sale_detail_id=detail.id,
            source_type="SALE",
            source_id=sale_id,
            source_reference=f"Venta #{sale_id}",
            amount=amount,
            currency="USD",
            percentage_applied=pct,
            commission_role="VENDOR",
        )
        self.db.add(log)
        return log

    # ─────────────────────────────────────────────
    # TÉCNICO — TALLER
    # ─────────────────────────────────────────────
    def record_technician_commission(
        self,
        service_order_id: int,
        sale_detail: models.SaleDetail,
        technician: models.User,
        ticket_number: str = "",
    ) -> Optional[models.CommissionLog]:
        """
        Registra comisión de técnico para un ítem de servicio (Taller).
        Usa commission_technician_pct del usuario.
        """
        if not self.is_active_for_module("TALLER"):
            return None

        product = sale_detail.product if sale_detail.product_id else None
        category_id = product.category_id if product else None
        subtotal = Decimal(str(sale_detail.subtotal))
        tech_pct = Decimal(str(technician.commission_technician_pct or 0))

        # TALLER: los ítems manuales (mano de obra) no tienen categoría.
        # Para el rol TÉCNICO, si no hay categoría pero el técnico tiene %
        # configurado, se usa ese % directamente — el trabajo existe aunque
        # el ítem sea "genérico". El modo estricto aplica solo a VENDEDOR en POS.
        if category_id is None:
            pct = tech_pct if tech_pct > 0 else None
        else:
            pct = self._get_percentage(category_id, "TALLER", tech_pct)

        if not pct:
            return None

        amount = subtotal * (pct / Decimal("100"))
        if amount <= 0:
            return None

        log = models.CommissionLog(
            user_id=technician.id,
            sale_detail_id=sale_detail.id,
            source_type="SERVICE",
            source_id=service_order_id,
            source_reference=ticket_number,
            amount=amount,
            currency="USD",
            percentage_applied=pct,
            commission_role="TECHNICIAN",
        )
        self.db.add(log)
        return log

    def record_taller_vendor_commission(
        self,
        service_order_id: int,
        sale_id: int,
        total_amount: Decimal,
        vendor: models.User,
        ticket_number: str = "",
    ) -> Optional[models.CommissionLog]:
        """
        Comisión al VENDEDOR/CAJERO que gestionó la orden de taller.
        Solo se genera si taller_vendor_commission_enabled = True en settings.
        Esto permite que negocios que solo quieren comisionar al técnico
        puedan desactivar esta comisión adicional.
        """
        if not self.is_active_for_module("TALLER"):
            return None

        settings = self._get_settings()
        if not settings.taller_vendor_commission_enabled:
            return None  # Desactivado — solo comisiona el técnico

        vendor_pct = Decimal(str(vendor.commission_vendor_pct or 0))
        if vendor_pct <= 0:
            return None

        amount = total_amount * (vendor_pct / Decimal("100"))
        if amount <= 0:
            return None

        log = models.CommissionLog(
            user_id=vendor.id,
            source_type="SERVICE",
            source_id=service_order_id,
            source_reference=ticket_number,
            amount=amount,
            currency="USD",
            percentage_applied=vendor_pct,
            commission_role="VENDOR",
        )
        self.db.add(log)
        return log

    # ─────────────────────────────────────────────
    # ANULACIÓN
    # ─────────────────────────────────────────────
    def void_sale_commissions(self, sale_id: int) -> int:
        """
        Anula todas las comisiones pendientes de una venta.
        Las marca como VOIDED (no las borra).
        Retorna cuántas se anularon.
        """
        now = get_venezuela_now()
        # Buscar commission_logs via sale_details (no hay sale_id directo en CommissionLog)
        from sqlalchemy import select
        detail_ids = [
            row[0] for row in self.db.execute(
                select(models.SaleDetail.id).where(models.SaleDetail.sale_id == sale_id)
            ).fetchall()
        ]
        logs = (
            self.db.query(models.CommissionLog)
            .filter(
                models.CommissionLog.sale_detail_id.in_(detail_ids),
                models.CommissionLog.status == models.CommissionStatus.PENDING,
            )
            .all()
        )
        for log in logs:
            log.status = models.CommissionStatus.VOIDED
            log.voided_at = now
        return len(logs)
