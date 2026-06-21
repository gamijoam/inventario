from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from ..models import models


def resolve_current_cash_session(db: Session, current_user: models.User) -> Optional[models.CashSession]:
    """Resolve a safe cash session for money flows outside POS.

    Prefer the authenticated user's open session. If the tenant only has one
    open session, use it as a compatibility fallback. If several sessions are
    open and none belongs to the user, return None instead of guessing.
    """
    if not current_user:
        return None

    user_session = db.query(models.CashSession).filter(
        models.CashSession.status == "OPEN",
        models.CashSession.user_id == current_user.id,
    ).order_by(models.CashSession.start_time.desc()).first()
    if user_session:
        return user_session

    open_sessions = db.query(models.CashSession).filter(
        models.CashSession.status == "OPEN",
    ).order_by(models.CashSession.start_time.desc()).limit(2).all()
    if len(open_sessions) == 1:
        return open_sessions[0]

    return None
