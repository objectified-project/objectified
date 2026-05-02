"""Internal routes for MCP API key resolution (#2824)."""

from __future__ import annotations

import secrets
from typing import Any, Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from .config import settings
from .database import db
from .mcp_redis import publish_mcp_key_revoked

router = APIRouter(prefix="/v1/internal", tags=["internal"])


class ApiKeyResolveRequest(BaseModel):
    token: str = Field(min_length=1)
    purpose: Literal["mcp", "rest"] = "mcp"


def _require_internal_secret(x_secret: Optional[str]) -> None:
    expected = settings.internal_api_secret
    if not expected:
        raise HTTPException(status_code=503, detail="Internal API secret is not configured")
    if not x_secret or not secrets.compare_digest(x_secret, expected):
        raise HTTPException(status_code=403, detail="Forbidden")


@router.post("/api_keys/resolve")
async def resolve_api_key(
    body: ApiKeyResolveRequest,
    x_objectified_internal_secret: Optional[str] = Header(None, alias="X-Objectified-Internal-Secret"),
) -> dict[str, Any]:
    """
    Resolve an API key for MCP or REST surfaces (called only by objectified-mcp or trusted services).
    """
    _require_internal_secret(x_objectified_internal_secret)
    return db.resolve_api_key_token(body.token, body.purpose)


class ApiKeyRevokedBroadcastRequest(BaseModel):
    key_id: UUID


@router.post("/api_keys/revoked-broadcast")
async def broadcast_api_key_revoked(
    body: ApiKeyRevokedBroadcastRequest,
    x_objectified_internal_secret: Optional[str] = Header(None, alias="X-Objectified-Internal-Secret"),
) -> dict[str, bool]:
    """
    Publish key_id on Redis channel ``mcp.key.revoked`` so MCP servers evict cached sessions.
    Call after revocation when the DB row is already disabled or soft-deleted.
    """
    _require_internal_secret(x_objectified_internal_secret)
    publish_mcp_key_revoked(str(body.key_id))
    return {"ok": True}
