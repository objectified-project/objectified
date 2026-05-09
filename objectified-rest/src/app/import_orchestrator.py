"""
Import job orchestrator: claim queued rows, spawn objectified-importer sidecar, stream NDJSON (#3307).

Workers run as FastAPI startup tasks; configuration is read from environment at startup time.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import os
import shlex
import signal
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from .config import settings
from .database import Database, ImportJobConcurrencyCaps

_LOG = logging.getLogger(__name__)

_EVENTS_CAP = 1000

_active_tasks: List[asyncio.Task[Any]] = []
_stop = asyncio.Event()
_caps: Optional[ImportJobConcurrencyCaps] = None
_active_subprocesses: Set[asyncio.subprocess.Process] = set()
_subproc_lock = asyncio.Lock()


def _repo_root() -> Path:
    """Monorepo root (parent of ``objectified-rest``)."""
    return Path(__file__).resolve().parent.parent.parent.parent


def _default_run_js() -> Path:
    return _repo_root() / "objectified-importer" / "bin" / "run.js"


def _read_positive_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or not str(raw).strip():
        return default
    try:
        v = int(str(raw).strip(), 10)
        return v if v >= 0 else default
    except ValueError:
        return default


def orchestrator_worker_count() -> int:
    """Concurrent asyncio worker loops (0 disables orchestrator tasks)."""
    return _read_positive_int("OBJECTIFIED_IMPORT_WORKERS", 0)


def orchestrator_stale_seconds() -> int:
    return _read_positive_int("OBJECTIFIED_IMPORT_STALE_TIMEOUT", 600)


def orchestrator_max_per_tenant() -> int:
    v = _read_positive_int("OBJECTIFIED_IMPORT_MAX_PER_TENANT", 2)
    return max(1, v)


def orchestrator_max_total() -> int:
    v = _read_positive_int("OBJECTIFIED_IMPORT_MAX_TOTAL", 8)
    return max(1, v)


def _runner_command() -> List[str]:
    override = os.environ.get("OBJECTIFIED_IMPORT_RUNNER_CMD")
    if override and override.strip():
        return shlex.split(override)
    run_js = Path(os.environ["OBJECTIFIED_IMPORT_RUN_JS"]) if os.environ.get("OBJECTIFIED_IMPORT_RUN_JS") else _default_run_js()
    node = os.environ.get("OBJECTIFIED_IMPORT_NODE_BIN") or "node"
    return [node, str(run_js)]


def merge_job_input(row: Dict[str, Any]) -> Dict[str, Any]:
    """Build ImportJobInput JSON for the sidecar from persisted REST row."""
    raw = row.get("input")
    if not isinstance(raw, dict):
        raw = {}
    out = dict(raw)
    out["tenantId"] = str(row["tenant_id"])
    out["userId"] = str(row["created_by"])
    opts = out.get("options")
    if not isinstance(opts, dict):
        opts = {}
        out["options"] = opts
    if "selectedSchemas" not in opts:
        doc = out.get("document") if isinstance(out.get("document"), dict) else {}
        schemas = ((doc.get("components") or {}).get("schemas")) if isinstance(doc.get("components"), dict) else {}
        if isinstance(schemas, dict) and schemas:
            opts["selectedSchemas"] = list(schemas.keys())[:64]
        else:
            opts["selectedSchemas"] = []
    return out


def _percent_from_progress(progress: Dict[str, Any]) -> int:
    total = int(progress.get("total") or 0)
    completed = int(progress.get("completed") or 0)
    if total <= 0:
        return 0
    return min(100, int(100 * completed / total))


def _workflow_audit_job(
    db: Database,
    tenant_id: str,
    project_id: Optional[str],
    version_id: Optional[str],
    action: str,
    outcome: str,
    actor_id: Optional[str],
    detail: Optional[Dict[str, Any]],
) -> None:
    db.insert_workflow_audit(tenant_id, project_id, version_id, action, outcome, actor_id, detail)


async def _register_subprocess(proc: asyncio.subprocess.Process) -> None:
    async with _subproc_lock:
        _active_subprocesses.add(proc)


async def _unregister_subprocess(proc: asyncio.subprocess.Process) -> None:
    async with _subproc_lock:
        _active_subprocesses.discard(proc)


async def _terminate_active_subprocesses() -> None:
    async with _subproc_lock:
        procs = list(_active_subprocesses)
    for p in procs:
        if p.returncode is None:
            try:
                p.send_signal(signal.SIGTERM)
            except ProcessLookupError:
                pass


def _parse_ndjson_line(line: bytes) -> Optional[Dict[str, Any]]:
    if not line.strip():
        return None
    try:
        obj = json.loads(line.decode("utf-8"))
    except json.JSONDecodeError:
        return None
    return obj if isinstance(obj, dict) else None


async def _poll_cancel_requested(
    db: Database,
    tenant_id: str,
    job_id: str,
    proc: asyncio.subprocess.Process,
    stop: asyncio.Event,
) -> None:
    while not stop.is_set() and proc.returncode is None:
        await asyncio.sleep(0.3)
        row = await asyncio.to_thread(db.get_import_job_row, tenant_id, job_id)
        if row and str(row.get("state")) == "canceled":
            _LOG.info(
                "import cancel propagated",
                extra={"job_id": job_id, "tenant_id": tenant_id, "phase": "cancel", "percent": row.get("percent")},
            )
            try:
                proc.send_signal(signal.SIGTERM)
            except ProcessLookupError:
                pass
            return


async def run_import_sidecar(
    db: Database,
    row: Dict[str, Any],
) -> Tuple[int, List[str]]:
    """
    Spawn importer subprocess; stream stdout NDJSON into ``db`` updates.

    Returns (exit_code, stderr_lines).
    """
    job_id = str(row["job_id"])
    tenant_id = str(row["tenant_id"])
    cmd = _runner_command()
    env = os.environ.copy()
    env["OBJECTIFIED_IMPORTER_ORCHESTRATOR"] = "1"

    inp = merge_job_input(row)
    envelope = {
        "schemaVersion": 1,
        "jobId": job_id,
        "input": inp,
        "dbConfig": {"connectionString": settings.effective_database_url},
    }
    payload = json.dumps(envelope, separators=(",", ":"), ensure_ascii=False).encode("utf-8")

    _LOG.info(
        "import subprocess spawn",
        extra={
            "job_id": job_id,
            "tenant_id": tenant_id,
            "phase": "spawn",
            "percent": row.get("percent"),
            "subprocess_pid": None,
        },
    )

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env,
        cwd=str(_repo_root()),
    )
    await _register_subprocess(proc)
    pid = proc.pid
    _LOG.info(
        "import subprocess started",
        extra={"job_id": job_id, "tenant_id": tenant_id, "phase": "running", "percent": row.get("percent"), "subprocess_pid": pid},
    )

    stderr_tail: List[str] = []

    async def _drain_stderr() -> None:
        assert proc.stderr is not None
        while True:
            line = await proc.stderr.readline()
            if not line:
                break
            try:
                stderr_tail.append(line.decode("utf-8", errors="replace").rstrip())
            except Exception:
                continue

    stderr_task = asyncio.create_task(_drain_stderr())

    stop_watch = asyncio.Event()
    watcher = asyncio.create_task(_poll_cancel_requested(db, tenant_id, job_id, proc, stop_watch))

    assert proc.stdin is not None
    proc.stdin.write(payload)
    await proc.stdin.drain()
    proc.stdin.close()

    saw_terminal = False
    terminal_state: Optional[str] = None

    assert proc.stdout is not None
    try:
        while True:
            line = await proc.stdout.readline()
            if not line:
                break
            await asyncio.to_thread(db.import_job_touch_updated_at, tenant_id, job_id)
            msg = _parse_ndjson_line(line)
            if not msg:
                continue
            mtype = msg.get("type")
            if mtype == "event" and isinstance(msg.get("event"), dict):
                await asyncio.to_thread(db.import_job_append_events, tenant_id, job_id, [msg["event"]], cap=_EVENTS_CAP)
                ev = msg["event"]
                pct = ev.get("percent") if isinstance(ev.get("percent"), int) else None
                extra = {"job_id": job_id, "tenant_id": tenant_id, "phase": "event", "percent": pct}
                _LOG.info("import ndjson event", extra=extra)
            elif mtype == "progress" and isinstance(msg.get("progress"), dict):
                prog = msg["progress"]
                pct = _percent_from_progress(prog)
                await asyncio.to_thread(db.import_job_set_progress, tenant_id, job_id, prog, pct)
                _LOG.info(
                    "import ndjson progress",
                    extra={
                        "job_id": job_id,
                        "tenant_id": tenant_id,
                        "phase": prog.get("phase") or "progress",
                        "percent": pct,
                        "subprocess_pid": pid,
                    },
                )
            elif mtype == "error" and isinstance(msg.get("code"), str):
                cur_err = await asyncio.to_thread(db.get_import_job_row, tenant_id, job_id)
                if cur_err and str(cur_err.get("state")) == "canceled":
                    saw_terminal = True
                    terminal_state = "canceled"
                    break
                err = {"code": msg["code"], "message": str(msg.get("message") or ""), "context": msg.get("context") or {}}
                await asyncio.to_thread(
                    db.import_job_apply_terminal,
                    tenant_id,
                    job_id,
                    state="failed",
                    error=err,
                    finished_now=True,
                )
                _LOG.warning(
                    "import ndjson error",
                    extra={"job_id": job_id, "tenant_id": tenant_id, "phase": "error", "percent": row.get("percent")},
                )
            elif mtype == "result":
                state = str(msg.get("state") or "failed")
                summary = msg.get("summary")
                result_payload = msg.get("result") if isinstance(msg.get("result"), dict) else None
                finished = state in ("completed", "failed", "canceled", "rolled-back")
                pct: Optional[int] = 100 if state == "completed" else None

                cur = await asyncio.to_thread(db.get_import_job_row, tenant_id, job_id)
                if cur and str(cur.get("state")) == "canceled":
                    saw_terminal = True
                    terminal_state = "canceled"
                    break

                if state == "pending-approval":
                    summ = summary if isinstance(summary, dict) else {"raw": summary}
                    await asyncio.to_thread(
                        db.import_job_apply_terminal,
                        tenant_id,
                        job_id,
                        state="pending-approval",
                        summary=summ,
                        result=result_payload,
                        percent=None,
                        finished_now=False,
                        clear_error=True,
                    )
                    saw_terminal = False
                    continue

                await asyncio.to_thread(
                    db.import_job_apply_terminal,
                    tenant_id,
                    job_id,
                    state=state,
                    summary=summary if isinstance(summary, dict) else {"raw": summary},
                    result=result_payload,
                    finished_now=finished,
                    percent=pct,
                    clear_error=state == "completed",
                )
                saw_terminal = finished
                terminal_state = state

                _LOG.info(
                    "import ndjson result",
                    extra={"job_id": job_id, "tenant_id": tenant_id, "phase": state, "percent": pct or 0, "subprocess_pid": pid},
                )

                actor_id = str(row.get("created_by")) if row.get("created_by") else None
                project_uuid: Optional[str] = None
                version_uuid: Optional[str] = None
                if isinstance(result_payload, dict):
                    project_uuid = result_payload.get("projectId") or result_payload.get("project_id")
                    version_uuid = result_payload.get("versionId") or result_payload.get("version_id")

                if state == "completed" and project_uuid and version_uuid:
                    repo_src = row.get("repository_source")
                    if isinstance(repo_src, dict):
                        rid = str(repo_src.get("repositoryId") or repo_src.get("repository_id") or "").strip()
                        branch = str(repo_src.get("branch") or "")
                        path = str(repo_src.get("path") or "")
                        blob = repo_src.get("blobSha") or repo_src.get("blob_sha")
                        blob_s = str(blob).strip() if blob else None
                        if rid:
                            await asyncio.to_thread(
                                db.insert_tenant_repository_import_if_owned,
                                tenant_id=tenant_id,
                                repository_id=rid,
                                branch=branch,
                                path=path,
                                blob_sha=blob_s,
                                project_id=str(project_uuid),
                                version_id=str(version_uuid),
                                imported_by=str(row.get("created_by")),
                            )
                    _workflow_audit_job(
                        db,
                        tenant_id,
                        str(project_uuid),
                        str(version_uuid),
                        "import.job.complete",
                        "success",
                        actor_id,
                        {"jobId": job_id, "projectId": str(project_uuid), "versionId": str(version_uuid)},
                    )
                elif state == "failed":
                    _workflow_audit_job(
                        db,
                        tenant_id,
                        row.get("project_id"),
                        None,
                        "import.job.failed",
                        "failure",
                        actor_id,
                        {"jobId": job_id},
                    )

                if finished:
                    break
    finally:
        stop_watch.set()
        watcher.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await watcher
        await stderr_task
        await _unregister_subprocess(proc)

    code = await proc.wait()
    if not saw_terminal:
        cur = await asyncio.to_thread(db.get_import_job_row, tenant_id, job_id)
        if cur and str(cur.get("state")) == "canceled":
            return code, stderr_tail
        err = {"code": "subprocess-exit", "message": f"Importer exited without terminal NDJSON (code {code})"}
        await asyncio.to_thread(
            db.import_job_apply_terminal,
            tenant_id,
            job_id,
            state="failed",
            error=err,
            finished_now=True,
        )
    elif terminal_state == "completed":
        pass

    return code, stderr_tail


async def _run_single_job(caps: ImportJobConcurrencyCaps, row: Dict[str, Any]) -> None:
    db = Database()
    db.connect()
    tenant_id = str(row["tenant_id"])
    job_id = str(row["job_id"])
    try:
        await run_import_sidecar(db, row)
    except asyncio.CancelledError:
        raise
    except Exception:
        _LOG.exception("import job crashed job_id=%s tenant_id=%s", job_id, tenant_id)
        err = {"code": "orchestrator-exception", "message": "Orchestrator crashed processing import"}
        await asyncio.to_thread(
            db.import_job_apply_terminal,
            tenant_id,
            job_id,
            state="failed",
            error=err,
            finished_now=True,
        )
    finally:
        caps.release(tenant_id)


async def _worker_loop(worker_id: int, caps: ImportJobConcurrencyCaps) -> None:
    log = _LOG
    while not _stop.is_set():
        db = Database()
        db.connect()
        row = await asyncio.to_thread(db.claim_import_job_with_caps, caps)
        if row is None:
            await asyncio.sleep(0.12)
            continue
        log.info("claimed import job worker=%s job_id=%s", worker_id, row.get("job_id"))
        await _run_single_job(caps, row)


async def _stale_sweep_loop() -> None:
    while not _stop.is_set():
        await asyncio.sleep(30)
        if _stop.is_set():
            break
        stale_after = orchestrator_stale_seconds()
        try:

            def _sweep() -> int:
                d = Database()
                d.connect()
                try:
                    return d.mark_stale_running_import_jobs_failed(stale_after)
                finally:
                    d.close()

            n = await asyncio.to_thread(_sweep)
            if n:
                _LOG.warning("marked stale import jobs failed count=%s", n)
        except Exception:
            _LOG.exception("stale import sweep failed")


def start_import_orchestrator_tasks() -> None:
    """Spawn worker tasks (call from FastAPI startup)."""
    global _caps, _active_tasks
    if _active_tasks:
        _LOG.warning("import orchestrator start skipped: tasks already running")
        return
    n = orchestrator_worker_count()
    if n <= 0:
        _LOG.info("import orchestrator disabled (OBJECTIFIED_IMPORT_WORKERS=%s)", os.environ.get("OBJECTIFIED_IMPORT_WORKERS"))
        return
    _caps = ImportJobConcurrencyCaps(orchestrator_max_total(), orchestrator_max_per_tenant())
    _active_tasks = [asyncio.create_task(_worker_loop(i, _caps), name=f"import-orchestrator-worker-{i}") for i in range(n)]
    _active_tasks.append(asyncio.create_task(_stale_sweep_loop(), name="import-orchestrator-stale"))
    _LOG.info(
        "import orchestrator started workers=%s max_total=%s max_per_tenant=%s",
        n,
        orchestrator_max_total(),
        orchestrator_max_per_tenant(),
    )


async def shutdown_import_orchestrator_tasks() -> None:
    """Cancel workers and SIGTERM running importer children."""
    global _stop
    _stop.set()
    await _terminate_active_subprocesses()
    for t in _active_tasks:
        t.cancel()
    for t in _active_tasks:
        with contextlib.suppress(asyncio.CancelledError):
            await t
    _active_tasks.clear()
    _stop = asyncio.Event()


async def run_standalone_orchestrator() -> None:
    """Entry point for ``python -m app.import_runner`` (long-running worker only)."""
    db = Database()
    db.connect()
    start_import_orchestrator_tasks()
    try:
        await asyncio.Future()
    finally:
        await shutdown_import_orchestrator_tasks()
        db.close()
