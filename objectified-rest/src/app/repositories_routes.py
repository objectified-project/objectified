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

from fastapi import APIRouter, Body, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from .auth import validate_authentication
from .repositories.manifest import parse_repo_manifest

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


class RepositoryBranchesUpdateRequest(BaseModel):
    branches: List[RepositoryBranchInput] = Field(min_length=1)


class RepositoryEditRequest(BaseModel):
    owner: str | None = None
    name: str | None = None
    manifest: str | None = None


class RepositoryDeleteRequest(BaseModel):
    confirmFullName: str = Field(min_length=1)


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
    status: Literal["healthy", "warnings", "error", "scan_in_progress", "archived"] = "scan_in_progress"
    branches: List[RepositoryBranchRecord]
    manifest: str | None = None
    createdAt: str
    updatedAt: str
    archivedAt: str | None = None
    timeline: List[RepositoryScanTimelineEntry]


class RegisterRepositoryResponse(BaseModel):
    repository: RepositoryRecord
    initialScanJobId: str


_REPO_STORE: Dict[str, Dict[str, RepositoryRecord]] = {}
_REPO_BRANCH_STORE: Dict[str, List[RepositoryBranchRecord]] = {}
_REPO_SCAN_STORE: Dict[str, List[RepositoryScanTimelineEntry]] = {}
_REPO_FILE_STORE: Dict[str, List[Dict[str, Any]]] = {}
_REPO_CREDENTIAL_REF_STORE: Dict[str, List[Dict[str, Any]]] = {}
_REPO_AUDIT_STORE: List[Dict[str, Any]] = []
_STORE_LOCK = Lock()


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _validate_uuid(raw: str, field_name: str) -> None:
    try:
        UUID(raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"{field_name} must be a valid UUID") from exc


def _normalize_branch(record: RepositoryBranchInput) -> RepositoryBranchRecord:
    stripped_subpath = record.subpathGlob.strip() if record.subpathGlob else ""
    normalized_subpath = stripped_subpath if stripped_subpath else "**/*"
    return RepositoryBranchRecord(
        branch=record.branch.strip(),
        subpathGlob=normalized_subpath,
        pollIntervalSec=record.pollIntervalSec,
    )


def _normalize_branches(branches: List[RepositoryBranchInput]) -> List[RepositoryBranchRecord]:
    normalized_branches = [_normalize_branch(branch) for branch in branches]
    if any(not branch.branch for branch in normalized_branches):
        raise HTTPException(status_code=400, detail="branches[].branch is required")
    dedupe_key_count = len({branch.branch for branch in normalized_branches})
    if dedupe_key_count != len(normalized_branches):
        raise HTTPException(status_code=400, detail="branches[].branch must be unique")
    return normalized_branches


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


def _write_audit_row(tenant_id: str, repository_id: str, event_type: Literal["repository.archived", "repository.unarchived", "repository.removed"]) -> None:
    _REPO_AUDIT_STORE.append(
        {
            "id": str(uuid4()),
            "tenantId": tenant_id,
            "repositoryId": repository_id,
            "eventType": event_type,
            "createdAt": _utc_now_iso(),
        }
    )


def _list_poll_targets_for_tenant(tenant_id: str) -> List[Dict[str, str]]:
    poll_targets: List[Dict[str, str]] = []
    for repository in _REPO_STORE.get(tenant_id, {}).values():
        if repository.status == "archived":
            continue
        for branch in _REPO_BRANCH_STORE.get(repository.id, repository.branches):
            poll_targets.append({"repositoryId": repository.id, "branch": branch.branch})
    return poll_targets


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

    normalized_branches = _normalize_branches(request.branches)

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

    manifest_outcome = parse_repo_manifest(request.manifest)
    initial_file_rows: List[Dict[str, Any]] = []
    if manifest_outcome.manifest_error_row is not None:
        row = manifest_outcome.manifest_error_row
        initial_file_rows.append(
            {
                "path": row.path,
                "format": row.format,
                "tracked": row.tracked,
                "pollIntervalSec": row.poll_interval_sec,
                "status": row.status,
                "metadata": row.metadata,
            }
        )

    with _STORE_LOCK:
        tenant_repos = _REPO_STORE.setdefault(tenant_id, {})
        _REPO_BRANCH_STORE[repository.id] = list(normalized_branches)
        _REPO_SCAN_STORE[repository.id] = [timeline_entry]
        _REPO_FILE_STORE[repository.id] = initial_file_rows
        _REPO_CREDENTIAL_REF_STORE[repository.id] = [{"linkedAccountId": request.linkedAccountId}]
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


@router.patch("/{tenant_slug}/{repository_id}/branches", response_model=RepositoryRecord)
async def update_repository_branches(
    tenant_slug: str,
    repository_id: str,
    request: RepositoryBranchesUpdateRequest,
    auth_data: Dict[str, Any] = Depends(validate_authentication),
) -> RepositoryRecord:
    tenant_id = auth_data["tenant_id"]
    normalized_branches = _normalize_branches(request.branches)

    with _STORE_LOCK:
        repository = _REPO_STORE.get(tenant_id, {}).get(repository_id)
        if repository is None:
            raise HTTPException(status_code=404, detail=f"Repository not found: {repository_id}")
        _REPO_BRANCH_STORE[repository.id] = list(normalized_branches)
        repository.branches = list(normalized_branches)
        repository.updatedAt = _utc_now_iso()
        return repository


@router.patch("/{tenant_slug}/{repository_id}", response_model=RepositoryRecord)
async def edit_repository(
    tenant_slug: str,
    repository_id: str,
    request: RepositoryEditRequest,
    auth_data: Dict[str, Any] = Depends(validate_authentication),
) -> RepositoryRecord:
    tenant_id = auth_data["tenant_id"]
    if request.owner is None and request.name is None and request.manifest is None:
        raise HTTPException(status_code=400, detail="At least one editable field is required")

    with _STORE_LOCK:
        repository = _REPO_STORE.get(tenant_id, {}).get(repository_id)
        if repository is None:
            raise HTTPException(status_code=404, detail=f"Repository not found: {repository_id}")

        if request.owner is not None:
            owner = request.owner.strip()
            if not owner:
                raise HTTPException(status_code=400, detail="owner must not be empty")
            repository.owner = owner

        if request.name is not None:
            name = request.name.strip()
            if not name:
                raise HTTPException(status_code=400, detail="name must not be empty")
            repository.name = name

        if request.owner is not None or request.name is not None:
            repository.fullName = f"{repository.owner}/{repository.name}"

        if request.manifest is not None:
            repository.manifest = request.manifest

        repository.updatedAt = _utc_now_iso()
        return repository


@router.post("/{tenant_slug}/{repository_id}/archive", response_model=RepositoryRecord)
async def archive_repository(
    tenant_slug: str,
    repository_id: str,
    auth_data: Dict[str, Any] = Depends(validate_authentication),
) -> RepositoryRecord:
    tenant_id = auth_data["tenant_id"]
    with _STORE_LOCK:
        repository = _REPO_STORE.get(tenant_id, {}).get(repository_id)
        if repository is None:
            raise HTTPException(status_code=404, detail=f"Repository not found: {repository_id}")

        now = _utc_now_iso()
        repository.status = "archived"
        repository.archivedAt = now
        repository.updatedAt = now
        _write_audit_row(tenant_id, repository_id, "repository.archived")
        return repository


@router.post("/{tenant_slug}/{repository_id}/unarchive", response_model=RepositoryRecord)
async def unarchive_repository(
    tenant_slug: str,
    repository_id: str,
    auth_data: Dict[str, Any] = Depends(validate_authentication),
) -> RepositoryRecord:
    tenant_id = auth_data["tenant_id"]
    with _STORE_LOCK:
        repository = _REPO_STORE.get(tenant_id, {}).get(repository_id)
        if repository is None:
            raise HTTPException(status_code=404, detail=f"Repository not found: {repository_id}")

        repository.status = "healthy"
        repository.archivedAt = None
        repository.updatedAt = _utc_now_iso()
        _write_audit_row(tenant_id, repository_id, "repository.unarchived")
        return repository


@router.delete("/{tenant_slug}/{repository_id}", status_code=204)
async def delete_repository(
    tenant_slug: str,
    repository_id: str,
    request: RepositoryDeleteRequest = Body(...),
    auth_data: Dict[str, Any] = Depends(validate_authentication),
) -> Response:
    tenant_id = auth_data["tenant_id"]
    with _STORE_LOCK:
        tenant_repos = _REPO_STORE.get(tenant_id, {})
        repository = tenant_repos.get(repository_id)
        if repository is None:
            raise HTTPException(status_code=404, detail=f"Repository not found: {repository_id}")
        if request.confirmFullName.strip() != repository.fullName:
            raise HTTPException(status_code=400, detail="confirmFullName must match repository fullName")

        tenant_repos.pop(repository_id, None)
        _REPO_BRANCH_STORE.pop(repository_id, None)
        _REPO_SCAN_STORE.pop(repository_id, None)
        _REPO_FILE_STORE.pop(repository_id, None)
        _REPO_CREDENTIAL_REF_STORE.pop(repository_id, None)
        _write_audit_row(tenant_id, repository_id, "repository.removed")

    return Response(status_code=204)


def _reset_repository_state_for_tests() -> None:
    with _STORE_LOCK:
        _REPO_STORE.clear()
        _REPO_BRANCH_STORE.clear()
        _REPO_SCAN_STORE.clear()
        _REPO_FILE_STORE.clear()
        _REPO_CREDENTIAL_REF_STORE.clear()
        _REPO_AUDIT_STORE.clear()


def _seed_repository_relations_for_tests(repository_id: str) -> None:
    with _STORE_LOCK:
        _REPO_SCAN_STORE[repository_id] = [RepositoryScanTimelineEntry(id=str(uuid4()), type="scan", status="completed", message="done", createdAt=_utc_now_iso())]
        _REPO_FILE_STORE[repository_id] = [{"path": "README.md"}]
        _REPO_CREDENTIAL_REF_STORE[repository_id] = [{"linkedAccountId": str(uuid4())}]


def _get_repository_audit_rows_for_tests(repository_id: str) -> List[Dict[str, Any]]:
    with _STORE_LOCK:
        return [row for row in _REPO_AUDIT_STORE if row["repositoryId"] == repository_id]


def _get_repository_relations_exist_for_tests(repository_id: str) -> Dict[str, bool]:
    with _STORE_LOCK:
        return {
            "repository_branch": repository_id in _REPO_BRANCH_STORE,
            "repository_scan": repository_id in _REPO_SCAN_STORE,
            "repository_file": repository_id in _REPO_FILE_STORE,
            "repository_credential_ref": repository_id in _REPO_CREDENTIAL_REF_STORE,
        }


def _list_poll_targets_for_tests(tenant_id: str) -> List[Dict[str, str]]:
    with _STORE_LOCK:
        return _list_poll_targets_for_tenant(tenant_id)
