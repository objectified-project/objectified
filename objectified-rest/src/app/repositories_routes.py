"""
Repository registration endpoints (REPO-1.4).

Provides tenant-scoped endpoints to register source-code repositories and
trigger an initial scan job.
"""

from __future__ import annotations

from datetime import datetime, timezone
from threading import Lock
from typing import Any, Dict, List, Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .auth import validate_authentication

router = APIRouter(prefix="/v1/repositories", tags=["repositories"])


class RepositoryBranchInput(BaseModel):
    branch: str = Field(min_length=1)
    subpathGlob: str | None = None
    pollIntervalSec: int | None = Field(default=None, ge=15, le=86400)


class RepositoryRegisterRequest(BaseModel):
    linkedAccountId: str
    provider: Literal["github"]
    owner: str = Field(min_length=1)
    name: str = Field(min_length=1)
    branches: List[RepositoryBranchInput] = Field(min_length=1)
    manifest: str | None = None


class RepositoryScanTimelineEntry(BaseModel):
    id: str
    type: Literal["scan"]
    status: Literal["in_progress", "completed", "failed"]
    message: str
    createdAt: str


class RepositoryBranchRecord(BaseModel):
    branch: str
    subpathGlob: str | None = None
    pollIntervalSec: int | None = None


class RepositoryRecord(BaseModel):
    id: str
    tenantId: str
    linkedAccountId: str
    provider: Literal["github"]
    owner: str
    name: str
    fullName: str
    status: Literal["healthy", "warnings", "error", "scan_in_progress"] = "scan_in_progress"
    branches: List[RepositoryBranchRecord]
    manifest: str | None = None
    createdAt: str
    updatedAt: str
    timeline: List[RepositoryScanTimelineEntry]


class RegisterRepositoryResponse(BaseModel):
    repository: RepositoryRecord
    initialScanJobId: str


_REPO_STORE: Dict[str, Dict[str, RepositoryRecord]] = {}
_STORE_LOCK = Lock()


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _validate_uuid(raw: str, field_name: str) -> None:
    try:
        UUID(raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"{field_name} must be a valid UUID") from exc


def _normalize_branch(record: RepositoryBranchInput) -> RepositoryBranchRecord:
    return RepositoryBranchRecord(
        branch=record.branch.strip(),
        subpathGlob=record.subpathGlob.strip() if record.subpathGlob else None,
        pollIntervalSec=record.pollIntervalSec,
    )


def _to_summary(repo: RepositoryRecord) -> Dict[str, Any]:
    return {
        "id": repo.id,
        "provider": repo.provider,
        "owner": repo.owner,
        "name": repo.name,
        "fullName": repo.fullName,
        "status": repo.status,
        "branches": [b.branch for b in repo.branches],
        "createdAt": repo.createdAt,
        "updatedAt": repo.updatedAt,
    }


@router.post("/{tenant_slug}", status_code=201, response_model=RegisterRepositoryResponse)
async def register_repository(
    tenant_slug: str,
    request: RepositoryRegisterRequest,
    auth_data: Dict[str, Any] = Depends(validate_authentication),
) -> RegisterRepositoryResponse:
    tenant_id = auth_data["tenant_id"]

    _validate_uuid(request.linkedAccountId, "linkedAccountId")
    owner = request.owner.strip()
    name = request.name.strip()
    if not owner or not name:
        raise HTTPException(status_code=400, detail="owner and name are required")

    normalized_branches = [_normalize_branch(branch) for branch in request.branches]
    if any(not b.branch for b in normalized_branches):
        raise HTTPException(status_code=400, detail="branches[].branch is required")

    now = _utc_now_iso()
    repository_id = str(uuid4())
    initial_scan_job_id = str(uuid4())
    timeline_entry = RepositoryScanTimelineEntry(
        id=str(uuid4()),
        type="scan",
        status="in_progress",
        message="Scan in progress...",
        createdAt=now,
    )
    repository = RepositoryRecord(
        id=repository_id,
        tenantId=tenant_id,
        linkedAccountId=request.linkedAccountId,
        provider="github",
        owner=owner,
        name=name,
        fullName=f"{owner}/{name}",
        status="scan_in_progress",
        branches=normalized_branches,
        manifest=request.manifest,
        createdAt=now,
        updatedAt=now,
        timeline=[timeline_entry],
    )

    with _STORE_LOCK:
        tenant_repos = _REPO_STORE.setdefault(tenant_id, {})
        tenant_repos[repository.id] = repository

    return RegisterRepositoryResponse(
        repository=repository,
        initialScanJobId=initial_scan_job_id,
    )


@router.get("/{tenant_slug}")
async def list_repositories(
    tenant_slug: str,
    auth_data: Dict[str, Any] = Depends(validate_authentication),
) -> Dict[str, List[Dict[str, Any]]]:
    tenant_id = auth_data["tenant_id"]
    with _STORE_LOCK:
        tenant_repos = list(_REPO_STORE.get(tenant_id, {}).values())
    tenant_repos.sort(key=lambda repo: repo.updatedAt, reverse=True)
    return {"repositories": [_to_summary(repo) for repo in tenant_repos]}


@router.get("/{tenant_slug}/{repository_id}", response_model=RepositoryRecord)
async def get_repository(
    tenant_slug: str,
    repository_id: str,
    auth_data: Dict[str, Any] = Depends(validate_authentication),
) -> RepositoryRecord:
    tenant_id = auth_data["tenant_id"]
    with _STORE_LOCK:
        repository = _REPO_STORE.get(tenant_id, {}).get(repository_id)
    if repository is None:
        raise HTTPException(status_code=404, detail=f"Repository not found: {repository_id}")
    return repository
