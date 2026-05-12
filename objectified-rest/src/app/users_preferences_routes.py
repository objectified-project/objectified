"""
Current-user preferences (session-scoped, JWT-only writes).
"""

from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from .auth import validate_session_credentials
from .database import db

router = APIRouter(prefix="/v1/users", tags=["users"])


class UserPreferencesPatch(BaseModel):
    """Subset of keys accepted on PUT; extend as new preferences ship."""

    model_config = ConfigDict(populate_by_name=True)

    developer_mode_enabled: bool | None = Field(default=None, alias="developerModeEnabled")


def _effective_user_id(session: Dict[str, Any]) -> str:
    if session.get("auth_method") == "jwt":
        uid = session.get("user_id")
        if not uid:
            raise HTTPException(status_code=401, detail="Missing user identifier")
        return str(uid)
    if session.get("auth_method") == "api_key":
        uid = session.get("user_id")
        if uid:
            return str(uid)
        tid = session.get("tenant_id")
        if tid:
            fb = db.get_fallback_creator_user_id_for_tenant(str(tid))
            if fb:
                return str(fb)
        raise HTTPException(status_code=401, detail="Missing user identifier for API key session")
    raise HTTPException(status_code=401, detail="Missing session")


def _require_jwt_user_id(session: Dict[str, Any]) -> str:
    if session.get("auth_method") != "jwt":
        raise HTTPException(
            status_code=403,
            detail="Updating user preferences requires a browser session (JWT).",
        )
    uid = session.get("user_id")
    if not uid:
        raise HTTPException(status_code=401, detail="Missing user identifier")
    return str(uid)


@router.get("/me/preferences")
async def get_my_preferences(
    session: Dict[str, Any] = Depends(validate_session_credentials),
) -> Dict[str, Any]:
    user_id = _effective_user_id(session)
    prefs = db.get_user_preferences(user_id)
    return {"preferences": prefs}


@router.put("/me/preferences")
async def put_my_preferences(
    body: UserPreferencesPatch,
    session: Dict[str, Any] = Depends(validate_session_credentials),
) -> Dict[str, Any]:
    user_id = _require_jwt_user_id(session)
    patch: Dict[str, Any] = body.model_dump(by_alias=True, exclude_none=True)
    if not patch:
        raise HTTPException(status_code=400, detail="No preference fields supplied")

    if patch.get("developerModeEnabled") is True and not db.is_developer_mode_entitled(user_id):
        raise HTTPException(
            status_code=403,
            detail="Developer Mode requires an eligible plan. Upgrade to enable this preference.",
        )

    try:
        merged = db.merge_user_preferences(user_id, patch)
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")

    return {"preferences": merged}
