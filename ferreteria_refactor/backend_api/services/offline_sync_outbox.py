"""Durable event queue for desktop/offline synchronization.

The business transaction remains the source of truth. This module writes a small
JSON event in the same tenant transaction after the business row was flushed. If
the offline-sync tables are not present yet, it quietly skips the write so a code
deploy cannot break selling before the migration is applied.
"""

from __future__ import annotations

import json
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from ..tenant_context import get_tenant_schema


SYNC_OUTBOX_TABLE = "sync_outbox"


def _safe_schema_name(schema: Optional[str]) -> Optional[str]:
    if not schema:
        return None
    if not schema.replace("_", "").isalnum() or schema[0].isdigit():
        return None
    return schema


def _json_default(value: Any):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, uuid.UUID):
        return str(value)
    return str(value)


def _event_uuid(seed: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"miinventario:{seed}"))


def _table_exists(db: Session, schema: str, table_name: str) -> bool:
    return bool(
        db.execute(
            text(
                """
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = :schema
                  AND table_name = :table_name
                LIMIT 1
                """
            ),
            {"schema": schema, "table_name": table_name},
        ).scalar()
    )


def enqueue_sync_event(
    db: Session,
    *,
    event_type: str,
    aggregate_type: Optional[str] = None,
    aggregate_uuid: Optional[str] = None,
    payload: Optional[dict[str, Any]] = None,
    source_terminal_id: Optional[str] = None,
    cash_session_uuid: Optional[str] = None,
    event_uuid: Optional[str] = None,
) -> bool:
    schema = _safe_schema_name(get_tenant_schema() or "public")
    if not schema:
        return False

    try:
        if not _table_exists(db, schema, SYNC_OUTBOX_TABLE):
            return False

        resolved_uuid = event_uuid or _event_uuid(f"{schema}:{event_type}:{aggregate_uuid or uuid.uuid4()}")
        resolved_payload = json.dumps(payload or {}, default=_json_default, ensure_ascii=False)
        db.execute(
            text(
                f'''
                INSERT INTO "{schema}".sync_outbox (
                    event_uuid,
                    event_type,
                    aggregate_type,
                    aggregate_uuid,
                    source_terminal_id,
                    cash_session_uuid,
                    payload,
                    status,
                    created_at,
                    updated_at
                ) VALUES (
                    :event_uuid,
                    :event_type,
                    :aggregate_type,
                    :aggregate_uuid,
                    :source_terminal_id,
                    :cash_session_uuid,
                    CAST(:payload AS jsonb),
                    'PENDING',
                    NOW(),
                    NOW()
                )
                ON CONFLICT (event_uuid) DO UPDATE SET
                    payload = EXCLUDED.payload,
                    updated_at = NOW()
                '''
            ),
            {
                "event_uuid": resolved_uuid,
                "event_type": event_type,
                "aggregate_type": aggregate_type,
                "aggregate_uuid": aggregate_uuid,
                "source_terminal_id": source_terminal_id,
                "cash_session_uuid": cash_session_uuid,
                "payload": resolved_payload,
            },
        )
        return True
    except Exception as exc:
        # Do not block business operations because the sync queue is auxiliary.
        print(f"[offline-sync] event enqueue skipped: {exc}")
        return False


def cash_session_uuid(session_id: Optional[int]) -> Optional[str]:
    if not session_id:
        return None
    return _event_uuid(f"cash-session:{session_id}")
