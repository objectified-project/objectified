"""REPO-12.4 / #2937: bounded payload + totals for ``odb.repository_scan_report``."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Callable, Dict, Mapping, Optional, Sequence, Tuple

# Bounded per Epic E — larger repos persist full rows via ``payload_overflow_url``.
SCAN_REPORT_PAYLOAD_MAX_FILE_ROWS = 5000


def attention_score_from_totals_json(totals: Mapping[str, Any], *, scan_failed: bool) -> int:
    """0–100 score derived from persisted ``totals_json`` (Epic D widgets)."""
    if scan_failed:
        return min(100, 25)
    failing = int(totals.get("parse_error", 0) or 0) + int(totals.get("manifest_error", 0) or 0)
    ignored = int(totals.get("ignored", 0) or 0)
    skipped = int(totals.get("skipped_unchecksummed", 0) or 0)
    return int(min(100, failing * 12 + ignored * 4 + skipped * 8))


def build_totals_json(
    *,
    file_rows: Sequence[Mapping[str, Any]],
    imported_count: int,
    scan_failed: bool,
) -> Dict[str, int]:
    """
    Keys match REPO-12.4: discovered, importable, parse_error, manifest_error,
    ignored, unchanged, imported, skipped_unchecksummed.
    """
    if scan_failed:
        return {
            "discovered": 0,
            "importable": 0,
            "parse_error": 0,
            "manifest_error": 0,
            "ignored": 0,
            "unchanged": 0,
            "imported": 0,
            "skipped_unchecksummed": 0,
        }

    discovered = len(file_rows)
    importable = 0
    parse_error = 0
    manifest_error = 0
    ignored = 0
    unchanged = 0
    skipped_unchecksummed = 0

    for raw in file_rows:
        row = dict(raw)
        status = str(row.get("status") or "")
        tracked = bool(row.get("tracked", True))
        conf = row.get("confidence")
        try:
            c = float(conf) if conf is not None else 0.0
        except (TypeError, ValueError):
            c = 0.0
        fmt = row.get("format")
        has_format = fmt is not None and (not isinstance(fmt, str) or bool(fmt.strip()))
        is_high_conf = c >= 0.5 and has_format

        if not tracked:
            ignored += 1
            continue

        if status == "parse_error":
            parse_error += 1
        elif status == "manifest_error":
            manifest_error += 1
        elif status == "unchanged":
            unchanged += 1

        if is_high_conf and status not in ("parse_error", "manifest_error"):
            importable += 1

        checksum = row.get("content_checksum") or row.get("contentChecksum")
        import_enabled = bool(row.get("import_enabled") or row.get("importEnabled"))
        if tracked and import_enabled and not (isinstance(checksum, str) and len(checksum.strip()) >= 64):
            skipped_unchecksummed += 1

    return {
        "discovered": discovered,
        "importable": importable,
        "parse_error": parse_error,
        "manifest_error": manifest_error,
        "ignored": ignored,
        "unchanged": unchanged,
        "imported": int(imported_count),
        "skipped_unchecksummed": skipped_unchecksummed,
    }


def file_row_to_payload_row(row: Mapping[str, Any]) -> Dict[str, Any]:
    """Single file row stored in ``payload_json`` or overflow blob."""
    out: Dict[str, Any] = {
        "path": row.get("path"),
        "format": row.get("format"),
        "status": row.get("status"),
        "tracked": row.get("tracked"),
        "importable": bool(row.get("importable"))
        if "importable" in row
        else None,
        "content_checksum": row.get("content_checksum") or row.get("contentChecksum"),
        "import_enabled": row.get("import_enabled") if "import_enabled" in row else row.get("importEnabled"),
        "confidence": row.get("confidence"),
        "project_slug": row.get("project_slug") or row.get("projectSlug"),
        "version_strategy": row.get("version_strategy") or row.get("versionStrategy"),
    }
    # Compute importable when not provided (mirror routes heuristics).
    if out["importable"] is None:
        fmt = out["format"]
        has_format = fmt is not None and (not isinstance(fmt, str) or bool(str(fmt).strip()))
        conf = out["confidence"]
        try:
            c = float(conf) if conf is not None else 0.0
        except (TypeError, ValueError):
            c = 0.0
        st = str(out.get("status") or "")
        out["importable"] = bool(
            bool(out.get("tracked", True))
            and c >= 0.5
            and has_format
            and st not in ("parse_error", "manifest_error")
        )
    return out


def prepare_bounded_payload_json(
    file_rows: Sequence[Mapping[str, Any]],
    *,
    totals_json: Mapping[str, Any],
    write_overflow: Callable[[bytes], str],
) -> Tuple[Dict[str, Any], Optional[str]]:
    """
    Returns ``(payload_json, payload_overflow_url)``.
    When len(file_rows) > SCAN_REPORT_PAYLOAD_MAX_FILE_ROWS, writes full JSON array to overflow and
    stores a summary object in ``payload_json``.
    """
    rows_sorted = sorted(file_rows, key=lambda r: str((r.get("path") or "")).lower())
    payload_rows = [file_row_to_payload_row(r) for r in rows_sorted]

    if len(payload_rows) <= SCAN_REPORT_PAYLOAD_MAX_FILE_ROWS:
        return {"files": payload_rows}, None

    body = json.dumps(payload_rows, separators=(",", ":")).encode("utf-8")
    overflow_url = write_overflow(body)
    sample = payload_rows[: min(200, SCAN_REPORT_PAYLOAD_MAX_FILE_ROWS)]
    summary: Dict[str, Any] = {
        "kind": "overflow",
        "rowCount": len(payload_rows),
        "truncatedSample": sample,
        "totals": dict(totals_json),
    }
    return summary, overflow_url


def default_overflow_writer_factory(
    *,
    root: Path,
    public_base_url: str,
    tenant_id: str,
    repository_id: str,
    scan_id: str,
) -> Callable[[bytes], str]:
    """Writes overflow JSON next to other scans; returns a stable synthetic signed-URL shape."""

    def _write(body: bytes) -> str:
        safe = root / tenant_id / repository_id
        safe.mkdir(parents=True, exist_ok=True)
        path = safe / f"{scan_id}.json"
        path.write_bytes(body)
        rel = f"{tenant_id}/{repository_id}/{scan_id}.json"
        base = public_base_url.rstrip("/")
        return f"{base}/{rel}"

    return _write


def effective_overflow_root(settings_root: Optional[str]) -> Path:
    base = settings_root or os.path.join(os.environ.get("TMPDIR", "/tmp"), "objectified-scan-report-overflow")
    return Path(base)


def estimate_json_bytes(payload_obj: Any) -> int:
    return len(json.dumps(payload_obj, separators=(",", ":")).encode("utf-8"))
