"""REPO-11.1 / #2941: pure attention rollup (reasons, open_count, score)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Sequence, Set, Tuple

# Sum-based score; each reason at most once. Capped at 100 in compute_attention_score.
REASON_WEIGHTS: dict[str, int] = {
    "parse_error": 20,
    "manifest_error": 30,
    "token_revoked": 40,
    "scheduler_paused": 25,
    "repeated_failures": 25,
    "stale_checksum": 10,
    "import_failed": 30,
}

STALE_CHECKSUM_AGE = timedelta(hours=24)
REPEATED_FAILURES_MIN = 3

_VALID_REASONS = frozenset(REASON_WEIGHTS)


def compute_attention_score(reasons: Sequence[str]) -> int:
    total = 0
    for r in reasons:
        w = REASON_WEIGHTS.get(r, 0)
        total += w
    return max(0, min(100, total))


@dataclass(frozen=True)
class AttentionFileInput:
    path: str
    status: str
    import_enabled: bool
    auto_import_enabled: bool
    content_checksum: str | None
    last_imported_checksum: str | None
    stale_mismatch_at: str | None
    last_import_job_state: str | None  # "failed" | "pending_review" | "committed" or None


@dataclass(frozen=True)
class AttentionComputeInput:
    """Inputs for a single recompute; all heavy lifting stays O(files) for one repo."""

    now: datetime
    repository_status: str
    is_auto_paused: bool
    last_scan_files: Sequence[AttentionFileInput]
    max_consecutive_failures: int
    any_credential_revoked: bool


def _parse_ts(raw: str | None) -> datetime | None:
    if not raw or not str(raw).strip():
        return None
    normalized = str(raw).strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _stale_ready_to_promote(f: AttentionFileInput, now: datetime) -> bool:
    """True when checksum drift in the import-enabled / manual-auto-import bucket persisted ≥ 24h."""
    if not f.import_enabled or f.auto_import_enabled:
        return False
    c = f.content_checksum
    li = f.last_imported_checksum
    if not c or not li or c == li:
        return False
    t0 = _parse_ts(f.stale_mismatch_at)
    if t0 is None:
        return False
    return (now - t0) >= STALE_CHECKSUM_AGE


def compute_attention_row(inp: AttentionComputeInput) -> Tuple[Set[str], int, int]:
    """Return (reasons set, open_count, attention_score)."""
    reasons: Set[str] = set()
    open_paths: Set[str] = set()
    for f in inp.last_scan_files:
        if f.status == "parse_error":
            reasons.add("parse_error")
            if f.path:
                open_paths.add(f.path)
        if f.status == "manifest_error":
            reasons.add("manifest_error")
            if f.path:
                open_paths.add(f.path)
        if f.last_import_job_state == "failed" and f.path:
            reasons.add("import_failed")
            open_paths.add(f.path)
        if _stale_ready_to_promote(f, inp.now) and f.path:
            reasons.add("stale_checksum")
            open_paths.add(f.path)

    if inp.any_credential_revoked:
        reasons.add("token_revoked")
    if inp.repository_status == "paused" and inp.is_auto_paused:
        reasons.add("scheduler_paused")
    if inp.max_consecutive_failures >= REPEATED_FAILURES_MIN:
        reasons.add("repeated_failures")

    ordered = sorted(r for r in reasons if r in _VALID_REASONS)
    open_count = len(open_paths)
    score = compute_attention_score(ordered)
    return set(ordered), open_count, score
