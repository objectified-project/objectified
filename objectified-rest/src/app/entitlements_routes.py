"""
Entitlement checks for product surfaces (Developer Mode, etc.).
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException

from .auth import validate_session_credentials
from .database import db

router = APIRouter(prefix="/v1/entitlements", tags=["entitlements"])


def _effective_user_id(session: Dict[str, Any]) -> Optional[str]:
    if session.get("auth_method") == "jwt":
        uid = session.get("user_id")
        return str(uid) if uid else None
    if session.get("auth_method") == "api_key":
        uid = session.get("user_id")
        if uid:
            return str(uid)
        tid = session.get("tenant_id")
        if tid:
            return db.get_fallback_creator_user_id_for_tenant(str(tid))
    return None


@router.get("/developer-mode")
async def get_developer_mode_entitlement(
    session: Dict[str, Any] = Depends(validate_session_credentials),
) -> Dict[str, Any]:
    """
    Returns whether the current principal may use Developer Mode (Pro / paid license).

    JWT: the signed-in user. API key: ``created_by_user_id`` for the key, or tenant fallback creator.
    """
    user_id = _effective_user_id(session)
    if not user_id:
        raise HTTPException(status_code=401, detail="Missing user identifier for entitlement check")

    row = db.get_user_entitlements_row(user_id)
    plan_code = (row or {}).get("plan_code")
    allowed = db.is_developer_mode_entitled(user_id, row)
    return {
        "allowed": allowed,
        "planCode": str(plan_code) if plan_code is not None else None,
    }
