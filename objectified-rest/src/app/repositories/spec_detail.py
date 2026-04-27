"""
Spec detail drawer helpers (REPO-9.6).

Pure helpers for the spec-detail drawer endpoints:

- ``MAX_INLINE_PREVIEW_BYTES``: 2 MB cap on inline file content (issue #2940
  acceptance criterion: files larger than 2 MB must surface a download
  prompt instead of an inline preview).
- ``derive_lint_summary``: best-effort derivation of error/warning/info
  counts from an import-job record. The dispatcher does not yet emit
  an explicit lint output, so the summary is synthesized from existing
  signals (terminal failure state, conflict records, breaking-vs-additive
  change-report counts).
- ``provider_blob_url`` / ``provider_raw_url``: provider-specific
  deep-link builders. GitHub is currently the only supported provider;
  extending to GitLab/Bitbucket means adding a branch here.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, Mapping
from urllib.parse import quote


MAX_INLINE_PREVIEW_BYTES: int = 2 * 1024 * 1024


@dataclass(frozen=True)
class LintSummary:
    errors: int
    warnings: int
    info: int
    sourceImportJobId: str | None
    derivedFrom: str

    def to_payload(self) -> Dict[str, Any]:
        return {
            "errors": self.errors,
            "warnings": self.warnings,
            "info": self.info,
            "sourceImportJobId": self.sourceImportJobId,
            "derivedFrom": self.derivedFrom,
        }


def empty_lint_summary() -> LintSummary:
    return LintSummary(errors=0, warnings=0, info=0, sourceImportJobId=None, derivedFrom="none")


def _count_conflicts(conflict_records: Iterable[Mapping[str, Any]] | None) -> int:
    if not conflict_records:
        return 0
    return sum(1 for record in conflict_records if isinstance(record, Mapping))


def _count_change_report_categories(change_model: Mapping[str, Any] | None) -> tuple[int, int]:
    """Return ``(breaking_count, additive_count)`` from a change report.

    Both Objectified change reports and OpenAPI change diffs use loose
    JSON; we look for any common shapes without forcing schema rigidity:

    - ``breakingChanges``/``additiveChanges`` arrays at the top level
    - ``summary.breaking`` / ``summary.additive`` integer rollups
    - ``counts.breaking`` / ``counts.additive`` integer rollups
    """
    if not isinstance(change_model, Mapping):
        return 0, 0
    breaking = 0
    additive = 0
    if isinstance(change_model.get("breakingChanges"), list):
        breaking = len(change_model["breakingChanges"])
    if isinstance(change_model.get("additiveChanges"), list):
        additive = len(change_model["additiveChanges"])
    summary = change_model.get("summary") if isinstance(change_model.get("summary"), Mapping) else None
    if summary is not None:
        if isinstance(summary.get("breaking"), int):
            breaking = max(breaking, int(summary["breaking"]))
        if isinstance(summary.get("additive"), int):
            additive = max(additive, int(summary["additive"]))
    counts = change_model.get("counts") if isinstance(change_model.get("counts"), Mapping) else None
    if counts is not None:
        if isinstance(counts.get("breaking"), int):
            breaking = max(breaking, int(counts["breaking"]))
        if isinstance(counts.get("additive"), int):
            additive = max(additive, int(counts["additive"]))
    return breaking, additive


def derive_lint_summary(
    *,
    job: Mapping[str, Any] | None,
    change_model: Mapping[str, Any] | None,
) -> LintSummary:
    """Derive a best-effort lint summary for an import job.

    Mapping (deterministic, documented in the drawer UI):

    - ``errors``  = ``1`` if the job is in terminal ``failed`` state, plus
      one per recorded conflict.
    - ``warnings`` = number of breaking changes recorded in the change
      report (if any).
    - ``info`` = number of additive changes recorded in the change report
      (if any).
    """
    if job is None:
        return empty_lint_summary()
    state = job.get("state") if isinstance(job, Mapping) else None
    conflicts = job.get("conflictRecords") if isinstance(job, Mapping) else None
    failed = 1 if state == "failed" else 0
    conflict_count = _count_conflicts(conflicts if isinstance(conflicts, list) else None)
    breaking, additive = _count_change_report_categories(change_model)
    job_id_value = job.get("id") if isinstance(job, Mapping) else None
    job_id = job_id_value if isinstance(job_id_value, str) else None
    return LintSummary(
        errors=failed + conflict_count,
        warnings=breaking,
        info=additive,
        sourceImportJobId=job_id,
        derivedFrom="import_job_change_report" if change_model else "import_job",
    )


def provider_blob_url(*, provider: str, owner: str, name: str, branch: str, path: str) -> str | None:
    """Return a human-viewable deep-link to the file in the provider UI."""
    safe_owner = quote(owner, safe="")
    safe_name = quote(name, safe="")
    safe_branch = quote(branch, safe="")
    safe_path = "/".join(quote(part, safe="") for part in path.strip("/").split("/") if part)
    if provider == "github":
        return f"https://github.com/{safe_owner}/{safe_name}/blob/{safe_branch}/{safe_path}"
    return None


def provider_raw_url(*, provider: str, owner: str, name: str, branch: str, path: str) -> str | None:
    """Return a direct ``raw`` URL the user can use to download the file."""
    safe_owner = quote(owner, safe="")
    safe_name = quote(name, safe="")
    safe_branch = quote(branch, safe="")
    safe_path = "/".join(quote(part, safe="") for part in path.strip("/").split("/") if part)
    if provider == "github":
        return f"https://raw.githubusercontent.com/{safe_owner}/{safe_name}/{safe_branch}/{safe_path}"
    return None
