"""REPO-10.4 — Scanned repository report export (async job, CSV or NDJSON lines)."""

from __future__ import annotations

import csv
import io
import json
import secrets
import time
from threading import RLock
from typing import Any, Dict, Optional, Tuple

from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException, Query, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator

from ..auth import validate_authentication
from ..database import db

_MAX_ROWS = 100_000
# Larger exports use BackgroundTasks; small/medium runs in-request (TestClient + fast UX).
_INLINE_EXPORT_MAX_ROWS = 10_000
_EXPORT: Dict[str, list[dict[str, Any]]] = {}
_EXPORT_LOCK = RLock()  # _build re-enters from create while the job row is under the same lock scope


def reset_scan_report_export_state_for_tests() -> None:
    with _EXPORT_LOCK:
        for k in list(_EXPORT):
            _EXPORT[k].clear()


def _ts_utc() -> str:
    return time.strftime("%Y%m%d%H%M%S", time.gmtime())


class ScanReportExportFilter(BaseModel):
    model_config = ConfigDict(extra="forbid")
    provider: str = "all"
    status: str = "all"
    search: str = ""


class ScanWindow(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")
    from_field: str | None = Field(None, alias="from", validation_alias="from")
    to: str | None = None

    @field_validator("from_field", "to", mode="before")
    @classmethod
    def empty_to_none(cls, v: str | None) -> str | None:
        if v is None or (isinstance(v, str) and not v.strip()):
            return None
        return v if isinstance(v, str) else None


class ScanReportExportRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")
    format: str
    filter: ScanReportExportFilter = Field(default_factory=ScanReportExportFilter)
    scanWindow: Optional[ScanWindow] = Field(
        default=None, validation_alias="scan_window", serialization_alias="scanWindow"
    )


def _row_csv(row: dict[str, Any]) -> dict[str, str]:
    c = row.get("confidence")
    c_s = "" if c is None else str(c)
    return {
        "repository": str(row.get("repository", "")),
        "provider": str(row.get("provider", "")),
        "branch": str(row.get("branch", "")),
        "scan_id": str(row.get("scan_id", "")),
        "scanned_at": str(row.get("scanned_at", "")),
        "path": str(row.get("path", "")),
        "format": str(row.get("format", "")),
        "confidence": c_s,
        "status": str(row.get("status", "")),
        "content_checksum": str(row.get("content_checksum", "")),
        "last_imported_version": str(row.get("last_imported_version", "")),
        "attention_reasons": str(row.get("attention_reasons", "")),
    }


def _bytes_csv(rows: list[dict[str, Any]]) -> bytes:
    s = io.StringIO()
    headers = [
        "repository",
        "provider",
        "branch",
        "scan_id",
        "scanned_at",
        "path",
        "format",
        "confidence",
        "status",
        "content_checksum",
        "last_imported_version",
        "attention_reasons",
    ]
    w = csv.DictWriter(s, fieldnames=headers, lineterminator="\r\n")
    w.writeheader()
    for r in rows:
        w.writerow(_row_csv(r))
    return s.getvalue().encode("utf-8")


def _bytes_ndjson(rows: list[dict[str, Any]]) -> bytes:
    s = io.StringIO()
    for r in rows:
        pl = r.get("payload") or {}
        o = {k: v for k, v in r.items() if k not in ("payload",)}
        o["file"] = pl
        s.write(json.dumps(o, ensure_ascii=False) + "\n")
    return s.getvalue().encode("utf-8")


def _jobs(tenant_id: str) -> list[dict[str, Any]]:
    with _EXPORT_LOCK:
        return _EXPORT.setdefault(tenant_id, [])


def _get(tid: str, eid: str) -> dict[str, Any] | None:
    with _EXPORT_LOCK:
        for j in _EXPORT.get(tid, []):
            if str(j.get("id")) == eid:
                return j
    return None


def _find_by_token(export_id: str, token: str) -> Tuple[Optional[str], Optional[dict[str, Any]]]:
    with _EXPORT_LOCK:
        items = list(_EXPORT.items())
    for tid, lst in items:
        for j in lst:
            if j.get("id") == export_id and j.get("downloadToken") == token:
                return str(tid), j
    return None, None


def _build_job(
    tid: str,
    eid: str,
) -> None:
    from .. import repositories_routes as rr  # local import: circular

    j = _get(tid, eid)
    if not j or j.get("cancelled"):
        with _EXPORT_LOCK:
            j0 = _get(tid, eid)
        if j0 and j0.get("cancelled"):
            j0["status"] = "cancelled"
        return
    req: dict[str, Any] = j.get("request") or {}
    f0 = (req.get("filter") or {}) or {}
    sw0 = (req.get("scanWindow") or None) or (req.get("scan_window") or None) or None
    scan_from = None
    scan_to = None
    if isinstance(sw0, dict):
        scan_from = sw0.get("from")
        scan_to = sw0.get("to")
    fmt0 = (req.get("format") or "csv").lower()
    j["status"] = "running"
    nexp = int(j.get("expectedRows") or 0)
    rows: list[dict[str, Any]] = []
    try:
        n = 0
        for row in rr.iter_scan_report_export_rows(
            tid,
            provider=str(f0.get("provider") or "all"),
            status=str(f0.get("status") or "all"),
            search=str(f0.get("search") or ""),
            scan_from=scan_from,
            scan_to=scan_to,
        ):
            j1 = _get(tid, eid)
            if not j1 or j1.get("cancelled"):
                with _EXPORT_LOCK:
                    j2 = _get(tid, eid)
                if j2 and j2.get("cancelled"):
                    j2["status"] = "cancelled"
                return
            rows.append(row)
            n += 1
            if nexp and n % 2000 == 0:
                j1 = _get(tid, eid)
                if j1 and not j1.get("cancelled"):
                    j1["progress"] = min(99, 5 + (n * 90) // max(1, nexp))
    except Exception as e:  # noqa: BLE001
        j3 = _get(tid, eid)
        if j3 and not j3.get("cancelled"):
            j3["status"] = "failed"
            j3["error"] = str(e)
        return
    j4 = _get(tid, eid)
    if not j4 or j4.get("cancelled"):
        with _EXPORT_LOCK:
            j4 = _get(tid, eid)
        if j4 and j4.get("cancelled"):
            j4["status"] = "cancelled"
        return
    try:
        body = _bytes_csv(rows) if fmt0 == "csv" else _bytes_ndjson(rows)
    except Exception as e:  # noqa: BLE001
        j4["status"] = "failed"
        j4["error"] = str(e)
        return
    j4["bytes"] = body
    j4["rowCount"] = len(rows)
    j4["status"] = "completed"
    j4["progress"] = 100
    j4["completedAt"] = rr._utc_now_iso()  # type: ignore[attr-defined]


def register_routes(router: APIRouter) -> None:
    from .. import repositories_routes as rr  # noqa: WPS433

    SCOPE = rr._REPOSITORY_SCOPE_READ

    @router.post("/{tenant_slug}/scan-reports:export", status_code=202)
    def create_scan_report_export(
        tenant_slug: str,
        request: ScanReportExportRequest = Body(...),
        auth_data: dict[str, Any] = Depends(validate_authentication),
        background_tasks: BackgroundTasks = BackgroundTasks(),  # noqa: B008
    ) -> JSONResponse:
        if request.format not in ("csv", "json"):
            raise HTTPException(
                status_code=400, detail="format must be 'csv' or 'json' (ndjson for json).",
            )
        rr._require_repository_scope(auth_data, SCOPE)  # type: ignore[attr-defined]
        tid = str(auth_data["tenant_id"])
        f = request.filter
        sfa = sfb = None
        if request.scanWindow is not None:
            sfa, sfb = request.scanWindow.from_field, request.scanWindow.to
        n = rr.count_scan_report_export_row_candidates(
            tid, provider=f.provider, status=f.status, search=f.search, scan_from=sfa, scan_to=sfb
        )
        if n > _MAX_ROWS:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "EXPORT_ROW_CAP_EXCEEDED",
                    "message": f"Narrow the filter: {n} rows exceeds cap {_MAX_ROWS}.",
                    "rowCount": n,
                    "maxRows": _MAX_ROWS,
                },
            )
        eid = secrets.token_hex(12)
        tok = secrets.token_urlsafe(32)
        pl = request.model_dump(mode="json", by_alias=True)
        job: dict[str, Any] = {
            "id": eid,
            "format": request.format,
            "status": "pending",
            "createdAt": rr._utc_now_iso(),  # type: ignore[attr-defined]
            "completedAt": None,
            "rowCount": None,
            "expectedRows": n,
            "progress": 0,
            "error": None,
            "request": pl,
            "downloadToken": tok,
            "tenantSlug": tenant_slug,
            "contentType": (
                "text/csv; charset=utf-8" if request.format == "csv" else "application/x-ndjson; charset=utf-8"
            ),
            "fileName": f"scan-reports-{_ts_utc()}.{'csv' if request.format == 'csv' else 'ndjson'}",
        }
        with _EXPORT_LOCK:
            lst = _jobs(tid)
            lst.insert(0, job)
            if len(lst) > 50:
                lst.pop()
        act = rr._resolve_actor_id(auth_data)  # type: ignore[attr-defined]
        try:
            db.insert_workflow_audit(
                tid,
                None,
                None,
                "repository.scan_report.export_started",
                "success",
                act,
                {"exportJobId": eid, "format": request.format, "rowEstimate": n},
            )
        except Exception:
            pass

        def _ready_audit() -> None:
            j0 = _get(tid, eid)
            if not j0 or j0.get("status") != "completed" or j0.get("rowCount") is None:
                return
            try:
                db.insert_workflow_audit(
                    tid,
                    None,
                    None,
                    "repository.scan_report.export_ready",
                    "success",
                    act,
                    {
                        "exportJobId": eid,
                        "format": j0.get("format"),
                        "rowCount": j0.get("rowCount"),
                    },
                )
            except Exception:
                pass

        if n <= _INLINE_EXPORT_MAX_ROWS:
            _build_job(tid, eid)
            _ready_audit()
        else:

            def _bg() -> None:
                _build_job(tid, eid)
                _ready_audit()

            background_tasks.add_task(_bg)
        return JSONResponse(status_code=202, content={"exportJobId": eid})

    @router.get("/{tenant_slug}/scan-reports/exports")
    def list_scan_report_exports(
        tenant_slug: str, auth_data: dict[str, Any] = Depends(validate_authentication)
    ) -> dict[str, Any]:
        _ = tenant_slug
        rr._require_repository_scope(auth_data, SCOPE)  # type: ignore[attr-defined]
        tid = str(auth_data["tenant_id"])
        items: list[dict[str, Any]] = []
        for j in _jobs(tid)[:20]:
            items.append(
                {
                    "id": j.get("id"),
                    "format": j.get("format"),
                    "status": j.get("status"),
                    "createdAt": j.get("createdAt"),
                    "completedAt": j.get("completedAt"),
                    "rowCount": j.get("rowCount"),
                    "expectedRows": j.get("expectedRows"),
                    "progress": j.get("progress", 0),
                    "error": j.get("error"),
                }
            )
        return {"items": items, "total": len(items)}

    @router.get("/{tenant_slug}/scan-reports/exports/{export_id}")
    def get_scan_report_export(
        tenant_slug: str, export_id: str, auth_data: dict[str, Any] = Depends(validate_authentication)
    ) -> dict[str, Any]:
        _ = tenant_slug
        rr._require_repository_scope(auth_data, SCOPE)  # type: ignore[attr-defined]
        tid = str(auth_data["tenant_id"])
        j0 = _get(tid, export_id)
        if not j0:
            raise HTTPException(status_code=404, detail="Export not found")
        o = {k: v for k, v in j0.items() if k not in ("bytes", "downloadToken", "tenantSlug")}
        o["downloadUrl"] = (
            f"/v1/repositories/{tenant_slug}/scan-reports/exports/{export_id}/content"
            f"?token={j0.get('downloadToken', '')}"
        )
        return o

    @router.get("/{tenant_slug}/scan-reports/exports/{export_id}/content")
    def download_scan_report_export(
        tenant_slug: str, export_id: str, token: str = Query(..., min_length=1)
    ) -> Response:
        t2, j0 = _find_by_token(export_id, token)
        if not t2 or not j0 or j0.get("downloadToken") != token:
            raise HTTPException(status_code=404, detail="Not found or invalid token")
        # Verify the token belongs to the requested tenant to prevent cross-tenant access.
        if j0.get("tenantSlug") and j0.get("tenantSlug") != tenant_slug:
            raise HTTPException(status_code=404, detail="Not found or invalid token")
        status0 = str(j0.get("status") or "")
        b0 = j0.get("bytes")
        if status0 != "completed" or b0 is None:
            raise HTTPException(
                status_code=409, detail="Export is still building; call GET for status first.",
            )
        raw: bytes
        if isinstance(b0, (bytes, bytearray)):
            raw = bytes(b0)
        else:
            raw = str(b0).encode("utf-8")
        fn = str(j0.get("fileName") or "export")
        return Response(
            content=raw,
            media_type=str(j0.get("contentType") or "application/octet-stream"),
            headers={"Content-Disposition": f'attachment; filename="{fn}"'},
        )

    @router.post("/{tenant_slug}/scan-reports/exports/{export_id}:cancel")
    def cancel_scan_report_export(
        tenant_slug: str, export_id: str, auth_data: dict[str, Any] = Depends(validate_authentication)
    ) -> JSONResponse:
        _ = tenant_slug
        rr._require_repository_scope(auth_data, SCOPE)  # type: ignore[attr-defined]
        tid = str(auth_data["tenant_id"])
        j0 = _get(tid, export_id)
        if not j0:
            raise HTTPException(status_code=404, detail="Export not found")
        s = j0.get("status")
        if s in ("completed", "failed", "cancelled"):
            return JSONResponse(status_code=200, content={"ok": True, "status": s})
        j0["cancelled"] = True
        if s == "pending":
            j0["status"] = "cancelled"
        elif s == "running":
            j0["status"] = "cancelling"
        return JSONResponse(status_code=200, content={"ok": True, "status": j0["status"]})

    @router.post("/{tenant_slug}/scan-reports/exports/{export_id}:retry", status_code=202)
    def retry_scan_report_export(
        tenant_slug: str,
        export_id: str,
        auth_data: dict[str, Any] = Depends(validate_authentication),
        background_tasks: BackgroundTasks = BackgroundTasks(),  # noqa: B008
    ) -> JSONResponse:
        rr._require_repository_scope(auth_data, SCOPE)  # type: ignore[attr-defined]
        tid = str(auth_data["tenant_id"])
        old = _get(tid, export_id)
        if not old or "request" not in old:
            raise HTTPException(status_code=404, detail="No export to clone.")
        p0: dict[str, Any] = old.get("request") or {}
        f0 = (p0.get("filter") or {}) or {}
        sw0 = (p0.get("scanWindow") or None) or (p0.get("scan_window") or None) or None
        sfa2 = sfb2 = None
        if isinstance(sw0, dict):
            sfa2, sfb2 = sw0.get("from"), sw0.get("to")
        n2 = rr.count_scan_report_export_row_candidates(
            tid,
            provider=str(f0.get("provider") or "all"),
            status=str(f0.get("status") or "all"),
            search=str(f0.get("search") or ""),
            scan_from=sfa2,
            scan_to=sfb2,
        )
        if n2 > _MAX_ROWS:
            raise HTTPException(
                status_code=400, detail={"code": "EXPORT_ROW_CAP_EXCEEDED", "message": "Narrow the filter."},
            )
        e2 = secrets.token_hex(12)
        tok2 = secrets.token_urlsafe(32)
        fmt0 = str(p0.get("format") or "csv").lower()
        njob: dict[str, Any] = {
            "id": e2,
            "format": fmt0,
            "status": "pending",
            "createdAt": rr._utc_now_iso(),  # type: ignore[attr-defined]
            "completedAt": None,
            "rowCount": None,
            "expectedRows": n2,
            "progress": 0,
            "error": None,
            "request": p0,
            "downloadToken": tok2,
            "tenantSlug": tenant_slug,
            "contentType": (
                "text/csv; charset=utf-8" if fmt0 == "csv" else "application/x-ndjson; charset=utf-8"
            ),
            "fileName": f"scan-reports-{_ts_utc()}.{'csv' if fmt0 == 'csv' else 'ndjson'}",
        }
        with _EXPORT_LOCK:
            _jobs(tid).insert(0, njob)
        act = rr._resolve_actor_id(auth_data)  # type: ignore[attr-defined]

        def _ready2() -> None:
            j0 = _get(tid, e2)
            if not j0 or j0.get("status") != "completed" or j0.get("rowCount") is None:
                return
            try:
                db.insert_workflow_audit(
                    tid,
                    None,
                    None,
                    "repository.scan_report.export_ready",
                    "success",
                    act,
                    {
                        "exportJobId": e2,
                        "format": j0.get("format"),
                        "rowCount": j0.get("rowCount"),
                    },
                )
            except Exception:
                pass

        if n2 <= _INLINE_EXPORT_MAX_ROWS:
            _build_job(tid, e2)
            _ready2()
        else:

            def _bgr() -> None:
                _build_job(tid, e2)
                _ready2()

            background_tasks.add_task(_bgr)
        return JSONResponse(status_code=202, content={"exportJobId": e2})
