"""Periodic MCP endpoint re-discovery sweep — cadence-driven scheduler (MCAT-5.1, #3673).

The MCP catalog's manual discovery (MCAT-3.2, :mod:`mcp_discovery_engine`) re-handshakes a
single endpoint on demand. This module is the *periodic* counterpart: a background async loop
(wired in :mod:`app.main`) that, on every tick, asks the database for the endpoints whose
discovery cadence has elapsed and dispatches a fresh discovery run for each, mirroring the
repository auto-refresh sweep (:mod:`repository_refresh_sweep`).

Due-selection (:meth:`Database.list_due_mcp_endpoints`) does all the policy work: it returns
only live (``deleted_at IS NULL``), enabled endpoints whose ``last_discovered_at`` is older than
their effective cadence — the per-endpoint ``discovery_cadence_seconds`` override, or the global
``mcp_discovery_default_cadence_seconds`` when the endpoint has none. Endpoints are returned
oldest-first so attention is spread fairly and a never-discovered endpoint is picked up promptly.

Each due endpoint is handed to the *same* :func:`mcp_discovery_engine.trigger_discovery` pipeline
the manual route uses, tagged ``trigger='sweep'``. That reuse is what makes the loop idempotent
and singleton-safe: ``enqueue_mcp_discovery_job`` coalesces onto an already-active job (per-endpoint
advisory lock + active-state check), so a still-running discovery from a previous tick is never
double-started, and two overlapping sweep ticks never both kick off a run for the same endpoint.

The global ``mcp_discovery_enabled`` kill switch short-circuits the whole tick: when disabled the
sweep selects nothing and dispatches nothing, so operators can halt all auto-discovery for incident
response without touching per-endpoint state. Manual discovery (MCAT-3.2) does not run through this
sweep and is unaffected.

This module deliberately stops at *dispatch*: the discovery → diff → version pipeline that runs for
each dispatched endpoint is the existing MCAT-3.2/4.x engine. Concurrency bounding and per-endpoint
timeouts for the sweep are MCAT-5.2's scope.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from .mcp_discovery_engine import trigger_discovery

_logger = logging.getLogger(__name__)


async def process_mcp_discovery_sweep(db: Any) -> int:
    """Run one re-discovery sweep tick: dispatch discovery for every due endpoint (MCAT-5.1).

    Selects the endpoints due for re-discovery (cadence elapsed; disabled/deleted excluded) and
    triggers a ``trigger='sweep'`` discovery for each. A run that de-duplicates onto an already-
    active job (a prior tick still in flight, or a concurrent manual run) is not counted as newly
    dispatched. One endpoint failing to dispatch never aborts the rest of the tick.

    The global ``mcp_discovery_enabled`` kill switch halts the tick entirely (returns 0 without
    selecting or dispatching anything).

    Args:
        db: Database handle for this tick. The blocking due-selection query is pushed to a worker
            thread (psycopg2 is synchronous); the discovery runs themselves are async tasks created
            by :func:`mcp_discovery_engine.trigger_discovery`.

    Returns:
        The number of endpoints for which a *new* discovery run was dispatched this tick (0 when
        the kill switch is disabled or nothing was due).
    """
    from .config import settings

    if not settings.mcp_discovery_enabled:
        # Global kill switch (MCAT-5.1): halt all periodic discovery for this tick.
        _logger.info(
            "mcp discovery sweep halted: OBJECTIFIED_MCP_DISCOVERY_ENABLED is disabled"
        )
        return 0

    default_cadence = int(settings.mcp_discovery_default_cadence_seconds)
    due = await asyncio.to_thread(
        db.list_due_mcp_endpoints, default_cadence_seconds=default_cadence
    )

    dispatched = 0
    for endpoint in due:
        endpoint_id = str(endpoint["id"])
        tenant_id = str(endpoint["tenant_id"])
        try:
            _job, deduplicated = await trigger_discovery(
                tenant_id, endpoint, trigger="sweep"
            )
        except Exception:
            # A single endpoint's dispatch failure (e.g. transient DB error on enqueue)
            # must not abort the sweep for the remaining due endpoints.
            _logger.exception(
                "mcp discovery sweep dispatch failed endpoint_id=%s", endpoint_id
            )
            continue
        if not deduplicated:
            dispatched += 1

    if dispatched:
        _logger.info(
            "mcp discovery sweep dispatched %d discovery run(s) over %d due endpoint(s)",
            dispatched,
            len(due),
        )
    return dispatched
