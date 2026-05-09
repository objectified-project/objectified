"""Import orchestrator (#3307) — unit helpers and optional live-DB / Node checks."""

from __future__ import annotations

import os
import shutil
import uuid
from pathlib import Path
import pytest

from app.database import Database, ImportJobConcurrencyCaps
from app.import_orchestrator import merge_job_input, orchestrator_worker_count, run_import_sidecar

_requires_db = pytest.mark.skipif(not os.environ.get("DATABASE_URL"), reason="DATABASE_URL not set")
_requires_node = pytest.mark.skipif(not shutil.which("node"), reason="node not on PATH")


def test_merge_job_input_adds_ids_and_selected_schemas():
    row = {
        "tenant_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        "created_by": "11111111-2222-3333-4444-555555555555",
        "input": {
            "sourceKind": "openapi",
            "document": {
                "openapi": "3.0.0",
                "components": {"schemas": {"Pet": {"type": "object"}}},
            },
            "project": {"name": "P", "slug": "p"},
            "version": {"versionId": "1.0.0"},
            "options": {},
        },
    }
    out = merge_job_input(row)
    assert out["tenantId"] == row["tenant_id"]
    assert out["userId"] == row["created_by"]
    assert out["options"]["selectedSchemas"] == ["Pet"]


def test_orchestrator_worker_count_reads_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OBJECTIFIED_IMPORT_WORKERS", "3")
    assert orchestrator_worker_count() == 3
    monkeypatch.setenv("OBJECTIFIED_IMPORT_WORKERS", "0")
    assert orchestrator_worker_count() == 0


@_requires_db
def test_mark_stale_running_import_jobs_failed():
    db_url = os.environ["DATABASE_URL"]
    psycopg2 = pytest.importorskip("psycopg2")
    from psycopg2.extras import Json

    db = Database()
    db.connect()
    members = db.execute_query(
        "SELECT tenant_id::text AS tenant_id, user_id::text AS user_id FROM odb.tenant_users LIMIT 1"
    )
    if not members:
        pytest.skip("no tenant_users row")

    tenant_id = members[0]["tenant_id"]
    user_id = members[0]["user_id"]
    job_id = str(uuid.uuid4())

    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO odb.import_jobs (
                    job_id, tenant_id, project_id, state, source_kind,
                    blob_sha, repository_source, input, events,
                    percent, created_by
                )
                VALUES (
                    %s::uuid, %s::uuid, NULL, 'running', 'openapi',
                    NULL, NULL, %s::jsonb, %s::jsonb,
                    0, %s::uuid
                )
                """,
                (
                    job_id,
                    tenant_id,
                    Json(
                        {
                            "sourceKind": "openapi",
                            "document": {"openapi": "3.0.0"},
                            "project": {"name": "Stale", "slug": f"stale-{job_id[:8]}"},
                            "version": {"versionId": "1.0.0"},
                            "options": {"selectedSchemas": [], "dryRun": True},
                        }
                    ),
                    Json([{"type": "queued", "at": "2026-05-09T00:00:00+00:00"}]),
                    user_id,
                ),
            )
            cur.execute(
                """
                UPDATE odb.import_jobs
                SET updated_at = NOW() - INTERVAL '2 minutes'
                WHERE job_id = %s::uuid
                """,
                (job_id,),
            )
        conn.commit()
    finally:
        conn.close()

    try:
        n = db.mark_stale_running_import_jobs_failed(60)
        assert n >= 1
        row = db.get_import_job_row(tenant_id, job_id)
        assert row is not None
        assert row["state"] == "failed"
        err = row.get("error")
        assert isinstance(err, dict)
        assert err.get("code") == "orchestrator-crash"
    finally:
        conn = psycopg2.connect(db_url)
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM odb.import_jobs WHERE job_id = %s::uuid", (job_id,))
            conn.commit()
        finally:
            conn.close()


@_requires_db
@_requires_node
@pytest.mark.asyncio
async def test_sidecar_dry_run_completes(repo_root: Path) -> None:
    db_url = os.environ["DATABASE_URL"]
    psycopg2 = pytest.importorskip("psycopg2")
    from psycopg2.extras import Json

    db = Database()
    db.connect()
    members = db.execute_query(
        "SELECT tenant_id::text AS tenant_id, user_id::text AS user_id FROM odb.tenant_users LIMIT 1"
    )
    if not members:
        pytest.skip("no tenant_users row")

    tenant_id = members[0]["tenant_id"]
    user_id = members[0]["user_id"]
    job_id = str(uuid.uuid4())
    slug = f"orch-test-{job_id[:8]}"

    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO odb.import_jobs (
                    job_id, tenant_id, project_id, state, source_kind,
                    blob_sha, repository_source, input, events,
                    percent, created_by
                )
                VALUES (
                    %s::uuid, %s::uuid, NULL, 'running', 'openapi',
                    NULL, NULL, %s::jsonb, %s::jsonb,
                    0, %s::uuid
                )
                """,
                (
                    job_id,
                    tenant_id,
                    Json(
                        {
                            "sourceKind": "openapi",
                            "document": {
                                "openapi": "3.1.0",
                                "info": {"title": "Orch", "version": "1.0"},
                                "paths": {},
                                "components": {"schemas": {"Pet": {"type": "object", "properties": {"n": {"type": "string"}}}}},
                            },
                            "project": {"name": "Orch Test", "slug": slug},
                            "version": {"versionId": "1.0.0"},
                            "options": {"selectedSchemas": ["Pet"], "dryRun": True},
                        }
                    ),
                    Json([{"type": "queued", "at": "2026-05-09T00:00:00+00:00"}]),
                    user_id,
                ),
            )
        conn.commit()
    finally:
        conn.close()

    row = db.get_import_job_row(tenant_id, job_id)
    assert row is not None

    try:
        code, err_tail = await run_import_sidecar(db, row)
        assert code == 0
        updated = db.get_import_job_row(tenant_id, job_id)
        assert updated is not None
        assert updated["state"] == "completed"
        if err_tail:
            assert isinstance(err_tail, list)
    finally:
        conn = psycopg2.connect(db_url)
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM odb.import_jobs WHERE job_id = %s::uuid", (job_id,))
            conn.commit()
        finally:
            conn.close()


def test_import_job_concurrency_caps_release_idempotent() -> None:
    caps = ImportJobConcurrencyCaps(max_total=8, max_per_tenant=2)
    caps.total_running = 2
    caps.per_tenant["t"] = 2
    caps.release("t")
    assert caps.total_running == 1
    assert caps.per_tenant.get("t") == 1
    caps.release("t")
    assert caps.total_running == 0
    assert "t" not in caps.per_tenant


@_requires_db
def test_claim_skips_third_job_when_per_tenant_cap_reached():
    """Third queued row for the same tenant is not claimed until a slot is released (#3307)."""
    db_url = os.environ["DATABASE_URL"]
    psycopg2 = pytest.importorskip("psycopg2")
    from psycopg2.extras import Json

    db = Database()
    db.connect()
    members = db.execute_query(
        "SELECT tenant_id::text AS tenant_id, user_id::text AS user_id FROM odb.tenant_users LIMIT 1"
    )
    if not members:
        pytest.skip("no tenant_users row")

    tenant_id = members[0]["tenant_id"]
    user_id = members[0]["user_id"]
    job_ids = [str(uuid.uuid4()) for _ in range(3)]
    payload = {
        "sourceKind": "openapi",
        "document": {"openapi": "3.0.0"},
        "project": {"name": "Cap Test", "slug": f"cap-{job_ids[0][:8]}"},
        "version": {"versionId": "1.0.0"},
        "options": {"selectedSchemas": [], "dryRun": True},
    }
    events = [{"type": "queued", "at": "2026-05-09T00:00:00+00:00"}]

    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor() as cur:
            for jid in job_ids:
                cur.execute(
                    """
                    INSERT INTO odb.import_jobs (
                        job_id, tenant_id, project_id, state, source_kind,
                        blob_sha, repository_source, input, events,
                        percent, created_by
                    )
                    VALUES (
                        %s::uuid, %s::uuid, NULL, 'queued', 'openapi',
                        NULL, NULL, %s::jsonb, %s::jsonb,
                        0, %s::uuid
                    )
                    """,
                    (jid, tenant_id, Json(payload), Json(events), user_id),
                )
        conn.commit()
    finally:
        conn.close()

    caps = ImportJobConcurrencyCaps(max_total=8, max_per_tenant=2)
    try:
        r1 = db.claim_import_job_with_caps(caps)
        r2 = db.claim_import_job_with_caps(caps)
        r3 = db.claim_import_job_with_caps(caps)
        assert r1 is not None and r2 is not None
        assert r3 is None
        tid = str(r1["tenant_id"])
        caps.release(tid)
        r4 = db.claim_import_job_with_caps(caps)
        assert r4 is not None
        assert str(r4["job_id"]) == job_ids[2]
    finally:
        conn = psycopg2.connect(db_url)
        try:
            with conn.cursor() as cur:
                for jid in job_ids:
                    cur.execute("DELETE FROM odb.import_jobs WHERE job_id = %s::uuid", (jid,))
            conn.commit()
        finally:
            conn.close()
