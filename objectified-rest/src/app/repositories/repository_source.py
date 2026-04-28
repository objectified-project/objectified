"""
REPO-8.2 / REPO-12.3: validate JSON provenance tuples stored on ``odb.versions.repository_source``.
"""

from __future__ import annotations

import re
from typing import Any
from uuid import UUID, RFC_4122

_COMMIT_SHA_RE = re.compile(r"^[0-9a-f]{40,64}$")
_CHECKSUM_RE = re.compile(r"^[0-9a-f]{64}$")
_ISO_8601_TS_RE = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$"
)


def _normalize_uuid(raw: Any) -> str | None:
    if not isinstance(raw, str):
        return None
    candidate = raw.strip().lower()
    if not candidate:
        return None
    try:
        parsed = UUID(candidate)
        if parsed.variant != RFC_4122:
            return None
        if parsed.version not in (1, 2, 3, 4, 5):
            return None
        return str(parsed)
    except ValueError:
        return None


def _normalize_non_empty_str(raw: Any, *, max_length: int, field_name: str) -> tuple[str | None, str | None]:
    if not isinstance(raw, str):
        return None, f"{field_name} must be a string"
    value = raw.strip()
    if not value:
        return None, f"{field_name} must not be empty"
    if len(value) > max_length:
        return None, f"{field_name} exceeds max length {max_length}"
    return value, None


def validate_repository_source_payload(payload: Any) -> tuple[dict[str, str] | None, str | None]:
    """
    Validate metadata.repositorySource / versions.repository_source payload against REPO-8.2 constraints.
    Returns normalized payload on success (camelCase keys matching DB CHECK constraint).
    """
    if not isinstance(payload, dict):
        return None, "repositorySource must be a JSON object"

    required = {
        "repositoryId",
        "branch",
        "path",
        "commitSha",
        "contentChecksum",
        "contentAlgo",
        "importedAt",
    }
    missing = sorted(key for key in required if key not in payload)
    if missing:
        return None, f"repositorySource missing required fields: {', '.join(missing)}"

    repository_id = _normalize_uuid(payload.get("repositoryId"))
    if repository_id is None:
        return None, "repositoryId must be a valid UUID"

    branch, branch_error = _normalize_non_empty_str(payload.get("branch"), max_length=256, field_name="branch")
    if branch_error:
        return None, branch_error

    path, path_error = _normalize_non_empty_str(payload.get("path"), max_length=1024, field_name="path")
    if path_error:
        return None, path_error

    commit_sha, commit_error = _normalize_non_empty_str(payload.get("commitSha"), max_length=64, field_name="commitSha")
    if commit_error:
        return None, commit_error
    commit_sha = commit_sha.lower()
    if not _COMMIT_SHA_RE.fullmatch(commit_sha):
        return None, "commitSha must be a 40-64 char lowercase hex string"

    checksum, checksum_error = _normalize_non_empty_str(
        payload.get("contentChecksum"), max_length=64, field_name="contentChecksum"
    )
    if checksum_error:
        return None, checksum_error
    checksum = checksum.lower()
    if not _CHECKSUM_RE.fullmatch(checksum):
        return None, "contentChecksum must be a 64-char lowercase hex string"

    algo, algo_error = _normalize_non_empty_str(payload.get("contentAlgo"), max_length=16, field_name="contentAlgo")
    if algo_error:
        return None, algo_error
    algo = algo.lower()
    if algo != "sha256":
        return None, "contentAlgo must be 'sha256'"

    imported_at, imported_at_error = _normalize_non_empty_str(
        payload.get("importedAt"), max_length=64, field_name="importedAt"
    )
    if imported_at_error:
        return None, imported_at_error
    if not _ISO_8601_TS_RE.fullmatch(imported_at):
        return None, "importedAt must be an ISO 8601 timestamp string"

    normalized = {
        "repositoryId": repository_id,
        "branch": branch,
        "path": path,
        "commitSha": commit_sha,
        "contentChecksum": checksum,
        "contentAlgo": algo,
        "importedAt": imported_at,
    }
    return normalized, None
