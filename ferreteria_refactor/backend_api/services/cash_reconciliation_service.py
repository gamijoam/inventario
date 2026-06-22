"""
Unified cash-session reconciliation service.

This module is intentionally read-only. It builds one canonical ledger for a
cash session so the close modal, history, Z report and future PDF audit can all
consume the same source of truth.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, Iterable, List, Optional, Tuple

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session, joinedload

from ..models import models

ZERO = Decimal("0.00")
CASH_METHOD_TOKENS = ("efectivo", "cash", "divisa")
DIGITAL_REFERENCE_HINTS = ("abono", "cxc", "cuenta")


class CashReconciliationService:
    """Builds a transaction-level audit report for a cash session."""

    @staticmethod
    def build_session_audit(db: Session, session_id: int) -> Optional[Dict[str, Any]]:
        session = db.query(models.CashSession).options(
            joinedload(models.CashSession.user),
            joinedload(models.CashSession.register),
            joinedload(models.CashSession.currencies),
        ).filter(models.CashSession.id == session_id).first()
        if not session:
            return None

        end_time = session.end_time or datetime.now()
        external_financers = CashReconciliationService._external_financer_names(db)
        currency_records = CashReconciliationService._session_currency_records(session)

        cash_flow = CashReconciliationService._initial_cash_flow(session, currency_records)
        payment_breakdown: Dict[Tuple[str, str], Dict[str, Any]] = {}
        transactions: List[Dict[str, Any]] = []
        alerts: List[Dict[str, Any]] = []

        movements = CashReconciliationService._load_movements(db, session.id)
        debt_payments = CashReconciliationService._load_debt_payments(db, session.id)
        debt_deposit_matches = CashReconciliationService._match_debt_deposits(debt_payments, movements)

        CashReconciliationService._append_sale_payment_transactions(
            db=db,
            session=session,
            end_time=end_time,
            external_financers=external_financers,
            cash_flow=cash_flow,
            payment_breakdown=payment_breakdown,
            transactions=transactions,
            alerts=alerts,
        )
        CashReconciliationService._append_debt_payment_transactions(
            debt_payments=debt_payments,
            debt_deposit_matches=debt_deposit_matches,
            external_financers=external_financers,
            cash_flow=cash_flow,
            payment_breakdown=payment_breakdown,
            transactions=transactions,
            alerts=alerts,
        )
        CashReconciliationService._append_layaway_payment_transactions(
            db=db,
            session=session,
            external_financers=external_financers,
            cash_flow=cash_flow,
            payment_breakdown=payment_breakdown,
            transactions=transactions,
            alerts=alerts,
        )
        CashReconciliationService._append_movement_transactions(
            movements=movements,
            cash_flow=cash_flow,
            payment_breakdown=payment_breakdown,
            transactions=transactions,
            alerts=alerts,
        )
        CashReconciliationService._append_change_transactions(
            db=db,
            session=session,
            end_time=end_time,
            cash_flow=cash_flow,
            transactions=transactions,
        )
        CashReconciliationService._append_purchase_payment_transactions(
            db=db,
            session=session,
            external_financers=external_financers,
            cash_flow=cash_flow,
            payment_breakdown=payment_breakdown,
            transactions=transactions,
        )
        CashReconciliationService._append_service_payment_transactions(
            db=db,
            session=session,
            external_financers=external_financers,
            cash_flow=cash_flow,
            payment_breakdown=payment_breakdown,
            transactions=transactions,
        )

        credit_summary = CashReconciliationService._credit_summary(db, session, end_time)
        purchase_risk = CashReconciliationService._purchase_payment_risk(db, session, end_time)
        service_risk = CashReconciliationService._service_payment_risk(db, session, end_time)
        if purchase_risk["count"]:
            alerts.append({
                "level": "warning",
                "code": "purchase_payments_without_session_link",
                "message": (
                    "Hay pagos de compras/proveedores en el rango de la sesion, "
                    "pero purchase_payments no tiene session_id. Si salieron de caja, "
                    "deben existir como movimiento manual para afectar el arqueo."
                ),
                "count": purchase_risk["count"],
                "totals": purchase_risk["totals_by_currency"],
            })
        if service_risk["count"]:
            alerts.append({
                "level": "warning",
                "code": "service_payments_without_session_link",
                "message": (
                    "Hay pagos de servicios/taller en el rango de la sesion, "
                    "pero service_payments no tiene session_id. Si entraron a caja, "
                    "deben existir como venta o movimiento manual para afectar el arqueo."
                ),
                "count": service_risk["count"],
                "totals": service_risk["totals_by_currency"],
            })

        CashReconciliationService._finalize_cash_flow(cash_flow, currency_records)
        transactions.sort(key=lambda row: (row.get("occurred_at") or datetime.min, row.get("id") or ""))

        return {
            "schema_version": "cash-audit-v1",
            "session": CashReconciliationService._session_payload(session),
            "summary": CashReconciliationService._summary(cash_flow, payment_breakdown, transactions, credit_summary, alerts),
            "cash_by_currency": list(cash_flow.values()),
            "payment_methods": CashReconciliationService._payment_breakdown_list(payment_breakdown),
            "transactions": [CashReconciliationService._json_ready(row) for row in transactions],
            "credits": credit_summary,
            "purchase_payment_risk": purchase_risk,
            "service_payment_risk": service_risk,
            "alerts": alerts,
        }

    @staticmethod
    def _append_sale_payment_transactions(
        db: Session,
        session: models.CashSession,
        end_time: datetime,
        external_financers: set,
        cash_flow: Dict[str, Dict[str, Any]],
        payment_breakdown: Dict[Tuple[str, str], Dict[str, Any]],
        transactions: List[Dict[str, Any]],
        alerts: List[Dict[str, Any]],
    ) -> None:
        payments = db.query(models.SalePayment).join(models.Sale).options(
            joinedload(models.SalePayment.sale)
        ).filter(
            or_(
                models.Sale.session_id == session.id,
                and_(
                    models.Sale.session_id.is_(None),
                    models.Sale.date >= session.start_time,
                    models.Sale.date <= end_time,
                ),
            )
        ).order_by(models.SalePayment.id.asc()).all()

        for payment in payments:
            sale = payment.sale
            method = payment.payment_method or "Sin metodo"
            currency = CashReconciliationService._currency_key(payment.currency)
            amount = CashReconciliationService._decimal(payment.amount)
            is_cash = CashReconciliationService._is_cash_method(method, external_financers)

            CashReconciliationService._add_payment_breakdown(
                payment_breakdown, method, currency, amount, "sale_payment"
            )
            if is_cash:
                CashReconciliationService._add_cash_part(cash_flow, currency, "cash_sales", amount)

            if not payment.reference and not is_cash:
                alerts.append({
                    "level": "info",
                    "code": "digital_payment_without_reference",
                    "message": f"Pago digital sin referencia en venta #{sale.id if sale else payment.sale_id}.",
                    "source_type": "sale_payment",
                    "source_id": payment.id,
                })

            transactions.append({
                "id": f"sale_payment:{payment.id}",
                "occurred_at": payment.payment_date or (sale.date if sale else None),
                "source_type": "sale_payment",
                "source_id": payment.id,
                "reference": f"Venta #{sale.id if sale else payment.sale_id}",
                "description": "Cobro de venta",
                "method": method,
                "currency": currency,
                "exchange_rate": payment.exchange_rate,
                "inflow": amount,
                "outflow": ZERO,
                "affects_cash": is_cash,
                "cash_bucket": "cash_sales" if is_cash else "digital_sales",
                "sale_id": sale.id if sale else payment.sale_id,
                "customer_id": sale.customer_id if sale else None,
            })

    @staticmethod
    def _append_debt_payment_transactions(
        debt_payments: Iterable[models.Payment],
        debt_deposit_matches: Dict[int, str],
        external_financers: set,
        cash_flow: Dict[str, Dict[str, Any]],
        payment_breakdown: Dict[Tuple[str, str], Dict[str, Any]],
        transactions: List[Dict[str, Any]],
        alerts: List[Dict[str, Any]],
    ) -> None:
        for payment in debt_payments:
            method = payment.payment_method or "Sin metodo"
            method_label = f"{method} (Abono CxC)"
            currency = CashReconciliationService._currency_key(payment.currency)
            amount = CashReconciliationService._decimal(payment.amount)
            is_cash = CashReconciliationService._is_cash_method(method, external_financers)
            matched_movement_id = debt_deposit_matches.get(payment.id)
            counted_in_cash = is_cash and not matched_movement_id

            CashReconciliationService._add_payment_breakdown(
                payment_breakdown, method_label, currency, amount, "debt_payment"
            )
            if counted_in_cash:
                CashReconciliationService._add_cash_part(cash_flow, currency, "debt_cash", amount)

            if not counted_in_cash and is_cash and matched_movement_id:
                alerts.append({
                    "level": "info",
                    "code": "debt_payment_counted_by_cash_movement",
                    "message": f"Abono CxC #{payment.id} se refleja en caja por movimiento {matched_movement_id}; no se duplica.",
                    "source_type": "payment",
                    "source_id": payment.id,
                })

            transactions.append({
                "id": f"debt_payment:{payment.id}",
                "occurred_at": payment.date,
                "source_type": "debt_payment",
                "source_id": payment.id,
                "reference": payment.description or f"Abono CxC #{payment.id}",
                "description": "Abono a cuenta por cobrar",
                "method": method,
                "currency": currency,
                "exchange_rate": payment.exchange_rate_used,
                "inflow": amount,
                "outflow": ZERO,
                "affects_cash": counted_in_cash,
                "cash_bucket": "debt_cash" if counted_in_cash else "digital_or_movement_backed_debt",
                "matched_cash_movement_id": matched_movement_id,
                "customer_id": payment.customer_id,
            })

    @staticmethod
    def _append_layaway_payment_transactions(
        db: Session,
        session: models.CashSession,
        external_financers: set,
        cash_flow: Dict[str, Dict[str, Any]],
        payment_breakdown: Dict[Tuple[str, str], Dict[str, Any]],
        transactions: List[Dict[str, Any]],
        alerts: List[Dict[str, Any]],
    ) -> None:
        payments = db.query(models.LayawayPayment).options(
            joinedload(models.LayawayPayment.layaway).joinedload(models.Layaway.customer)
        ).filter(
            models.LayawayPayment.session_id == session.id,
            models.LayawayPayment.status == "APPLIED",
        ).order_by(models.LayawayPayment.created_at.asc(), models.LayawayPayment.id.asc()).all()

        for payment in payments:
            layaway = payment.layaway
            method = payment.payment_method or "Sin metodo"
            method_label = f"{method} (Apartado)"
            currency = CashReconciliationService._currency_key(payment.currency)
            amount = CashReconciliationService._decimal(payment.amount)
            is_cash = CashReconciliationService._is_cash_method(method, external_financers)

            CashReconciliationService._add_payment_breakdown(
                payment_breakdown, method_label, currency, amount, "layaway_payment"
            )
            if is_cash:
                CashReconciliationService._add_cash_part(cash_flow, currency, "layaway_cash", amount)

            if not payment.reference and not is_cash:
                alerts.append({
                    "level": "info",
                    "code": "layaway_payment_without_reference",
                    "message": f"Abono de apartado sin referencia en {layaway.code if layaway else '#' + str(payment.layaway_id)}.",
                    "source_type": "layaway_payment",
                    "source_id": payment.id,
                })

            transactions.append({
                "id": f"layaway_payment:{payment.id}",
                "occurred_at": payment.created_at,
                "source_type": "layaway_payment",
                "source_id": payment.id,
                "reference": f"Apartado {layaway.code}" if layaway else f"Apartado #{payment.layaway_id}",
                "description": "Abono de apartado",
                "method": method,
                "currency": currency,
                "exchange_rate": payment.exchange_rate,
                "inflow": amount,
                "outflow": ZERO,
                "affects_cash": is_cash,
                "cash_bucket": "layaway_cash" if is_cash else "non_cash_layaway_payment",
                "layaway_id": payment.layaway_id,
                "customer_id": layaway.customer_id if layaway else None,
            })

    @staticmethod
    def _append_movement_transactions(
        movements: Iterable[models.CashMovement],
        cash_flow: Dict[str, Dict[str, Any]],
        payment_breakdown: Dict[Tuple[str, str], Dict[str, Any]],
        transactions: List[Dict[str, Any]],
        alerts: List[Dict[str, Any]],
    ) -> None:
        for movement in movements:
            currency = CashReconciliationService._currency_key(movement.currency)
            amount = CashReconciliationService._decimal(movement.amount)
            movement_type = (movement.type or "").upper()
            bucket = CashReconciliationService._movement_bucket(movement_type)
            direction = CashReconciliationService._movement_direction(movement_type)

            if bucket:
                CashReconciliationService._add_cash_part(cash_flow, currency, bucket, amount)

            inflow = amount if direction == "in" else ZERO
            outflow = amount if direction == "out" else ZERO
            transactions.append({
                "id": f"cash_movement:{movement.id}",
                "occurred_at": movement.date,
                "source_type": "cash_movement",
                "source_id": movement.id,
                "reference": f"Movimiento #{movement.id}",
                "description": movement.description or CashReconciliationService._movement_label(movement_type),
                "method": "Caja",
                "currency": currency,
                "exchange_rate": movement.exchange_rate,
                "inflow": inflow,
                "outflow": outflow,
                "affects_cash": bool(bucket),
                "cash_bucket": bucket or "informational",
                "movement_type": movement_type,
            })

            if movement_type == "CASH_ADVANCE" and movement.incoming_amount:
                inc_currency = CashReconciliationService._currency_key(movement.incoming_currency)
                inc_amount = CashReconciliationService._decimal(movement.incoming_amount)
                inc_method = movement.incoming_method or "Ingreso digital avance"
                CashReconciliationService._add_payment_breakdown(
                    payment_breakdown, inc_method, inc_currency, inc_amount, "cash_advance_incoming"
                )
                transactions.append({
                    "id": f"cash_advance_incoming:{movement.id}",
                    "occurred_at": movement.date,
                    "source_type": "cash_advance_incoming",
                    "source_id": movement.id,
                    "reference": movement.incoming_reference or f"Avance #{movement.id}",
                    "description": "Contraparte digital de avance de efectivo",
                    "method": inc_method,
                    "currency": inc_currency,
                    "inflow": inc_amount,
                    "outflow": ZERO,
                    "affects_cash": False,
                    "cash_bucket": "digital_advance_incoming",
                    "linked_cash_movement_id": movement.id,
                })

            if not movement.description:
                alerts.append({
                    "level": "warning",
                    "code": "cash_movement_without_description",
                    "message": f"Movimiento de caja #{movement.id} no tiene descripcion.",
                    "source_type": "cash_movement",
                    "source_id": movement.id,
                })

    @staticmethod
    def _append_change_transactions(
        db: Session,
        session: models.CashSession,
        end_time: datetime,
        cash_flow: Dict[str, Dict[str, Any]],
        transactions: List[Dict[str, Any]],
    ) -> None:
        rows = db.query(models.Sale).filter(
            or_(
                models.Sale.session_id == session.id,
                and_(
                    models.Sale.session_id.is_(None),
                    models.Sale.date >= session.start_time,
                    models.Sale.date <= end_time,
                ),
            ),
            models.Sale.change_amount > 0,
        ).order_by(models.Sale.id.asc()).all()

        for sale in rows:
            currency = CashReconciliationService._currency_key(sale.change_currency)
            amount = CashReconciliationService._decimal(sale.change_amount)
            CashReconciliationService._add_cash_part(cash_flow, currency, "change_given", amount)
            transactions.append({
                "id": f"sale_change:{sale.id}",
                "occurred_at": sale.date,
                "source_type": "sale_change",
                "source_id": sale.id,
                "reference": f"Venta #{sale.id}",
                "description": "Vuelto entregado al cliente",
                "method": "Vuelto",
                "currency": currency,
                "inflow": ZERO,
                "outflow": amount,
                "affects_cash": True,
                "cash_bucket": "change_given",
                "sale_id": sale.id,
            })

    @staticmethod
    def _append_purchase_payment_transactions(
        db: Session,
        session: models.CashSession,
        external_financers: set,
        cash_flow: Dict[str, Dict[str, Any]],
        payment_breakdown: Dict[Tuple[str, str], Dict[str, Any]],
        transactions: List[Dict[str, Any]],
    ) -> None:
        payments = db.query(models.PurchasePayment).options(
            joinedload(models.PurchasePayment.purchase)
        ).filter(models.PurchasePayment.session_id == session.id).order_by(models.PurchasePayment.payment_date.asc(), models.PurchasePayment.id.asc()).all()

        for payment in payments:
            method = payment.payment_method or "Sin metodo"
            method_label = f"{method} (Pago proveedor)"
            currency = CashReconciliationService._currency_key(payment.currency)
            amount = CashReconciliationService._decimal(payment.amount)
            is_cash = CashReconciliationService._is_cash_method(method, external_financers)

            CashReconciliationService._add_payment_breakdown(
                payment_breakdown, method_label, currency, amount, "purchase_payment"
            )
            if is_cash:
                CashReconciliationService._add_cash_part(cash_flow, currency, "purchase_cash", amount)

            transactions.append({
                "id": f"purchase_payment:{payment.id}",
                "occurred_at": payment.payment_date,
                "source_type": "purchase_payment",
                "source_id": payment.id,
                "reference": payment.reference or f"Compra #{payment.purchase_id}",
                "description": "Pago a proveedor",
                "method": method,
                "currency": currency,
                "exchange_rate": payment.exchange_rate,
                "inflow": ZERO,
                "outflow": amount,
                "affects_cash": is_cash,
                "cash_bucket": "purchase_cash" if is_cash else "non_cash_purchase_payment",
                "purchase_id": payment.purchase_id,
                "supplier_id": payment.purchase.supplier_id if payment.purchase else None,
                "warehouse_id": payment.purchase.warehouse_id if payment.purchase else None,
            })

    @staticmethod
    def _append_service_payment_transactions(
        db: Session,
        session: models.CashSession,
        external_financers: set,
        cash_flow: Dict[str, Dict[str, Any]],
        payment_breakdown: Dict[Tuple[str, str], Dict[str, Any]],
        transactions: List[Dict[str, Any]],
    ) -> None:
        payments = db.query(models.ServicePayment).options(
            joinedload(models.ServicePayment.service_order)
        ).filter(models.ServicePayment.session_id == session.id).order_by(models.ServicePayment.created_at.asc(), models.ServicePayment.id.asc()).all()

        for payment in payments:
            method = payment.payment_method or "Sin metodo"
            method_label = f"{method} (Servicio)"
            currency = CashReconciliationService._currency_key(payment.currency)
            amount = CashReconciliationService._decimal(payment.amount)
            is_cash = CashReconciliationService._is_cash_method(method, external_financers)

            CashReconciliationService._add_payment_breakdown(
                payment_breakdown, method_label, currency, amount, "service_payment"
            )
            if is_cash:
                CashReconciliationService._add_cash_part(cash_flow, currency, "service_cash", amount)

            ticket = getattr(payment.service_order, "ticket_number", None) if payment.service_order else None
            transactions.append({
                "id": f"service_payment:{payment.id}",
                "occurred_at": payment.created_at,
                "source_type": "service_payment",
                "source_id": payment.id,
                "reference": ticket or f"Servicio #{payment.service_order_id}",
                "description": "Cobro de servicio/taller",
                "method": method,
                "currency": currency,
                "inflow": amount,
                "outflow": ZERO,
                "affects_cash": is_cash,
                "cash_bucket": "service_cash" if is_cash else "non_cash_service_payment",
                "service_order_id": payment.service_order_id,
                "customer_id": payment.service_order.customer_id if payment.service_order else None,
            })

    @staticmethod
    def _load_movements(db: Session, session_id: int) -> List[models.CashMovement]:
        return db.query(models.CashMovement).filter(
            models.CashMovement.session_id == session_id
        ).order_by(models.CashMovement.date.asc(), models.CashMovement.id.asc()).all()

    @staticmethod
    def _load_debt_payments(db: Session, session_id: int) -> List[models.Payment]:
        return db.query(models.Payment).filter(
            models.Payment.session_id == session_id
        ).order_by(models.Payment.date.asc(), models.Payment.id.asc()).all()

    @staticmethod
    def _match_debt_deposits(debt_payments: Iterable[models.Payment], movements: Iterable[models.CashMovement]) -> Dict[int, str]:
        matches: Dict[int, str] = {}
        deposits = [m for m in movements if (m.type or "").upper() in {"DEPOSIT", "IN"}]
        used_deposits = set()

        for payment in debt_payments:
            payment_amount = CashReconciliationService._decimal(payment.amount)
            payment_currency = CashReconciliationService._currency_key(payment.currency)
            for movement in deposits:
                if movement.id in used_deposits:
                    continue
                if CashReconciliationService._decimal(movement.amount) != payment_amount:
                    continue
                if CashReconciliationService._currency_key(movement.currency) != payment_currency:
                    continue
                description = (movement.description or "").lower()
                if not any(token in description for token in DIGITAL_REFERENCE_HINTS):
                    continue
                matches[payment.id] = f"cash_movement:{movement.id}"
                used_deposits.add(movement.id)
                break
        return matches

    @staticmethod
    def _credit_summary(db: Session, session: models.CashSession, end_time: datetime) -> Dict[str, Any]:
        sales = db.query(models.Sale).filter(
            or_(
                models.Sale.session_id == session.id,
                and_(
                    models.Sale.session_id.is_(None),
                    models.Sale.date >= session.start_time,
                    models.Sale.date <= end_time,
                ),
            ),
            models.Sale.is_credit == True,
        ).all()
        opened_amount = sum((CashReconciliationService._decimal(s.total_amount) for s in sales), ZERO)
        pending_amount = sum((CashReconciliationService._decimal(s.balance_pending) for s in sales if CashReconciliationService._decimal(s.balance_pending) > ZERO), ZERO)
        paid_count = len([s for s in sales if not s.balance_pending or CashReconciliationService._decimal(s.balance_pending) <= ZERO])
        return {
            "opened_count": len(sales),
            "opened_amount": float(opened_amount),
            "pending_count": len(sales) - paid_count,
            "pending_amount": float(pending_amount),
            "paid_count": paid_count,
            "sales": [
                {
                    "sale_id": s.id,
                    "date": s.date.isoformat() if s.date else None,
                    "total_amount": float(CashReconciliationService._decimal(s.total_amount)),
                    "balance_pending": float(CashReconciliationService._decimal(s.balance_pending)),
                    "customer_id": s.customer_id,
                }
                for s in sales
            ],
        }

    @staticmethod
    def _purchase_payment_risk(db: Session, session: models.CashSession, end_time: datetime) -> Dict[str, Any]:
        payments = db.query(models.PurchasePayment).filter(
            models.PurchasePayment.session_id.is_(None),
            models.PurchasePayment.payment_date >= session.start_time,
            models.PurchasePayment.payment_date <= end_time,
        ).all()
        totals = defaultdict(Decimal)
        for payment in payments:
            totals[CashReconciliationService._currency_key(payment.currency)] += CashReconciliationService._decimal(payment.amount)
        return {
            "count": len(payments),
            "totals_by_currency": {currency: float(amount) for currency, amount in totals.items()},
            "note": "PurchasePayment no tiene session_id; no se suma al arqueo salvo que exista CashMovement.",
        }

    @staticmethod
    def _service_payment_risk(db: Session, session: models.CashSession, end_time: datetime) -> Dict[str, Any]:
        payments = db.query(models.ServicePayment).filter(
            models.ServicePayment.session_id.is_(None),
            models.ServicePayment.created_at >= session.start_time,
            models.ServicePayment.created_at <= end_time,
        ).all()
        totals = defaultdict(Decimal)
        for payment in payments:
            totals[CashReconciliationService._currency_key(payment.currency)] += CashReconciliationService._decimal(payment.amount)
        return {
            "count": len(payments),
            "totals_by_currency": {currency: float(amount) for currency, amount in totals.items()},
            "note": "ServicePayment no tiene session_id; se audita como riesgo y no se suma al arqueo.",
        }

    @staticmethod
    def _initial_cash_flow(session: models.CashSession, currency_records: Dict[str, Dict[str, Decimal]]) -> Dict[str, Dict[str, Any]]:
        cash_flow: Dict[str, Dict[str, Any]] = {}
        for currency, record in currency_records.items():
            cash_flow[currency] = CashReconciliationService._empty_currency_row(currency)
            cash_flow[currency]["initial"] = record["initial"]
            cash_flow[currency]["reported"] = record["reported"]

        if "USD" not in cash_flow:
            cash_flow["USD"] = CashReconciliationService._empty_currency_row("USD")
            cash_flow["USD"]["initial"] = CashReconciliationService._decimal(session.initial_cash)
            cash_flow["USD"]["reported"] = CashReconciliationService._decimal(session.final_cash_reported)
        if "Bs" not in cash_flow:
            cash_flow["Bs"] = CashReconciliationService._empty_currency_row("Bs")
            cash_flow["Bs"]["initial"] = CashReconciliationService._decimal(session.initial_cash_bs)
            cash_flow["Bs"]["reported"] = CashReconciliationService._decimal(session.final_cash_reported_bs)

        return cash_flow

    @staticmethod
    def _empty_currency_row(currency: str) -> Dict[str, Any]:
        return {
            "currency": currency,
            "initial": ZERO,
            "cash_sales": ZERO,
            "debt_cash": ZERO,
            "layaway_cash": ZERO,
            "service_cash": ZERO,
            "manual_in": ZERO,
            "manual_out": ZERO,
            "purchase_cash": ZERO,
            "returns": ZERO,
            "cash_advances": ZERO,
            "change_given": ZERO,
            "expected": ZERO,
            "reported": ZERO,
            "difference": ZERO,
        }

    @staticmethod
    def _session_currency_records(session: models.CashSession) -> Dict[str, Dict[str, Decimal]]:
        records = {}
        for currency in session.currencies or []:
            key = CashReconciliationService._currency_key(currency.currency_symbol)
            records[key] = {
                "initial": CashReconciliationService._decimal(currency.initial_amount),
                "reported": CashReconciliationService._decimal(currency.final_reported),
                "expected": CashReconciliationService._decimal(currency.final_expected),
                "difference": CashReconciliationService._decimal(currency.difference),
            }
        return records

    @staticmethod
    def _finalize_cash_flow(cash_flow: Dict[str, Dict[str, Any]], currency_records: Dict[str, Dict[str, Decimal]]) -> None:
        for currency, row in cash_flow.items():
            expected = (
                row["initial"]
                + row["cash_sales"]
                + row["debt_cash"]
                + row["layaway_cash"]
                + row["service_cash"]
                + row["manual_in"]
                - row["manual_out"]
                - row["purchase_cash"]
                - row["returns"]
                - row["cash_advances"]
                - row["change_given"]
            )
            row["expected"] = expected
            if row["reported"] == ZERO and currency in currency_records:
                row["reported"] = currency_records[currency]["reported"]
            row["difference"] = row["reported"] - expected

            for key, value in list(row.items()):
                if isinstance(value, Decimal):
                    row[key] = float(value)

    @staticmethod
    def _summary(
        cash_flow: Dict[str, Dict[str, Any]],
        payment_breakdown: Dict[Tuple[str, str], Dict[str, Any]],
        transactions: List[Dict[str, Any]],
        credit_summary: Dict[str, Any],
        alerts: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        expected_total = sum(Decimal(str(row.get("expected", 0))) for row in cash_flow.values())
        reported_total = sum(Decimal(str(row.get("reported", 0))) for row in cash_flow.values())
        return {
            "transaction_count": len(transactions),
            "payment_method_count": len(payment_breakdown),
            "cash_expected_total_display_only": float(expected_total),
            "cash_reported_total_display_only": float(reported_total),
            "cash_difference_total_display_only": float(reported_total - expected_total),
            "credit_pending_amount": credit_summary.get("pending_amount", 0),
            "credit_pending_count": credit_summary.get("pending_count", 0),
            "alert_count": len(alerts),
        }

    @staticmethod
    def _payment_breakdown_list(payment_breakdown: Dict[Tuple[str, str], Dict[str, Any]]) -> List[Dict[str, Any]]:
        rows = []
        for (method, currency), data in sorted(payment_breakdown.items(), key=lambda item: (item[0][0], item[0][1])):
            rows.append({
                "method": method,
                "currency": currency,
                "amount": float(data["amount"]),
                "count": data["count"],
                "sources": sorted(data["sources"]),
            })
        return rows

    @staticmethod
    def _session_payload(session: models.CashSession) -> Dict[str, Any]:
        return {
            "id": session.id,
            "status": session.status,
            "start_time": session.start_time.isoformat() if session.start_time else None,
            "end_time": session.end_time.isoformat() if session.end_time else None,
            "user": {
                "id": session.user.id,
                "username": session.user.username,
                "full_name": session.user.full_name,
            } if session.user else None,
            "register": {
                "id": session.register.id,
                "code": session.register.code,
                "name": session.register.name,
            } if session.register else None,
        }

    @staticmethod
    def _add_cash_part(cash_flow: Dict[str, Dict[str, Any]], currency: str, bucket: str, amount: Decimal) -> None:
        if currency not in cash_flow:
            cash_flow[currency] = CashReconciliationService._empty_currency_row(currency)
        cash_flow[currency][bucket] += amount

    @staticmethod
    def _add_payment_breakdown(
        payment_breakdown: Dict[Tuple[str, str], Dict[str, Any]],
        method: str,
        currency: str,
        amount: Decimal,
        source: str,
    ) -> None:
        key = (method or "Sin metodo", currency)
        if key not in payment_breakdown:
            payment_breakdown[key] = {"amount": ZERO, "count": 0, "sources": set()}
        payment_breakdown[key]["amount"] += amount
        payment_breakdown[key]["count"] += 1
        payment_breakdown[key]["sources"].add(source)

    @staticmethod
    def _external_financer_names(db: Session) -> set:
        return {
            (method.name or "").strip().lower()
            for method in db.query(models.PaymentMethod).filter(models.PaymentMethod.is_external_financer == True).all()
        }

    @staticmethod
    def _is_cash_method(method: str, external_financers: set) -> bool:
        method_key = (method or "").strip().lower()
        if method_key in external_financers:
            return False
        return any(token in method_key for token in CASH_METHOD_TOKENS)

    @staticmethod
    def _movement_direction(movement_type: str) -> Optional[str]:
        if movement_type in {"DEPOSIT", "IN"}:
            return "in"
        if movement_type in {"EXPENSE", "WITHDRAWAL", "OUT", "RETURN", "CASH_ADVANCE"}:
            return "out"
        return None

    @staticmethod
    def _movement_bucket(movement_type: str) -> Optional[str]:
        if movement_type in {"DEPOSIT", "IN"}:
            return "manual_in"
        if movement_type in {"EXPENSE", "WITHDRAWAL", "OUT"}:
            return "manual_out"
        if movement_type == "RETURN":
            return "returns"
        if movement_type == "CASH_ADVANCE":
            return "cash_advances"
        return None

    @staticmethod
    def _movement_label(movement_type: str) -> str:
        labels = {
            "DEPOSIT": "Entrada manual de caja",
            "IN": "Entrada manual de caja",
            "EXPENSE": "Gasto de caja",
            "WITHDRAWAL": "Retiro de caja",
            "OUT": "Salida manual de caja",
            "RETURN": "Devolucion / reembolso",
            "CASH_ADVANCE": "Avance de efectivo",
        }
        return labels.get(movement_type, "Movimiento de caja")

    @staticmethod
    def _currency_key(value: Optional[str]) -> str:
        curr = (value or "USD").strip()
        if curr.upper() in {"BS", "VES", "VEF"}:
            return "Bs"
        if curr in {"$", ""}:
            return "USD"
        return curr

    @staticmethod
    def _decimal(value: Any) -> Decimal:
        if value is None:
            return ZERO
        if isinstance(value, Decimal):
            return value
        return Decimal(str(value))

    @staticmethod
    def _json_ready(row: Dict[str, Any]) -> Dict[str, Any]:
        result = {}
        for key, value in row.items():
            if isinstance(value, Decimal):
                result[key] = float(value)
            elif isinstance(value, datetime):
                result[key] = value.isoformat()
            else:
                result[key] = value
        return result
