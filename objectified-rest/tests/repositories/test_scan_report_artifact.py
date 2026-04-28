"""Unit tests for REPO-12.4 scan report payload bounds (no database required)."""

from pathlib import Path

from app.repositories.scan_report_artifact import (
    SCAN_REPORT_PAYLOAD_MAX_FILE_ROWS,
    build_totals_json,
    default_overflow_writer_factory,
    estimate_json_bytes,
    prepare_bounded_payload_json,
)


def test_two_hundred_file_payload_under_one_mb() -> None:
    rows = [
        {
            "path": f"apis/spec-{i:03d}.yaml",
            "status": "modified",
            "format": "openapi_3_1",
            "confidence": 0.95,
            "tracked": True,
            "import_enabled": True,
            "content_checksum": "a" * 64,
        }
        for i in range(200)
    ]
    totals = build_totals_json(file_rows=rows, imported_count=0, scan_failed=False)
    payload, overflow = prepare_bounded_payload_json(
        rows,
        totals_json=totals,
        write_overflow=lambda b: "unused",
    )
    assert overflow is None
    assert len(payload["files"]) == 200
    assert estimate_json_bytes({"totals": totals, **payload}) < 1_000_000


def test_thirty_thousand_files_use_overflow_url(tmp_path: Path) -> None:
    rows = [
        {
            "path": f"p/thirty/{i:05d}.yaml",
            "status": "unchanged",
            "format": "json_schema",
            "confidence": 0.9,
            "tracked": True,
            "import_enabled": False,
            "content_checksum": "b" * 64,
        }
        for i in range(30_000)
    ]
    totals = build_totals_json(file_rows=rows, imported_count=0, scan_failed=False)
    scan_id = "00000000-0000-0000-0000-00000000aa01"
    repo_id = "00000000-0000-0000-0000-00000000aa02"
    tenant_id = "00000000-0000-0000-0000-00000000aa03"
    writer = default_overflow_writer_factory(
        root=tmp_path,
        public_base_url="https://example.invalid/signed",
        tenant_id=tenant_id,
        repository_id=repo_id,
        scan_id=scan_id,
    )
    payload, overflow = prepare_bounded_payload_json(
        rows,
        totals_json=totals,
        write_overflow=writer,
    )
    assert overflow.startswith("https://example.invalid/signed/")
    assert payload["kind"] == "overflow"
    assert payload["rowCount"] == 30_000
    assert len(payload["truncatedSample"]) <= SCAN_REPORT_PAYLOAD_MAX_FILE_ROWS
    blob_path = tmp_path / tenant_id / repo_id / f"{scan_id}.json"
    assert blob_path.is_file()
    assert blob_path.stat().st_size > 100_000
