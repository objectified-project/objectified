"""
Tenant Git repositories: list and register (dashboard).

POST requires JWT so we can verify linked GitHub accounts via ``external_auth_providers``.
"""

from __future__ import annotations

import uuid
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from psycopg2 import errors as pg_errors

from .auth import get_authenticated_user_id, validate_authentication
from .database import db
from .models import (
    TenantRepositoryCreate,
    TenantRepositoryCreateResponse,
    TenantRepositoryGetResponse,
    TenantRepositoryRecord,
    TenantRepositoriesListResponse,
)
from .repository_validation import (
    fetch_github_repo_with_token,
    normalize_clone_url_for_dedup,
    parse_github_owner_repo_from_url,
    parse_owner_repo_slash,
    validate_public_clone_url,
)

router = APIRouter(prefix="/v1/tenants", tags=["tenant-repositories"])


def _ts(value: Any) -> Optional[str]:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()  # type: ignore[no-any-return]
    return str(value)


def _row_to_record(row: Dict[str, Any]) -> TenantRepositoryRecord:
    full = (row.get("repository_full_name") or "").strip()
    name = full.rsplit("/", 1)[-1] if full else "repository"
    if not name:
        name = "repository"
    return TenantRepositoryRecord(
        id=str(row["id"]),
        name=name,
        full_name=full or str(row.get("clone_url") or ""),
        description=row.get("description"),
        provider=str(row.get("provider") or "github"),
        default_branch=str(row.get("default_branch") or "main"),
        visibility=str(row["visibility"]) if row.get("visibility") is not None else None,
        status=str(row.get("status") or "pending"),
        clone_url=str(row["clone_url"]) if row.get("clone_url") else None,
        source=str(row["source"]) if row.get("source") else None,
        last_scanned_at=None,
        total_files=None,
        importable_count=None,
        created_at=_ts(row.get("created_at")),
        updated_at=_ts(row.get("updated_at")),
    )


def _require_jwt_user(auth_data: Dict[str, Any]) -> str:
    uid = get_authenticated_user_id(auth_data)
    if not uid:
        raise HTTPException(
            status_code=403,
            detail="JWT authentication is required to register repositories",
        )
    return str(uid)


@router.get("/{tenant_slug}/repositories", response_model=TenantRepositoriesListResponse)
async def list_tenant_repositories(
    tenant_slug: str,
    auth_data: Dict[str, Any] = Depends(validate_authentication),
) -> TenantRepositoriesListResponse:
    _ = tenant_slug
    tenant_id = str(auth_data["tenant_id"])
    rows = db.list_tenant_repositories(tenant_id)
    return TenantRepositoriesListResponse(
        success=True,
        repositories=[_row_to_record(r) for r in rows],
    )


@router.get(
    "/{tenant_slug}/repositories/{repository_id}",
    response_model=TenantRepositoryGetResponse,
)
async def get_tenant_repository(
    tenant_slug: str,
    repository_id: uuid.UUID,
    auth_data: Dict[str, Any] = Depends(validate_authentication),
) -> TenantRepositoryGetResponse:
    _ = tenant_slug
    tenant_id = str(auth_data["tenant_id"])
    row = db.get_tenant_repository(tenant_id, str(repository_id))
    if not row:
        raise HTTPException(status_code=404, detail="repository not found")
    return TenantRepositoryGetResponse(success=True, repository=_row_to_record(row))


@router.post("/{tenant_slug}/repositories", response_model=TenantRepositoryCreateResponse)
async def create_tenant_repository(
    tenant_slug: str,
    body: TenantRepositoryCreate,
    auth_data: Dict[str, Any] = Depends(validate_authentication),
) -> TenantRepositoryCreateResponse:
    _ = tenant_slug
    tenant_id = str(auth_data["tenant_id"])
    user_id = _require_jwt_user(auth_data)

    if body.source == "public_url":
        requested_clone = str(body.clone_url).strip()
        try:
            meta = validate_public_clone_url(requested_clone)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        canonical_clone = str(meta.get("canonical_clone_url") or requested_clone).strip()
    else:
        linked_id = str(body.linked_account_id).strip()
        full_name_raw = str(body.repository_full_name).strip()
        parts = parse_owner_repo_slash(full_name_raw)
        if not parts:
            raise HTTPException(
                status_code=400,
                detail="repository_full_name must be owner/repo",
            )
        owner, repo = parts

        row_oauth = db.get_external_auth_provider_for_user(linked_id, user_id)
        if not row_oauth:
            raise HTTPException(status_code=404, detail="linked account not found for this user")
        provider = str(row_oauth.get("provider") or "").lower()
        if provider != "github":
            raise HTTPException(
                status_code=400,
                detail="linked repository registration is only supported for GitHub in this release",
            )
        token = row_oauth.get("access_token")
        if not token:
            raise HTTPException(status_code=401, detail="no access token for linked account; re-link GitHub")

        try:
            meta = fetch_github_repo_with_token(str(token), owner, repo)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        api_full = str(meta.get("repository_full_name") or "")
        if api_full.lower() != full_name_raw.lower():
            raise HTTPException(
                status_code=400,
                detail="repository_full_name does not match GitHub metadata for this token",
            )

        canonical_clone = str(meta.get("canonical_clone_url") or "").strip()
        if not canonical_clone:
            raise HTTPException(status_code=500, detail="GitHub response missing clone URL")

        if body.clone_url and str(body.clone_url).strip():
            req_clone = str(body.clone_url).strip()
            req_parts = parse_github_owner_repo_from_url(req_clone)
            can_parts = parse_github_owner_repo_from_url(canonical_clone)
            if req_parts and can_parts and req_parts != can_parts:
                raise HTTPException(
                    status_code=400,
                    detail="clone_url does not match the selected GitHub repository",
                )

    try:
        normalized = normalize_clone_url_for_dedup(canonical_clone)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    description = meta.get("description")
    desc_str = str(description).strip() if description is not None else None
    if desc_str == "":
        desc_str = None

    visibility = meta.get("visibility")
    vis_str = str(visibility) if visibility is not None else None

    try:
        inserted = db.insert_tenant_repository(
            tenant_id=tenant_id,
            source=body.source,
            provider=str(meta.get("provider") or "github"),
            clone_url=canonical_clone,
            clone_url_normalized=normalized,
            repository_full_name=meta.get("repository_full_name"),
            description=desc_str,
            default_branch=str(meta.get("default_branch") or "main"),
            visibility=vis_str,
            status="pending",
            created_by=user_id,
        )
    except pg_errors.UniqueViolation as exc:
        raise HTTPException(
            status_code=409,
            detail="this repository is already registered for this tenant",
        ) from exc

    record = _row_to_record(inserted)
    return TenantRepositoryCreateResponse(success=True, repository=record)
