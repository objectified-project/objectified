"""Manual MCP endpoint discovery: trigger an async job and run the Epic-2 client.

V2-MCP-17.2 / MCAT-3.2 (#3664). ``POST /v1/mcp/{tenant_slug}/endpoints/{id}/discover``
creates an ``mcp_discovery_jobs`` row (``trigger='manual'``), then — out of band — runs
the MCP client (transport → handshake → paginated discovery → normalize), fingerprints the
surface, diffs it against the previous snapshot, and persists a new
``mcp_endpoint_versions`` row when the surface changed (or version 1 on first run).

This mirrors the submit→poll shape of :mod:`spec_import_engine`: the route returns a job
reference immediately and the caller polls the job for the terminal state. Unlike the spec
importer, discovery runs entirely in-process (the MCP client is async Python), so there is no
subprocess — the network/normalize work runs as an asyncio task and the (synchronous,
psycopg2) DB writes are pushed to a worker thread.

De-duplication: concurrent discover requests for the same endpoint coalesce onto one job.
:meth:`Database.enqueue_mcp_discovery_job` makes the "is one already active?" check atomic via
a per-endpoint advisory lock; this module additionally short-circuits the in-process task so a
de-duplicated request never starts a second run.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Dict, List, Optional, Tuple

from .database import db
from .mcp_client import (
    DiscoveryError,
    DiscoverySurface,
    StreamableHttpTransport,
    classify_exception,
    discover_listings,
    initialize_session,
)
from .mcp_client.resilience import TimeBudget
from .mcp_credentials import load_endpoint_auth_headers

logger = logging.getLogger(__name__)

# Wall-clock ceiling for one discovery run (handshake + all pagination). Generous but
# bounded so a slow/hostile server cannot pin the task forever.
_DISCOVERY_BUDGET_SECONDS = 120.0

# Test seam: monkeypatch to an async callable(endpoint_row, headers) -> DiscoverySurface to
# bypass the real network. When None, :func:`_run_mcp_client` performs the live discovery.
_discovery_runner: Optional[
    Callable[[Dict[str, Any], Dict[str, str]], Awaitable[DiscoverySurface]]
] = None


def _utcnow() -> datetime:
    """Timezone-aware now(); isolated so tests can monkeypatch the clock."""
    return datetime.now(timezone.utc)


async def _run_mcp_client(
    endpoint: Dict[str, Any], headers: Dict[str, str]
) -> DiscoverySurface:
    """Connect to the endpoint, run the handshake + discovery, and normalize the surface.

    Args:
        endpoint: The ``mcp_endpoints`` row (``endpoint_url`` is used as the target).
        headers: Auth headers to attach to every request (empty when the endpoint has
            no usable credentials).

    Returns:
        The canonical :class:`DiscoverySurface` for the endpoint's current capabilities.
    """
    url = str(endpoint["endpoint_url"])
    budget = TimeBudget(total_seconds=_DISCOVERY_BUDGET_SECONDS)
    transport = StreamableHttpTransport(url, headers=dict(headers))
    try:
        initialize = await initialize_session(transport)
        listings = await discover_listings(transport, initialize.capabilities, budget=budget)
    finally:
        await transport.aclose()
    return DiscoverySurface.from_discovery(initialize, listings)


async def _invoke_discovery(
    endpoint: Dict[str, Any], headers: Dict[str, str]
) -> DiscoverySurface:
    """Dispatch to the test runner when installed, else the live MCP client."""
    if _discovery_runner is not None:
        return await _discovery_runner(endpoint, headers)
    return await _run_mcp_client(endpoint, headers)


# ---------------------------------------------------------------------------
# Diffing (Epic-4): capability-level added/removed/modified between snapshots.
# ---------------------------------------------------------------------------


def _item_key(item_type: Any, name: Any) -> Tuple[str, str]:
    """Identity of a capability across versions: its kind plus its programmatic name."""
    return (str(item_type), str(name))


def _canonical_raw(raw: Any) -> str:
    """Byte-stable JSON of an item's raw wire entry, for equality testing across versions."""
    if not isinstance(raw, dict):
        raw = {}
    return json.dumps(raw, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def compute_version_changes(
    previous_items: List[Dict[str, Any]],
    surface: DiscoverySurface,
) -> List[Dict[str, Any]]:
    """Diff a freshly discovered surface against the previous version's stored items.

    Capabilities are matched by ``(item_type, name)``. An item only in the new surface is
    ``added``, one only in the previous version is ``removed``, and one present in both whose
    raw wire entry differs is ``modified``. Each change row carries a ``detail`` payload with
    ``before`` / ``after`` raw entries (a removal has only ``before``, an addition only
    ``after``), matching the ``mcp_version_changes`` contract (V128).

    Args:
        previous_items: ``mcp_capability_items`` rows of the prior snapshot (may be empty).
        surface: The newly discovered, normalized surface.

    Returns:
        A list of change rows; empty when nothing changed at the capability level.
    """
    prev_by_key: Dict[Tuple[str, str], Dict[str, Any]] = {}
    for row in previous_items:
        prev_by_key[_item_key(row.get("item_type"), row.get("name"))] = row

    new_by_key: Dict[Tuple[str, str], Any] = {}
    for item in surface.all_items():
        new_by_key[_item_key(item.item_type, item.name)] = item

    changes: List[Dict[str, Any]] = []

    for key, item in new_by_key.items():
        new_raw = dict(item.raw) if isinstance(item.raw, dict) else {}
        if key not in prev_by_key:
            changes.append(
                {
                    "change_type": "added",
                    "item_type": item.item_type,
                    "item_name": item.name,
                    "detail": {"after": new_raw},
                }
            )
            continue
        prev_raw = prev_by_key[key].get("raw")
        if _canonical_raw(prev_raw) != _canonical_raw(new_raw):
            changes.append(
                {
                    "change_type": "modified",
                    "item_type": item.item_type,
                    "item_name": item.name,
                    "detail": {
                        "before": prev_raw if isinstance(prev_raw, dict) else {},
                        "after": new_raw,
                    },
                }
            )

    for key, row in prev_by_key.items():
        if key not in new_by_key:
            prev_raw = row.get("raw")
            changes.append(
                {
                    "change_type": "removed",
                    "item_type": str(row.get("item_type")),
                    "item_name": str(row.get("name")),
                    "detail": {"before": prev_raw if isinstance(prev_raw, dict) else {}},
                }
            )

    return changes


# ---------------------------------------------------------------------------
# Persistence — runs in a worker thread (psycopg2 is synchronous and blocking).
# ---------------------------------------------------------------------------


def _persist_outcome(
    job_id: str,
    endpoint: Dict[str, Any],
    surface: DiscoverySurface,
    discovered_at: datetime,
) -> Dict[str, Any]:
    """Fingerprint/diff the surface, persist a version when changed, and finish the job.

    Synchronous (DB-bound); invoked via :func:`asyncio.to_thread`. Returns the job's
    ``result`` payload (also written to the job row) so the caller can log it.
    """
    endpoint_id = str(endpoint["id"])
    fingerprint = surface.fingerprint()

    previous = db.get_latest_mcp_endpoint_version(endpoint_id)
    unchanged = previous is not None and previous.get("surface_fingerprint") == fingerprint

    if unchanged:
        # Same surface as the last snapshot — no new version, keep current_version_id.
        version_id = str(previous["id"])
        version_seq = int(previous["version_seq"])
        db.touch_mcp_endpoint_discovery(
            endpoint_id, status="unchanged", discovered_at=discovered_at
        )
        result = {
            "version_id": version_id,
            "version_seq": version_seq,
            "changed": False,
            "fingerprint": fingerprint,
        }
        db.finish_mcp_discovery_job(job_id, "completed", result=result)
        return result

    previous_items = (
        db.get_mcp_capability_items(str(previous["id"])) if previous is not None else []
    )
    change_rows = compute_version_changes(previous_items, surface)

    version_row = surface.to_version_row()
    persisted = db.record_mcp_discovery_version(
        endpoint_id,
        version_row=version_row,
        capability_rows=surface.to_capability_rows(None),
        change_rows=change_rows,
        discovered_at=discovered_at,
    )
    result = {
        "version_id": persisted["version_id"],
        "version_seq": persisted["version_seq"],
        "changed": True,
        "change_count": len(change_rows),
        "fingerprint": fingerprint,
    }
    db.finish_mcp_discovery_job(job_id, "completed", result=result)
    return result


def _persist_failure(
    job_id: str, endpoint_id: str, error: DiscoveryError, discovered_at: datetime
) -> None:
    """Record a failed run on both the job and the endpoint (synchronous)."""
    db.touch_mcp_endpoint_discovery(
        endpoint_id, status="failed", discovered_at=discovered_at
    )
    db.finish_mcp_discovery_job(
        job_id,
        "failed",
        result={"error": error.as_dict()},
        error=f"{error.code}: {error.message}"[:2000],
    )


async def _drive_discovery_job(job_id: str, endpoint: Dict[str, Any]) -> None:
    """Run one discovery job end-to-end: running → (client+persist) → completed/failed.

    Never raises: any failure is classified into the stable discovery error taxonomy and
    recorded on the job so a poller always observes a terminal state.
    """
    endpoint_id = str(endpoint["id"])
    running = await asyncio.to_thread(db.mark_mcp_discovery_job_running, job_id)
    if running is None:
        # The job was no longer queued (already started, or vanished) — nothing to do.
        logger.debug("discovery job=%s was not queued; skipping run", job_id)
        return

    try:
        headers = await asyncio.to_thread(load_endpoint_auth_headers, endpoint_id)
        surface = await _invoke_discovery(endpoint, headers)
    except Exception as exc:  # noqa: BLE001 - mapped to the stable error taxonomy below
        error = classify_exception(exc)
        logger.warning(
            "discovery job=%s endpoint=%s failed: %s", job_id, endpoint_id, error.to_record()
        )
        try:
            await asyncio.to_thread(
                _persist_failure, job_id, endpoint_id, error, _utcnow()
            )
        except Exception:  # noqa: BLE001 - last-resort guard so the task never crashes
            logger.exception("failed to record discovery failure job=%s", job_id)
        return

    try:
        result = await asyncio.to_thread(
            _persist_outcome, job_id, endpoint, surface, _utcnow()
        )
        logger.info(
            "discovery job=%s endpoint=%s completed: %s",
            job_id,
            endpoint_id,
            json.dumps(result),
        )
    except Exception as exc:  # noqa: BLE001 - persistence failure still terminates the job
        error = classify_exception(exc)
        logger.exception("discovery persistence failed job=%s", job_id)
        try:
            await asyncio.to_thread(
                _persist_failure, job_id, endpoint_id, error, _utcnow()
            )
        except Exception:  # noqa: BLE001
            logger.exception("failed to record discovery persistence failure job=%s", job_id)


async def trigger_discovery(
    tenant_id: str, endpoint: Dict[str, Any]
) -> Tuple[Dict[str, Any], bool]:
    """Enqueue a manual discovery job for an endpoint and start it unless de-duplicated.

    Args:
        tenant_id: Owning tenant (stamped on the job for scoped reads).
        endpoint: The already tenant-validated ``mcp_endpoints`` row to discover.

    Returns:
        ``(job_row, deduplicated)`` — when ``deduplicated`` is ``True`` an already-active
        job was returned and no new run was started; otherwise a fresh job was created and
        its discovery task scheduled.
    """
    endpoint_id = str(endpoint["id"])
    enqueued = await asyncio.to_thread(
        db.enqueue_mcp_discovery_job, endpoint_id, tenant_id, "manual"
    )
    job = enqueued["job"]
    deduplicated = bool(enqueued["deduplicated"])
    if not deduplicated:
        asyncio.create_task(_drive_discovery_job(str(job["id"]), endpoint))
    return job, deduplicated
