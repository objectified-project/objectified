"""
Draft revision edit locks — acquire, renew, release, admin force-release (#2584).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.responses import Response

from .auth import get_authenticated_user_id, validate_authentication
from .database import db
from .models import (
    VersionDraftLockAcquireRequest,
    VersionDraftLockRenewRequest,
    VersionDraftLockResponse,
)

router = APIRouter(prefix="/v1/versions", tags=["versions"])

_DEFAULT_DRAFT_LOCK_LEASE_SECONDS = 900


def _lease_seconds(req: Optional[VersionDraftLockAcquireRequest]) -> int:
    if req is None or req.lease_seconds is None:
        return _DEFAULT_DRAFT_LOCK_LEASE_SECONDS
    return int(req.lease_seconds)


def _renew_lease_seconds(req: Optional[VersionDraftLockRenewRequest]) -> int:
    if req is None or req.lease_seconds is None:
        return _DEFAULT_DRAFT_LOCK_LEASE_SECONDS
    return int(req.lease_seconds)


def _expires_iso(expires_at: Any) -> str:
    if expires_at is None:
        return ""
    if isinstance(expires_at, datetime):
        exp = expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        return exp.isoformat().replace("+00:00", "Z")
    return str(expires_at)


def _conflict_http(owner_user_id: str, expires_at: Any) -> HTTPException:
    return HTTPException(
        status_code=409,
        detail={
            "code": "DRAFT_LOCK_CONFLICT",
            "ownerUserId": owner_user_id,
            "expiresAt": _expires_iso(expires_at),
        },
    )


def _require_jwt_user(auth_data: Dict[str, Any]) -> str:
    uid = get_authenticated_user_id(auth_data)
    if not uid:
        raise HTTPException(
            status_code=403,
            detail="Draft lock actions require a signed-in user (JWT); API keys cannot hold edit locks.",
        )
    return uid


@router.post(
    "/{tenant_slug}/{project_id}/{version_record_id}/draft-lock/acquire",
    response_model=VersionDraftLockResponse,
)
async def acquire_draft_lock(
    tenant_slug: str,
    project_id: str,
    version_record_id: str,
    body: Optional[VersionDraftLockAcquireRequest] = Body(None),
    auth_data: Dict[str, Any] = Depends(validate_authentication),
) -> VersionDraftLockResponse:
    """
    Acquire or refresh an edit lock on an **unpublished** (draft) revision.

    Returns **409** with ``code: DRAFT_LOCK_CONFLICT`` and ``ownerUserId`` / ``expiresAt`` when
    another user holds an active lock.
    """
    _ = tenant_slug
    tenant_id = auth_data["tenant_id"]
    user_id = _require_jwt_user(auth_data)
    lease = _lease_seconds(body)

    try:
        result = db.acquire_version_draft_lock(
            tenant_id, project_id, version_record_id, user_id, lease
        )
    except ValueError as ve:
        code = str(ve)
        if code == "version_not_found":
            raise HTTPException(status_code=404, detail="Version not found") from ve
        if code == "published_version":
            raise HTTPException(
                status_code=400,
                detail="Draft locks apply only to unpublished revisions.",
            ) from ve
        raise HTTPException(status_code=500, detail=str(ve)) from ve

    if result.get("kind") == "conflict":
        raise _conflict_http(result["owner_user_id"], result["expires_at"])

    return VersionDraftLockResponse(
        version_id=result["version_id"],
        owner_user_id=result["owner_user_id"],
        expires_at=result["expires_at"],
    )


@router.post(
    "/{tenant_slug}/{project_id}/{version_record_id}/draft-lock/renew",
    response_model=VersionDraftLockResponse,
)
async def renew_draft_lock(
    tenant_slug: str,
    project_id: str,
    version_record_id: str,
    body: Optional[VersionDraftLockRenewRequest] = Body(None),
    auth_data: Dict[str, Any] = Depends(validate_authentication),
) -> VersionDraftLockResponse:
    """Extend the lease on an active lock held by the current user."""
    _ = tenant_slug
    tenant_id = auth_data["tenant_id"]
    user_id = _require_jwt_user(auth_data)
    lease = _renew_lease_seconds(body)

    try:
        result = db.renew_version_draft_lock(
            tenant_id, project_id, version_record_id, user_id, lease
        )
    except ValueError as ve:
        code = str(ve)
        if code == "version_not_found":
            raise HTTPException(status_code=404, detail="Version not found") from ve
        if code == "published_version":
            raise HTTPException(
                status_code=400,
                detail="Draft locks apply only to unpublished revisions.",
            ) from ve
        raise HTTPException(status_code=500, detail=str(ve)) from ve

    if result.get("kind") == "not_held":
        raise HTTPException(
            status_code=409,
            detail={
                "code": "DRAFT_LOCK_NOT_HELD",
                "message": "No active lock to renew; call acquire first.",
            },
        )
    if result.get("kind") == "conflict":
        raise _conflict_http(result["owner_user_id"], result["expires_at"])

    return VersionDraftLockResponse(
        version_id=result["version_id"],
        owner_user_id=result["owner_user_id"],
        expires_at=result["expires_at"],
    )


@router.post("/{tenant_slug}/{project_id}/{version_record_id}/draft-lock/release")
async def release_draft_lock(
    tenant_slug: str,
    project_id: str,
    version_record_id: str,
    auth_data: Dict[str, Any] = Depends(validate_authentication),
) -> Response:
    """Release the current user's lock. Idempotent when no lock exists (**204**)."""
    _ = tenant_slug
    tenant_id = auth_data["tenant_id"]
    user_id = _require_jwt_user(auth_data)

    try:
        outcome = db.release_version_draft_lock(
            tenant_id, project_id, version_record_id, user_id
        )
    except ValueError as ve:
        if str(ve) == "version_not_found":
            raise HTTPException(status_code=404, detail="Version not found") from ve
        raise HTTPException(status_code=500, detail=str(ve)) from ve

    if outcome == "forbidden":
        raise HTTPException(
            status_code=403,
            detail="Cannot release a lock held by another user.",
        )

    return Response(status_code=204)


@router.post("/{tenant_slug}/{project_id}/{version_record_id}/draft-lock/force-release")
async def force_release_draft_lock(
    tenant_slug: str,
    project_id: str,
    version_record_id: str,
    auth_data: Dict[str, Any] = Depends(validate_authentication),
) -> Response:
    """Remove any lock on the revision (**tenant administrators** only)."""
    _ = tenant_slug
    tenant_id = auth_data["tenant_id"]
    uid = _require_jwt_user(auth_data)
    if not db.is_user_tenant_admin(tenant_id, uid):
        raise HTTPException(
            status_code=403,
            detail="Only tenant administrators may force-release a draft lock.",
        )

    try:
        db.force_release_version_draft_lock(tenant_id, project_id, version_record_id)
    except ValueError as ve:
        if str(ve) == "version_not_found":
            raise HTTPException(status_code=404, detail="Version not found") from ve
        raise HTTPException(status_code=500, detail=str(ve)) from ve

    return Response(status_code=204)
