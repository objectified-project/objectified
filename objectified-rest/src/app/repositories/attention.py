"""REPO-11.1 / #2941: pure attention rollup (reasons, open_count, score)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Sequence, Set, Tuple

# Sum-based score; each reason at most once. Capped at 100 in compute_attention_score.
REASON_WEIGHTS: dict[str, int] = {
    "parse_error": 20,
    "manifest_error": 30,
    "token_revoked": 40,
    "scheduler_paused": 25,
    "repeated_failures": 25,
    "stale_checksum": 10,
    "import_failed": 30,
    "mapping_required": 25,
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


def compute_attention_detail(
    inp: AttentionComputeInput,
) -> Tuple[Set[str], int, int, Dict[str, List[str]]]:
    """
    Return (reasons set, open_count, attention_score, paths per active reason).
    Repository-scoped reasons (e.g. token_revoked) map to an empty path list.
    """
    reasons: Set[str] = set()
    open_paths: Set[str] = set()
    reason_paths: Dict[str, Set[str]] = {}

    def _add_path(reason: str, path: str | None) -> None:
        reasons.add(reason)
        if path:
            reason_paths.setdefault(reason, set()).add(path)
            open_paths.add(path)

    for f in inp.last_scan_files:
        if f.status == "parse_error":
            _add_path("parse_error", f.path)
        if f.status == "manifest_error":
            _add_path("manifest_error", f.path)
        if f.last_import_job_state == "failed" and f.path:
            _add_path("import_failed", f.path)
        if f.status == "mapping_required" and f.path:
            _add_path("mapping_required", f.path)
        if _stale_ready_to_promote(f, inp.now) and f.path:
            _add_path("stale_checksum", f.path)

    if inp.any_credential_revoked:
        reasons.add("token_revoked")
    if inp.repository_status == "paused" and inp.is_auto_paused:
        reasons.add("scheduler_paused")
    if inp.max_consecutive_failures >= REPEATED_FAILURES_MIN:
        reasons.add("repeated_failures")

    ordered = sorted(r for r in reasons if r in _VALID_REASONS)
    open_count = len(open_paths)
    score = compute_attention_score(ordered)
    paths_by_reason = {r: sorted(reason_paths.get(r, set())) for r in ordered}
    return set(ordered), open_count, score, paths_by_reason


def compute_attention_row(inp: AttentionComputeInput) -> Tuple[Set[str], int, int]:
    """Return (reasons set, open_count, attention_score)."""
    rsn, ocnt, score, _ = compute_attention_detail(inp)
    return rsn, ocnt, score


def top_reason_for_chips(valid_reasons: Sequence[str]) -> str:
    """Pick the single reason to show as the row chip: highest weight, then lexicographic tie-break."""
    best: str | None = None
    best_w = -1
    for r in valid_reasons:
        w = REASON_WEIGHTS.get(r, 0)
        if w > best_w or (w == best_w and best is not None and r < best):
            best = r
            best_w = w
    if best is not None:
        return best
    if valid_reasons:
        return str(sorted(valid_reasons)[0])
    return "unknown"


def attention_detail_query_tab(valid_reasons: Sequence[str]) -> str:
    """`tab` query for repository deep links. Returns `"specs"` when `mapping_required` is present; `"issues"` for any other active reason; `"files"` otherwise."""
    r = {x for x in valid_reasons if x in _VALID_REASONS}
    if "mapping_required" in r:
        return "specs"
    if r:
        return "issues"
    return "files"
