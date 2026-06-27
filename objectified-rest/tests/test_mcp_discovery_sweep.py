"""Tests for the periodic MCP re-discovery sweep (V2-MCP-19.1/19.2 / MCAT-5.1+5.2, #3673/#3674).

All DB-free, four layers:

* **DB layer** — ``Database.list_due_mcp_endpoints`` builds the right due-selection SQL (enabled
  filter, ``COALESCE`` cadence with the global default, oldest-first ordering) and clamps a
  non-positive default cadence.
* **Sweep** — ``process_mcp_discovery_sweep`` enqueues a ``trigger='sweep'`` job per due endpoint
  and drives the freshly-created ones under a concurrency cap with a per-endpoint timeout; it
  honours the global kill switch, does not count/drive de-duplicated runs, isolates a single
  endpoint's enqueue failure, and never lets one run's crash abort the tick (MCAT-5.2).
* **Engine seam** — ``enqueue_discovery_job`` threads the ``trigger`` label through to the enqueue
  without scheduling a run; ``trigger_discovery`` still enqueues *and* schedules the manual run;
  ``run_discovery_job`` records a ``budget_exceeded`` failure when a run overruns its timeout.
"""

import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

from app import mcp_discovery_engine, mcp_discovery_sweep
from app.database import Database
from app.mcp_client.errors import DiscoveryErrorCode

_NOW = datetime(2026, 6, 27, 12, 0, 0, tzinfo=timezone.utc)
_EP1 = "11111111-1111-1111-1111-111111111111"
_EP2 = "22222222-2222-2222-2222-222222222222"


def _endpoint(endpoint_id: str, *, tenant_id: str = "t1") -> dict:
    return {
        "id": endpoint_id,
        "tenant_id": tenant_id,
        "name": "Acme Weather",
        "slug": "acme-weather",
        "endpoint_url": "https://mcp.acme.example/mcp",
        "transport": "streamable_http",
    }


# ===========================================================================
# DB LAYER — due-selection SQL
# ===========================================================================


def test_list_due_endpoints_builds_due_selection_sql(monkeypatch):
    db = Database()
    captured = {}

    def _fake_execute(query, params=None):
        captured["query"] = query
        captured["params"] = params
        return [_endpoint(_EP1), _endpoint(_EP2)]

    monkeypatch.setattr(db, "execute_query", _fake_execute)

    rows = db.list_due_mcp_endpoints(default_cadence_seconds=3600)

    assert [r["id"] for r in rows] == [_EP1, _EP2]
    q = captured["query"]
    # Only live, enabled endpoints are candidates.
    assert "deleted_at IS NULL" in q
    assert "enabled = TRUE" in q
    # Never-discovered endpoints are always due; otherwise compare against the effective cadence.
    assert "last_discovered_at IS NULL" in q
    # Per-endpoint override falls back to the global default via COALESCE.
    assert "COALESCE(discovery_cadence_seconds, %s)" in q
    # Recency is evaluated in the database (no app clock).
    assert "now() - make_interval" in q
    # Fair scheduling: oldest first, never-discovered first.
    assert "ORDER BY last_discovered_at ASC NULLS FIRST" in q
    # The global default cadence is the bound parameter.
    assert captured["params"] == (3600,)


def test_list_due_endpoints_clamps_non_positive_default_cadence(monkeypatch):
    db = Database()
    captured = {}

    def _fake_execute(query, params=None):
        captured["params"] = params
        return []

    monkeypatch.setattr(db, "execute_query", _fake_execute)

    db.list_due_mcp_endpoints(default_cadence_seconds=0)

    # A non-positive default would make make_interval(secs => 0) treat everything as due forever;
    # it is clamped up to a 1-second floor.
    assert captured["params"] == (1,)


# ===========================================================================
# SWEEP — process_mcp_discovery_sweep
# ===========================================================================


def _settings(**overrides):
    base = {
        "mcp_discovery_enabled": True,
        "mcp_discovery_default_cadence_seconds": 3600,
        "mcp_discovery_min_interval_seconds": 60,
        "mcp_discovery_max_concurrency": 4,
        "mcp_discovery_endpoint_timeout_seconds": 150,
    }
    base.update(overrides)
    return SimpleNamespace(**base)


def _patch_settings(monkeypatch, **overrides):
    monkeypatch.setattr(
        "app.config.settings", _settings(**overrides), raising=False
    )


async def test_sweep_enqueues_and_runs_discovery_per_due_endpoint(monkeypatch):
    _patch_settings(monkeypatch)
    db = MagicMock()
    db.list_due_mcp_endpoints.return_value = [_endpoint(_EP1), _endpoint(_EP2)]

    enqueued = []

    async def _fake_enqueue(tenant_id, endpoint, *, trigger="manual"):
        enqueued.append((tenant_id, endpoint["id"], trigger))
        return {"id": f"job-{endpoint['id']}"}, False

    runs = []

    async def _fake_run(job_id, endpoint, *, timeout_seconds=None):
        runs.append((job_id, endpoint["id"], timeout_seconds))

    monkeypatch.setattr(mcp_discovery_sweep, "enqueue_discovery_job", _fake_enqueue)
    monkeypatch.setattr(mcp_discovery_sweep, "run_discovery_job", _fake_run)

    dispatched = await mcp_discovery_sweep.process_mcp_discovery_sweep(db)

    assert dispatched == 2
    # The global default cadence is forwarded to due-selection.
    db.list_due_mcp_endpoints.assert_called_once_with(default_cadence_seconds=3600)
    # Each due endpoint is enqueued under the sweep trigger...
    assert enqueued == [("t1", _EP1, "sweep"), ("t1", _EP2, "sweep")]
    # ...and its freshly-created job is driven with the configured per-endpoint timeout.
    assert sorted(r[1] for r in runs) == [_EP1, _EP2]
    assert all(r[2] == 150.0 for r in runs)


async def test_sweep_halts_on_global_kill_switch(monkeypatch):
    _patch_settings(monkeypatch, mcp_discovery_enabled=False)
    db = MagicMock()

    async def _fake_enqueue(*_a, **_k):  # pragma: no cover - must not be called
        raise AssertionError("enqueue must not run when the kill switch is off")

    monkeypatch.setattr(mcp_discovery_sweep, "enqueue_discovery_job", _fake_enqueue)

    dispatched = await mcp_discovery_sweep.process_mcp_discovery_sweep(db)

    assert dispatched == 0
    # The kill switch short-circuits before any selection or enqueue.
    db.list_due_mcp_endpoints.assert_not_called()


async def test_sweep_does_not_drive_deduplicated_runs(monkeypatch):
    _patch_settings(monkeypatch)
    db = MagicMock()
    db.list_due_mcp_endpoints.return_value = [_endpoint(_EP1), _endpoint(_EP2)]

    # EP1 creates a fresh job; EP2 coalesces onto an already-active job.
    outcomes = {_EP1: ({"id": "job1"}, False), _EP2: ({"id": "job2"}, True)}

    async def _fake_enqueue(_tenant_id, endpoint, *, trigger="manual"):
        return outcomes[endpoint["id"]]

    runs = []

    async def _fake_run(job_id, endpoint, *, timeout_seconds=None):
        runs.append(job_id)

    monkeypatch.setattr(mcp_discovery_sweep, "enqueue_discovery_job", _fake_enqueue)
    monkeypatch.setattr(mcp_discovery_sweep, "run_discovery_job", _fake_run)

    dispatched = await mcp_discovery_sweep.process_mcp_discovery_sweep(db)

    # Only the freshly-created job is counted and driven; the de-duplicated one is left alone.
    assert dispatched == 1
    assert runs == ["job1"]


async def test_sweep_isolates_single_endpoint_enqueue_failure(monkeypatch):
    _patch_settings(monkeypatch)
    db = MagicMock()
    db.list_due_mcp_endpoints.return_value = [_endpoint(_EP1), _endpoint(_EP2)]

    seen = []

    async def _fake_enqueue(_tenant_id, endpoint, *, trigger="manual"):
        seen.append(endpoint["id"])
        if endpoint["id"] == _EP1:
            raise RuntimeError("enqueue boom")
        return {"id": "job2"}, False

    runs = []

    async def _fake_run(job_id, endpoint, *, timeout_seconds=None):
        runs.append(job_id)

    monkeypatch.setattr(mcp_discovery_sweep, "enqueue_discovery_job", _fake_enqueue)
    monkeypatch.setattr(mcp_discovery_sweep, "run_discovery_job", _fake_run)

    dispatched = await mcp_discovery_sweep.process_mcp_discovery_sweep(db)

    # EP1 failed to enqueue, but EP2 was still enqueued and driven.
    assert seen == [_EP1, _EP2]
    assert dispatched == 1
    assert runs == ["job2"]


async def test_sweep_run_crash_does_not_abort_tick(monkeypatch):
    _patch_settings(monkeypatch)
    db = MagicMock()
    db.list_due_mcp_endpoints.return_value = [_endpoint(_EP1), _endpoint(_EP2)]

    async def _fake_enqueue(_tenant_id, endpoint, *, trigger="manual"):
        return {"id": f"job-{endpoint['id']}"}, False

    ran = []

    async def _fake_run(job_id, endpoint, *, timeout_seconds=None):
        ran.append(job_id)
        if endpoint["id"] == _EP1:
            raise RuntimeError("unexpected run crash")

    monkeypatch.setattr(mcp_discovery_sweep, "enqueue_discovery_job", _fake_enqueue)
    monkeypatch.setattr(mcp_discovery_sweep, "run_discovery_job", _fake_run)

    dispatched = await mcp_discovery_sweep.process_mcp_discovery_sweep(db)

    # Both runs were attempted (gather return_exceptions); one crashing did not abort the other.
    assert sorted(ran) == [f"job-{_EP1}", f"job-{_EP2}"]
    assert dispatched == 2


async def test_sweep_bounds_concurrency(monkeypatch):
    _patch_settings(monkeypatch, mcp_discovery_max_concurrency=2)
    db = MagicMock()
    ids = [f"endpoint-{i}" for i in range(6)]
    db.list_due_mcp_endpoints.return_value = [_endpoint(i) for i in ids]

    async def _fake_enqueue(_tenant_id, endpoint, *, trigger="manual"):
        return {"id": f"job-{endpoint['id']}"}, False

    active = 0
    peak = 0

    async def _fake_run(job_id, endpoint, *, timeout_seconds=None):
        nonlocal active, peak
        active += 1
        peak = max(peak, active)
        # Hold the slot briefly so overlap (or its absence) is observable.
        await asyncio.sleep(0.01)
        active -= 1

    monkeypatch.setattr(mcp_discovery_sweep, "enqueue_discovery_job", _fake_enqueue)
    monkeypatch.setattr(mcp_discovery_sweep, "run_discovery_job", _fake_run)

    dispatched = await mcp_discovery_sweep.process_mcp_discovery_sweep(db)

    assert dispatched == 6
    # The semaphore never let more than the cap run simultaneously...
    assert peak <= 2
    # ...yet it did run them concurrently up to the cap (not serially).
    assert peak == 2


async def test_sweep_no_due_endpoints_is_a_noop(monkeypatch):
    _patch_settings(monkeypatch)
    db = MagicMock()
    db.list_due_mcp_endpoints.return_value = []

    async def _fake_enqueue(*_a, **_k):  # pragma: no cover - must not be called
        raise AssertionError("enqueue should not run with no due endpoints")

    monkeypatch.setattr(mcp_discovery_sweep, "enqueue_discovery_job", _fake_enqueue)

    assert await mcp_discovery_sweep.process_mcp_discovery_sweep(db) == 0


# ===========================================================================
# ENGINE SEAM — enqueue / trigger / bounded run
# ===========================================================================


async def test_enqueue_discovery_job_threads_label_without_running(monkeypatch):
    mdb = MagicMock()
    mdb.enqueue_mcp_discovery_job.return_value = {
        "job": {"id": "job", "trigger": "sweep"},
        "deduplicated": False,
    }
    monkeypatch.setattr(mcp_discovery_engine, "db", mdb)

    scheduled = []

    def _capture(coro):  # pragma: no cover - asserted empty below
        scheduled.append(coro)
        coro.close()

    monkeypatch.setattr(mcp_discovery_engine.asyncio, "create_task", _capture)

    job, deduplicated = await mcp_discovery_engine.enqueue_discovery_job(
        "t1", _endpoint(_EP1), trigger="sweep"
    )

    assert deduplicated is False
    assert job["id"] == "job"
    # The trigger label reaches the enqueue DAO unchanged.
    mdb.enqueue_mcp_discovery_job.assert_called_once_with(_EP1, "t1", "sweep")
    # enqueue must NOT start a run — driving is the caller's responsibility (bounded sweep).
    assert scheduled == []


async def test_trigger_discovery_passes_sweep_label_and_schedules_run(monkeypatch):
    mdb = MagicMock()
    mdb.enqueue_mcp_discovery_job.return_value = {
        "job": {"id": "job", "trigger": "sweep"},
        "deduplicated": False,
    }
    monkeypatch.setattr(mcp_discovery_engine, "db", mdb)

    scheduled = []

    def _capture(coro):
        scheduled.append(coro)
        coro.close()  # only assert a task was scheduled; don't run it

    monkeypatch.setattr(mcp_discovery_engine.asyncio, "create_task", _capture)

    job, deduplicated = await mcp_discovery_engine.trigger_discovery(
        "t1", _endpoint(_EP1), trigger="sweep"
    )

    assert deduplicated is False
    assert job["trigger"] == "sweep"
    # The trigger label reaches the enqueue DAO unchanged...
    mdb.enqueue_mcp_discovery_job.assert_called_once_with(_EP1, "t1", "sweep")
    # ...and a fresh job's run is scheduled in the background.
    assert len(scheduled) == 1


async def test_trigger_discovery_defaults_to_manual_label(monkeypatch):
    mdb = MagicMock()
    mdb.enqueue_mcp_discovery_job.return_value = {
        "job": {"id": "job", "trigger": "manual"},
        "deduplicated": True,
    }
    monkeypatch.setattr(mcp_discovery_engine, "db", mdb)

    await mcp_discovery_engine.trigger_discovery("t1", _endpoint(_EP1))

    mdb.enqueue_mcp_discovery_job.assert_called_once_with(_EP1, "t1", "manual")


async def test_run_discovery_job_drives_without_timeout(monkeypatch):
    ran = []

    async def _fast_drive(job_id, endpoint):
        ran.append(job_id)

    failures = []

    def _fake_persist_failure(*args):  # pragma: no cover - must not be called
        failures.append(args)

    monkeypatch.setattr(mcp_discovery_engine, "_drive_discovery_job", _fast_drive)
    monkeypatch.setattr(mcp_discovery_engine, "_persist_failure", _fake_persist_failure)

    # None timeout takes the unbounded path; a generous finite timeout completes normally.
    await mcp_discovery_engine.run_discovery_job("jobA", _endpoint(_EP1), timeout_seconds=None)
    await mcp_discovery_engine.run_discovery_job("jobB", _endpoint(_EP1), timeout_seconds=5)

    assert ran == ["jobA", "jobB"]
    assert failures == []


async def test_run_discovery_job_records_budget_failure_on_timeout(monkeypatch):
    async def _slow_drive(job_id, endpoint):
        await asyncio.sleep(5)  # far longer than the timeout below

    captured = {}

    def _fake_persist_failure(job_id, endpoint_id, error, discovered_at):
        captured["job_id"] = job_id
        captured["endpoint_id"] = endpoint_id
        captured["error"] = error

    monkeypatch.setattr(mcp_discovery_engine, "_drive_discovery_job", _slow_drive)
    monkeypatch.setattr(mcp_discovery_engine, "_persist_failure", _fake_persist_failure)

    await mcp_discovery_engine.run_discovery_job(
        "job-slow", _endpoint(_EP1), timeout_seconds=0.01
    )

    # The overrun is recorded as a terminal budget_exceeded failure on the right job/endpoint.
    assert captured["job_id"] == "job-slow"
    assert captured["endpoint_id"] == _EP1
    assert captured["error"].code == DiscoveryErrorCode.BUDGET_EXCEEDED
