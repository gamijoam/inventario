"""
Accounting ledger service.

Phase 1 is intentionally additive: it can materialize operational events into a
central tenant ledger without changing the current POS, cash closing or report
flows. Later phases can make reports read from this table once it has enough
coverage and backfill tooling.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, Iterable, List, Optional

from sqlalchemy.orm import Session

from ..models import models
from .cash_reconciliation_service import CashReconciliationService

ZERO = Decimal("0.0000")
ANCHOR_CURRENCY = "USD"

ACCOUNT_BY_BUCKET = {
    "cash_sales": ("cash.sales", "Cobros de ventas en efectivo"),
    "debt_cash": ("cash.accounts_receivable_payment", "Abonos CxC en efectivo"),
    "layaway_cash": ("cash.layaway_payment", "Abonos de apartados en efectivo"),
    "manual_in": ("cash.manual_in", "Entradas manuales de caja"),
    "manual_out": ("cash.manual_out", "Salidas manuales de caja"),
    "returns": ("cash.return_refund", "Reembolsos y devoluciones"),
    "cash_advances": ("cash.advance", "Avances de efectivo"),
    "change_given": ("cash.change_given", "Vuelto entregado"),
    "purchase_cash": ("cash.purchase_payment", "Pagos a proveedores en efectivo"),
    "service_cash": ("cash.service_payment", "Cobros de servicios en efectivo"),
    "external_financing_cash": ("cash.external_financing_payment", "Pagos recibidos de financiadoras"),
    "non_cash_external_financing_payment": ("receivable.external_financing_payment", "Pagos de financiadoras no ingresados a caja"),
}

EVENT_BY_SOURCE = {
    "sale_payment": "sale.collected",
    "debt_payment": "receivable.payment_collected",
    "layaway_payment": "layaway.payment_collected",
    "cash_movement": "cash.manual_movement",
    "cash_advance_incoming": "cash.advance_counterpart",
    "sale_change": "sale.change_given",
    "purchase_payment": "purchase.payment_made",
    "service_payment": "service.payment_collected",
    "external_financing_payment": "external_financing.payment_received",
}


class AccountingLedgerService:
    """Materializes normalized accounting events for tenant reports."""

    @staticmethod
    def rebuild_cash_session(db: Session, session_id: int, *, commit: bool = True) -> Dict[str, Any]:
        report = CashReconciliationService.build_session_audit(db, session_id)
        if not report:
            return {"ok": False, "reason": "cash_session_not_found", "created": 0, "updated": 0}

        session_payload = report.get("session") or {}
        register_payload = session_payload.get("register") or {}
        user_payload = session_payload.get("user") or {}
        existing_deleted = db.query(models.AccountingLedgerEntry).filter(
            models.AccountingLedgerEntry.session_id == session_id
        ).delete(synchronize_session=False)

        created = 0
        updated = 0
        entries = []

        for entry in AccountingLedgerService._entries_from_cash_session_balances(
            report=report,
            session_id=session_id,
            register_id=register_payload.get("id"),
            user_id=user_payload.get("id"),
        ):
            result = AccountingLedgerService.upsert_entry(db, entry, commit=False)
            if result == "created":
                created += 1
            else:
                updated += 1
            entries.append(entry)

        for transaction in report.get("transactions") or []:
            entry = AccountingLedgerService._entry_from_cash_transaction(
                transaction=transaction,
                session_id=session_id,
                register_id=register_payload.get("id"),
                user_id=user_payload.get("id"),
            )
            if not entry:
                continue
            result = AccountingLedgerService.upsert_entry(db, entry, commit=False)
            if result == "created":
                created += 1
            else:
                updated += 1
            entries.append(entry)

        if commit:
            db.commit()

        return {
            "ok": True,
            "session_id": session_id,
            "created": created,
            "updated": updated,
            "deleted": existing_deleted,
            "entries": len(entries),
        }

    @staticmethod
    def upsert_entry(db: Session, payload: Dict[str, Any], *, commit: bool = True) -> str:
        key = payload["idempotency_key"]
        existing = db.query(models.AccountingLedgerEntry).filter(
            models.AccountingLedgerEntry.idempotency_key == key
        ).first()
        if existing:
            for field, value in payload.items():
                setattr(existing, field if field != "metadata" else "payload", value)
            existing.updated_at = datetime.now()
            if commit:
                db.commit()
            return "updated"

        row_payload = dict(payload)
        metadata_payload = row_payload.pop("metadata", None)
        row = models.AccountingLedgerEntry(**row_payload)
        if metadata_payload is not None:
            row.payload = metadata_payload
        db.add(row)
        if commit:
            db.commit()
        return "created"

    @staticmethod
    def cash_session_summary(db: Session, session_id: int) -> Dict[str, Any]:
        rows = db.query(models.AccountingLedgerEntry).filter(
            models.AccountingLedgerEntry.session_id == session_id,
            models.AccountingLedgerEntry.affects_cash == True,
            models.AccountingLedgerEntry.is_voided == False,
        ).all()
        summary: Dict[str, Dict[str, Decimal]] = defaultdict(lambda: {"in": ZERO, "out": ZERO, "net": ZERO})
        for row in rows:
            currency = AccountingLedgerService.currency_key(row.currency)
            amount = AccountingLedgerService.decimal(row.amount)
            if row.direction == "out":
                summary[currency]["out"] += amount
                summary[currency]["net"] -= amount
            elif row.direction == "in":
                summary[currency]["in"] += amount
                summary[currency]["net"] += amount

        return {
            currency: {key: AccountingLedgerService.money(value) for key, value in totals.items()}
            for currency, totals in sorted(summary.items())
        }

    @staticmethod
    def _entries_from_cash_session_balances(
        *,
        report: Dict[str, Any],
        session_id: int,
        register_id: Optional[int],
        user_id: Optional[int],
    ) -> List[Dict[str, Any]]:
        session_payload = report.get("session") or {}
        start_time = AccountingLedgerService.parse_datetime(session_payload.get("start_time")) or datetime.now()
        end_time = AccountingLedgerService.parse_datetime(session_payload.get("end_time"))
        entries: List[Dict[str, Any]] = []

        for row in report.get("cash_by_currency") or []:
            currency = AccountingLedgerService.currency_key(row.get("currency"))
            initial = AccountingLedgerService.decimal(row.get("initial"))
            reported_value = row.get("reported")
            reported = None if reported_value is None else AccountingLedgerService.decimal(reported_value)
            reported_for_ledger = None if reported is None else max(reported, ZERO)
            difference = AccountingLedgerService.decimal(row.get("difference"))

            if initial > 0:
                entries.append(AccountingLedgerService._cash_session_balance_entry(
                    session_id=session_id,
                    register_id=register_id,
                    user_id=user_id,
                    occurred_at=start_time,
                    source_type="cash_session_opening",
                    event_type="cash_session.opened",
                    account_code="cash.opening_float",
                    account_name="Saldo inicial de caja",
                    source_ref=f"Apertura caja #{session_id}",
                    direction="in",
                    currency=currency,
                    amount=initial,
                    affects_cash=True,
                    metadata={"cash_row": row},
                ))

            if reported is not None:
                entries.append(AccountingLedgerService._cash_session_balance_entry(
                    session_id=session_id,
                    register_id=register_id,
                    user_id=user_id,
                    occurred_at=end_time or datetime.now(),
                    source_type="cash_session_closing_count",
                    event_type="cash_session.closed",
                    account_code="cash.reported_count",
                    account_name="Conteo declarado al cierre",
                    source_ref=f"Cierre caja #{session_id}",
                    direction="neutral",
                    currency=currency,
                    amount=reported_for_ledger,
                    affects_cash=False,
                    metadata={"cash_row": row, "reported_original": AccountingLedgerService.json_safe(reported)},
                ))

            if difference != 0:
                entries.append(AccountingLedgerService._cash_session_balance_entry(
                    session_id=session_id,
                    register_id=register_id,
                    user_id=user_id,
                    occurred_at=end_time or datetime.now(),
                    source_type="cash_session_difference",
                    event_type="cash_session.difference_detected",
                    account_code="cash.over_short",
                    account_name="Diferencia de arqueo",
                    source_ref=f"Diferencia caja #{session_id}",
                    direction="in" if difference > 0 else "out",
                    currency=currency,
                    amount=abs(difference),
                    affects_cash=False,
                    metadata={"cash_row": row},
                ))

        return entries

    @staticmethod
    def _cash_session_balance_entry(
        *,
        session_id: int,
        register_id: Optional[int],
        user_id: Optional[int],
        occurred_at: datetime,
        source_type: str,
        event_type: str,
        account_code: str,
        account_name: str,
        source_ref: str,
        direction: str,
        currency: str,
        amount: Decimal,
        affects_cash: bool,
        metadata: Dict[str, Any],
    ) -> Dict[str, Any]:
        exchange_rate = Decimal("1")
        return {
            "idempotency_key": AccountingLedgerService.idempotency_key(
                source_type=source_type,
                source_id=session_id,
                source_line_id=None,
                event_type=event_type,
                account_code=account_code,
                currency=currency,
                direction=direction,
            ),
            "occurred_at": occurred_at,
            "source_type": source_type,
            "source_id": session_id,
            "source_ref": source_ref,
            "event_type": event_type,
            "direction": direction,
            "account_code": account_code,
            "account_name": account_name,
            "currency": currency,
            "amount": AccountingLedgerService.money(amount),
            "exchange_rate": exchange_rate,
            "anchor_currency": ANCHOR_CURRENCY,
            "amount_anchor": AccountingLedgerService.to_anchor(amount, currency, exchange_rate),
            "payment_method": "Caja",
            "session_id": session_id,
            "register_id": register_id,
            "user_id": user_id,
            "affects_cash": affects_cash,
            "metadata": AccountingLedgerService.json_safe(metadata),
        }

    @staticmethod
    def _entry_from_cash_transaction(
        *,
        transaction: Dict[str, Any],
        session_id: int,
        register_id: Optional[int],
        user_id: Optional[int],
    ) -> Optional[Dict[str, Any]]:
        source_type = transaction.get("source_type") or "unknown"
        source_id = transaction.get("source_id")
        cash_bucket = transaction.get("cash_bucket") or "informational"
        currency = AccountingLedgerService.currency_key(transaction.get("currency"))
        inflow = AccountingLedgerService.decimal(transaction.get("inflow"))
        outflow = AccountingLedgerService.decimal(transaction.get("outflow"))
        amount = inflow if inflow > 0 else outflow
        if amount <= 0:
            return None

        direction = "in" if inflow > 0 else "out"
        account_code, account_name = ACCOUNT_BY_BUCKET.get(
            cash_bucket,
            (f"operational.{cash_bucket}", transaction.get("description") or cash_bucket),
        )
        exchange_rate = AccountingLedgerService.decimal(transaction.get("exchange_rate") or 1) or Decimal("1")
        occurred_at = AccountingLedgerService.parse_datetime(transaction.get("occurred_at")) or datetime.now()
        source_ref = transaction.get("reference") or transaction.get("id")
        source_line_id = transaction.get("linked_cash_movement_id")
        idempotency_key = AccountingLedgerService.idempotency_key(
            source_type=source_type,
            source_id=source_id,
            source_line_id=source_line_id,
            event_type=EVENT_BY_SOURCE.get(source_type, "operational.event"),
            account_code=account_code,
            currency=currency,
            direction=direction,
        )

        return {
            "idempotency_key": idempotency_key,
            "occurred_at": occurred_at,
            "source_type": source_type,
            "source_id": source_id,
            "source_line_id": source_line_id,
            "source_ref": str(source_ref)[:160] if source_ref else None,
            "event_type": EVENT_BY_SOURCE.get(source_type, "operational.event"),
            "direction": direction,
            "account_code": account_code,
            "account_name": account_name,
            "currency": currency,
            "amount": amount,
            "exchange_rate": exchange_rate,
            "anchor_currency": ANCHOR_CURRENCY,
            "amount_anchor": AccountingLedgerService.to_anchor(amount, currency, exchange_rate),
            "payment_method": transaction.get("method"),
            "session_id": session_id,
            "register_id": register_id,
            "user_id": user_id,
            "customer_id": transaction.get("customer_id"),
            "supplier_id": transaction.get("supplier_id"),
            "warehouse_id": transaction.get("warehouse_id"),
            "affects_cash": bool(transaction.get("affects_cash")),
            "affects_accounts_receivable": source_type in {"debt_payment", "external_financing_payment"},
            "affects_accounts_payable": source_type == "purchase_payment",
            "metadata": AccountingLedgerService.json_safe(transaction),
        }

    @staticmethod
    def idempotency_key(
        *,
        source_type: str,
        source_id: Any,
        source_line_id: Any,
        event_type: str,
        account_code: str,
        currency: str,
        direction: str,
    ) -> str:
        parts = [source_type, source_id or 0, source_line_id or 0, event_type, account_code, currency, direction]
        return ":".join(str(part) for part in parts)

    @staticmethod
    def to_anchor(amount: Decimal, currency: str, exchange_rate: Decimal) -> Decimal:
        currency_key = AccountingLedgerService.currency_key(currency)
        if currency_key == "USD":
            return AccountingLedgerService.money(amount)
        if currency_key in {"Bs", "VES"} and exchange_rate and exchange_rate > 0:
            return AccountingLedgerService.money(amount / exchange_rate)
        return AccountingLedgerService.money(amount)

    @staticmethod
    def currency_key(value: Any) -> str:
        curr = str(value or "USD").strip()
        if curr.upper() in {"BS", "VES", "VEF"}:
            return "Bs"
        if curr in {"$", ""}:
            return "USD"
        return curr

    @staticmethod
    def decimal(value: Any) -> Decimal:
        if value is None or value == "":
            return ZERO
        if isinstance(value, Decimal):
            return value
        return Decimal(str(value))

    @staticmethod
    def money(value: Decimal) -> Decimal:
        return AccountingLedgerService.decimal(value).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

    @staticmethod
    def parse_datetime(value: Any) -> Optional[datetime]:
        if isinstance(value, datetime):
            return value
        if isinstance(value, str) and value:
            try:
                return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
            except ValueError:
                return None
        return None

    @staticmethod
    def json_safe(value: Any) -> Any:
        if isinstance(value, Decimal):
            return float(value)
        if isinstance(value, datetime):
            return value.isoformat()
        if isinstance(value, dict):
            return {key: AccountingLedgerService.json_safe(item) for key, item in value.items()}
        if isinstance(value, list):
            return [AccountingLedgerService.json_safe(item) for item in value]
        return value
