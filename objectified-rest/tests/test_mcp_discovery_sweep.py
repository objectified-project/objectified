"""Tests for the periodic MCP re-discovery sweep scheduler (V2-MCP-19.1 / MCAT-5.1, #3673).

All DB-free, three layers:

* **DB layer** — ``Database.list_due_mcp_endpoints`` builds the right due-selection SQL (enabled
  filter, ``COALESCE`` cadence with the global default, oldest-first ordering) and clamps a
  non-positive default cadence.
* **Sweep** — ``process_mcp_discovery_sweep`` dispatches a ``trigger='sweep'`` discovery per due
  endpoint, honours the global kill switch, does not count de-duplicated runs, and isolates a
  single endpoint's dispatch failure from the rest of the tick.
* **Engine seam** — ``trigger_discovery`` threads the ``trigger`` label through to the enqueue.
"""

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

from app import mcp_discovery_engine, mcp_discovery_sweep
from app.database import Database

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
    }
    base.update(overrides)
    return SimpleNamespace(**base)


def _patch_settings(monkeypatch, **overrides):
    monkeypatch.setattr(
        "app.config.settings", _settings(**overrides), raising=False
    )


async def test_sweep_dispatches_discovery_per_due_endpoint(monkeypatch):
    _patch_settings(monkeypatch)
    db = MagicMock()
    db.list_due_mcp_endpoints.return_value = [_endpoint(_EP1), _endpoint(_EP2)]

    calls = []

    async def _fake_trigger(tenant_id, endpoint, *, trigger="manual"):
        calls.append((tenant_id, endpoint["id"], trigger))
        return {"id": "job"}, False

    monkeypatch.setattr(mcp_discovery_sweep, "trigger_discovery", _fake_trigger)

    dispatched = await mcp_discovery_sweep.process_mcp_discovery_sweep(db)

    assert dispatched == 2
    # The global default cadence is forwarded to due-selection.
    db.list_due_mcp_endpoints.assert_called_once_with(default_cadence_seconds=3600)
    # Each due endpoint is discovered under the sweep trigger.
    assert calls == [("t1", _EP1, "sweep"), ("t1", _EP2, "sweep")]


async def test_sweep_halts_on_global_kill_switch(monkeypatch):
    _patch_settings(monkeypatch, mcp_discovery_enabled=False)
    db = MagicMock()

    triggered = []

    async def _fake_trigger(*_a, **_k):
        triggered.append(True)
        return {"id": "job"}, False

    monkeypatch.setattr(mcp_discovery_sweep, "trigger_discovery", _fake_trigger)

    dispatched = await mcp_discovery_sweep.process_mcp_discovery_sweep(db)

    assert dispatched == 0
    # The kill switch short-circuits before any selection or dispatch.
    db.list_due_mcp_endpoints.assert_not_called()
    assert triggered == []


async def test_sweep_does_not_count_deduplicated_runs(monkeypatch):
    _patch_settings(monkeypatch)
    db = MagicMock()
    db.list_due_mcp_endpoints.return_value = [_endpoint(_EP1), _endpoint(_EP2)]

    # EP1 starts a fresh run; EP2 coalesces onto an already-active job.
    outcomes = {_EP1: ({"id": "job1"}, False), _EP2: ({"id": "job2"}, True)}

    async def _fake_trigger(_tenant_id, endpoint, *, trigger="manual"):
        return outcomes[endpoint["id"]]

    monkeypatch.setattr(mcp_discovery_sweep, "trigger_discovery", _fake_trigger)

    dispatched = await mcp_discovery_sweep.process_mcp_discovery_sweep(db)

    # Only the newly-started run is counted; the de-duplicated one is not.
    assert dispatched == 1


async def test_sweep_isolates_single_endpoint_dispatch_failure(monkeypatch):
    _patch_settings(monkeypatch)
    db = MagicMock()
    db.list_due_mcp_endpoints.return_value = [_endpoint(_EP1), _endpoint(_EP2)]

    seen = []

    async def _fake_trigger(_tenant_id, endpoint, *, trigger="manual"):
        seen.append(endpoint["id"])
        if endpoint["id"] == _EP1:
            raise RuntimeError("enqueue boom")
        return {"id": "job2"}, False

    monkeypatch.setattr(mcp_discovery_sweep, "trigger_discovery", _fake_trigger)

    dispatched = await mcp_discovery_sweep.process_mcp_discovery_sweep(db)

    # EP1 failed, but EP2 was still attempted and dispatched.
    assert seen == [_EP1, _EP2]
    assert dispatched == 1


async def test_sweep_no_due_endpoints_is_a_noop(monkeypatch):
    _patch_settings(monkeypatch)
    db = MagicMock()
    db.list_due_mcp_endpoints.return_value = []

    async def _fake_trigger(*_a, **_k):  # pragma: no cover - must not be called
        raise AssertionError("trigger_discovery should not run with no due endpoints")

    monkeypatch.setattr(mcp_discovery_sweep, "trigger_discovery", _fake_trigger)

    assert await mcp_discovery_sweep.process_mcp_discovery_sweep(db) == 0


# ===========================================================================
# ENGINE SEAM — trigger label threads through to enqueue
# ===========================================================================


async def test_trigger_discovery_passes_sweep_label_to_enqueue(monkeypatch):
    mdb = MagicMock()
    mdb.enqueue_mcp_discovery_job.return_value = {
        "job": {"id": "job", "trigger": "sweep"},
        "deduplicated": False,
    }
    monkeypatch.setattr(mcp_discovery_engine, "db", mdb)

    def _capture(coro):
        coro.close()  # only assert a task was scheduled; don't run it

    monkeypatch.setattr(mcp_discovery_engine.asyncio, "create_task", _capture)

    job, deduplicated = await mcp_discovery_engine.trigger_discovery(
        "t1", _endpoint(_EP1), trigger="sweep"
    )

    assert deduplicated is False
    assert job["trigger"] == "sweep"
    # The trigger label reaches the enqueue DAO unchanged.
    mdb.enqueue_mcp_discovery_job.assert_called_once_with(_EP1, "t1", "sweep")


async def test_trigger_discovery_defaults_to_manual_label(monkeypatch):
    mdb = MagicMock()
    mdb.enqueue_mcp_discovery_job.return_value = {
        "job": {"id": "job", "trigger": "manual"},
        "deduplicated": True,
    }
    monkeypatch.setattr(mcp_discovery_engine, "db", mdb)

    await mcp_discovery_engine.trigger_discovery("t1", _endpoint(_EP1))

    mdb.enqueue_mcp_discovery_job.assert_called_once_with(_EP1, "t1", "manual")
