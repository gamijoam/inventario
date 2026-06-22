import csv
from datetime import date, datetime, time, timedelta
from io import StringIO
from decimal import Decimal
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from ..database.db import get_db
from ..dependencies import get_current_active_user, require_permission
from ..models import models
from ..services.accounting_ledger_service import AccountingLedgerService

router = APIRouter(prefix="/accounting", tags=["Contabilidad"])


def _date_start(value: Optional[date]) -> Optional[datetime]:
    return datetime.combine(value, time.min) if value else None


def _date_end(value: Optional[date]) -> Optional[datetime]:
    return datetime.combine(value + timedelta(days=1), time.min) if value else None


def _to_float(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
    return float(value)


def _ledger_row(row: models.AccountingLedgerEntry) -> Dict[str, Any]:
    return {
        "id": row.id,
        "idempotency_key": row.idempotency_key,
        "occurred_at": row.occurred_at.isoformat() if row.occurred_at else None,
        "posted_at": row.posted_at.isoformat() if row.posted_at else None,
        "source_type": row.source_type,
        "source_id": row.source_id,
        "source_line_id": row.source_line_id,
        "source_ref": row.source_ref,
        "event_type": row.event_type,
        "direction": row.direction,
        "account_code": row.account_code,
        "account_name": row.account_name,
        "currency": row.currency,
        "amount": _to_float(row.amount),
        "exchange_rate": _to_float(row.exchange_rate),
        "anchor_currency": row.anchor_currency,
        "amount_anchor": _to_float(row.amount_anchor),
        "payment_method": row.payment_method,
        "session_id": row.session_id,
        "register_id": row.register_id,
        "user_id": row.user_id,
        "customer_id": row.customer_id,
        "supplier_id": row.supplier_id,
        "warehouse_id": row.warehouse_id,
        "affects_cash": row.affects_cash,
        "affects_bank": row.affects_bank,
        "affects_accounts_receivable": row.affects_accounts_receivable,
        "affects_accounts_payable": row.affects_accounts_payable,
        "is_voided": row.is_voided,
        "metadata": row.payload or {},
    }


def _base_query(db: Session):
    return db.query(models.AccountingLedgerEntry).filter(
        models.AccountingLedgerEntry.is_voided == False
    )


def _apply_ledger_filters(
    query,
    *,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    session_id: Optional[int] = None,
    register_id: Optional[int] = None,
    account_code: Optional[str] = None,
    currency: Optional[str] = None,
    source_type: Optional[str] = None,
    affects_cash: Optional[bool] = None,
):
    start_dt = _date_start(start_date)
    end_dt = _date_end(end_date)
    if start_dt:
        query = query.filter(models.AccountingLedgerEntry.occurred_at >= start_dt)
    if end_dt:
        query = query.filter(models.AccountingLedgerEntry.occurred_at < end_dt)
    if session_id is not None:
        query = query.filter(models.AccountingLedgerEntry.session_id == session_id)
    if register_id is not None:
        query = query.filter(models.AccountingLedgerEntry.register_id == register_id)
    if account_code:
        query = query.filter(models.AccountingLedgerEntry.account_code == account_code)
    if currency:
        query = query.filter(models.AccountingLedgerEntry.currency == AccountingLedgerService.currency_key(currency))
    if source_type:
        query = query.filter(models.AccountingLedgerEntry.source_type == source_type)
    if affects_cash is not None:
        query = query.filter(models.AccountingLedgerEntry.affects_cash == affects_cash)
    return query


@router.get("/ledger", dependencies=[Depends(require_permission("accounting.ledger.view"))])
def list_ledger_entries(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    session_id: Optional[int] = Query(None),
    register_id: Optional[int] = Query(None),
    account_code: Optional[str] = Query(None),
    currency: Optional[str] = Query(None),
    source_type: Optional[str] = Query(None),
    affects_cash: Optional[bool] = Query(None),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    query = _apply_ledger_filters(
        _base_query(db),
        start_date=start_date,
        end_date=end_date,
        session_id=session_id,
        register_id=register_id,
        account_code=account_code,
        currency=currency,
        source_type=source_type,
        affects_cash=affects_cash,
    )

    total = query.count()
    rows = query.order_by(
        models.AccountingLedgerEntry.occurred_at.desc(),
        models.AccountingLedgerEntry.id.desc(),
    ).offset(offset).limit(limit).all()

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": [_ledger_row(row) for row in rows],
    }


@router.get("/summary", dependencies=[Depends(require_permission("accounting.ledger.view"))])
def get_ledger_summary(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    session_id: Optional[int] = Query(None),
    register_id: Optional[int] = Query(None),
    affects_cash: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    query = _apply_ledger_filters(
        _base_query(db),
        start_date=start_date,
        end_date=end_date,
        session_id=session_id,
        register_id=register_id,
        affects_cash=affects_cash,
    )

    movement_amount = func.sum(
        case(
            (models.AccountingLedgerEntry.direction.in_(["in", "out"]), models.AccountingLedgerEntry.amount),
            else_=0,
        )
    )
    neutral_amount = func.sum(
        case(
            (models.AccountingLedgerEntry.direction == "neutral", models.AccountingLedgerEntry.amount),
            else_=0,
        )
    )
    signed_amount = func.sum(
        case(
            (models.AccountingLedgerEntry.direction == "in", models.AccountingLedgerEntry.amount),
            (models.AccountingLedgerEntry.direction == "out", -models.AccountingLedgerEntry.amount),
            else_=0,
        )
    )
    rows = query.with_entities(
        models.AccountingLedgerEntry.account_code,
        models.AccountingLedgerEntry.account_name,
        models.AccountingLedgerEntry.currency,
        func.count(models.AccountingLedgerEntry.id).label("count"),
        movement_amount.label("gross_amount"),
        neutral_amount.label("neutral_amount"),
        signed_amount.label("net_amount"),
    ).group_by(
        models.AccountingLedgerEntry.account_code,
        models.AccountingLedgerEntry.account_name,
        models.AccountingLedgerEntry.currency,
    ).order_by(
        models.AccountingLedgerEntry.account_code.asc(),
        models.AccountingLedgerEntry.currency.asc(),
    ).all()

    by_currency: Dict[str, Dict[str, float]] = {}
    accounts: List[Dict[str, Any]] = []
    for row in rows:
        currency_key = row.currency or "USD"
        by_currency.setdefault(currency_key, {"gross_amount": 0.0, "neutral_amount": 0.0, "net_amount": 0.0, "count": 0})
        by_currency[currency_key]["gross_amount"] += _to_float(row.gross_amount)
        by_currency[currency_key]["neutral_amount"] += _to_float(row.neutral_amount)
        by_currency[currency_key]["net_amount"] += _to_float(row.net_amount)
        by_currency[currency_key]["count"] += int(row.count or 0)
        accounts.append({
            "account_code": row.account_code,
            "account_name": row.account_name,
            "currency": currency_key,
            "count": int(row.count or 0),
            "gross_amount": _to_float(row.gross_amount),
            "neutral_amount": _to_float(row.neutral_amount),
            "net_amount": _to_float(row.net_amount),
        })

    return {
        "filters": {
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": end_date.isoformat() if end_date else None,
            "session_id": session_id,
            "register_id": register_id,
            "affects_cash": affects_cash,
        },
        "by_currency": by_currency,
        "accounts": accounts,
    }


@router.get("/export.csv", dependencies=[Depends(require_permission("accounting.ledger.export"))])
def export_ledger_csv(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    session_id: Optional[int] = Query(None),
    register_id: Optional[int] = Query(None),
    account_code: Optional[str] = Query(None),
    currency: Optional[str] = Query(None),
    source_type: Optional[str] = Query(None),
    affects_cash: Optional[bool] = Query(None),
    limit: int = Query(10000, ge=1, le=50000),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    query = _apply_ledger_filters(
        _base_query(db),
        start_date=start_date,
        end_date=end_date,
        session_id=session_id,
        register_id=register_id,
        account_code=account_code,
        currency=currency,
        source_type=source_type,
        affects_cash=affects_cash,
    ).order_by(models.AccountingLedgerEntry.occurred_at.asc(), models.AccountingLedgerEntry.id.asc()).limit(limit)

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id",
        "fecha",
        "origen",
        "origen_id",
        "referencia",
        "evento",
        "direccion",
        "cuenta_codigo",
        "cuenta_nombre",
        "moneda",
        "monto",
        "tasa",
        "moneda_base",
        "monto_base",
        "metodo_pago",
        "sesion_id",
        "caja_id",
        "usuario_id",
        "cliente_id",
        "proveedor_id",
        "afecta_caja",
        "afecta_cxc",
        "afecta_cxp",
    ])
    for row in query.all():
        writer.writerow([
            row.id,
            row.occurred_at.isoformat() if row.occurred_at else "",
            row.source_type,
            row.source_id or "",
            row.source_ref or "",
            row.event_type,
            row.direction,
            row.account_code,
            row.account_name or "",
            row.currency,
            row.amount,
            row.exchange_rate,
            row.anchor_currency,
            row.amount_anchor,
            row.payment_method or "",
            row.session_id or "",
            row.register_id or "",
            row.user_id or "",
            row.customer_id or "",
            row.supplier_id or "",
            "si" if row.affects_cash else "no",
            "si" if row.affects_accounts_receivable else "no",
            "si" if row.affects_accounts_payable else "no",
        ])

    filename_parts = ["libro-contable"]
    if start_date:
        filename_parts.append(start_date.isoformat())
    if end_date:
        filename_parts.append(end_date.isoformat())
    if session_id:
        filename_parts.append(f"sesion-{session_id}")
    filename = "-".join(filename_parts) + ".csv"
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/sessions/{session_id}/summary", dependencies=[Depends(require_permission("accounting.ledger.view"))])
def get_cash_session_ledger_summary(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    session = db.query(models.CashSession.id).filter(models.CashSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesion de caja no encontrada")
    return AccountingLedgerService.cash_session_summary(db, session_id)


@router.post("/sessions/{session_id}/rebuild", dependencies=[Depends(require_permission("accounting.ledger.rebuild"))])
def rebuild_cash_session_ledger(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    result = AccountingLedgerService.rebuild_cash_session(db, session_id)
    if not result.get("ok"):
        raise HTTPException(status_code=404, detail="Sesion de caja no encontrada")
    return result
