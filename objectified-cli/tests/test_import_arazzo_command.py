"""End-to-end tests for ``objectified import arazzo`` with mocked REST."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import pytest
from typer.testing import CliRunner

from objectified_cli.exit_codes import EXIT_ERROR, EXIT_USAGE
from objectified_cli.main import app

from helpers import strip_ansi

runner = CliRunner()

_VALID_ARAZZO = {
    "arazzo": "1.0.0",
    "info": {"title": "Checkout Flow", "version": "1.0.0", "summary": "Demo"},
    "sourceDescriptions": [
        {
            "name": "openapi",
            "url": "https://example.test/openapi.json",
            "type": "openapi",
        }
    ],
    "workflows": [
        {
            "workflowId": "checkout",
            "steps": [
                {"stepId": "createCart", "operationId": "createCart"},
            ],
        }
    ],
}

_IMPORT_RESULT = {
    "project_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "version_id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "project": {
        "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "tenant_id": "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        "name": "Checkout Flow",
        "slug": "checkout-flow",
        "source": "import",
        "enabled": True,
    },
    "version": {
        "id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        "project_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "version": "1.0.0",
        "slug": "1.0.0",
        "source": "import",
        "enabled": True,
    },
    "created": {
        "schemas": 0,
        "properties": 0,
        "project_properties": 0,
        "version_schemas": 0,
        "workflows_created": 1,
        "steps_created": 1,
    },
    "warnings": [],
    "errors": [],
}


@pytest.fixture(autouse=True)
def api_key_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Tier-2 import commands require an API key."""
    monkeypatch.setenv("OBJECTIFIED_API_KEY", "test-import-key")


def _write_spec(path: Path) -> None:
    path.write_text(json.dumps(_VALID_ARAZZO), encoding="utf-8")


def _json_object_from_multipart(content: str, *, anchor: str) -> dict[str, object]:
    """Extract a balanced JSON object containing *anchor* from multipart text."""
    anchor_idx = content.find(anchor)
    assert anchor_idx >= 0, f"multipart body missing {anchor!r}"
    start = content.rfind("{", 0, anchor_idx)
    assert start >= 0
    depth = 0
    end = start
    for index, char in enumerate(content[start:], start=start):
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                end = index + 1
                break
    return json.loads(content[start:end])


def _multipart_form_value(content: str, field: str) -> str | None:
    marker = f'name="{field}"'
    idx = content.find(marker)
    if idx == -1:
        return None
    value_start = content.find("\r\n\r\n", idx)
    if value_start == -1:
        return None
    value_start += 4
    value_end = content.find("\r\n--", value_start)
    return content[value_start:value_end].strip()


def _import_request_payload(request: object) -> dict[str, object]:
    """Return JSON import body or the uploaded file JSON from a multipart POST."""
    content = request.content.decode("utf-8")  # type: ignore[attr-defined]
    if content.lstrip().startswith("{"):
        return json.loads(content)
    spec = _json_object_from_multipart(content, anchor='"arazzo"')
    payload: dict[str, object] = {"spec": spec}
    for field in ("dry_run", "visibility", "project_id", "tenant_id", "version_id"):
        value = _multipart_form_value(content, field)
        if value is None:
            continue
        if field == "dry_run":
            payload[field] = value.lower() in {"true", "1", "yes"}
        else:
            payload[field] = value
    return payload


def test_import_arazzo_sync_success(httpx_mock: object, tmp_path: Path) -> None:
    """Successful sync import prints result on stdout and exits 0."""
    spec_path = tmp_path / "checkout.json"
    _write_spec(spec_path)
    httpx_mock.add_response(
        url="http://localhost:8000/v1/tenants/acme-corp/imports/upload",
        method="POST",
        status_code=200,
        json=_IMPORT_RESULT,
    )

    result = runner.invoke(app, ["import", "arazzo", str(spec_path)])

    assert result.exit_code == 0
    assert "Import completed." in result.stdout
    assert "Checkout Flow" in result.stdout
    assert "Created entities" in result.stdout
    assert "Workflows" in result.stdout
    assert "Uploading Arazzo document checkout.json" in result.stderr


def test_import_arazzo_from_url(httpx_mock: object) -> None:
    """Arazzo import accepts an HTTP(S) URL as the document source."""
    spec_url = "https://example.com/checkout.json"
    httpx_mock.add_response(url=spec_url, text=json.dumps(_VALID_ARAZZO))
    httpx_mock.add_response(
        url="http://localhost:8000/v1/tenants/acme-corp/imports/upload",
        method="POST",
        status_code=200,
        json=_IMPORT_RESULT,
    )

    result = runner.invoke(app, ["import", "arazzo", spec_url])

    assert result.exit_code == 0
    assert "Import completed." in result.stdout
    assert "Fetching Arazzo document checkout.json" in result.stderr


def test_import_arazzo_from_stdin(httpx_mock: object) -> None:
    """Arazzo import accepts JSON on stdin when path is ``-``."""
    httpx_mock.add_response(
        url="http://localhost:8000/v1/tenants/acme-corp/imports/upload",
        method="POST",
        status_code=200,
        json=_IMPORT_RESULT,
    )

    result = runner.invoke(
        app,
        ["import", "arazzo", "-"],
        input=json.dumps(_VALID_ARAZZO),
    )

    assert result.exit_code == 0
    assert "Import completed." in result.stdout


def test_import_arazzo_json_output(httpx_mock: object, tmp_path: Path) -> None:
    """``--json`` emits the raw ImportResult on stdout."""
    spec_path = tmp_path / "checkout.json"
    _write_spec(spec_path)
    httpx_mock.add_response(
        url="http://localhost:8000/v1/tenants/acme-corp/imports/upload",
        method="POST",
        json=_IMPORT_RESULT,
    )

    result = runner.invoke(app, ["--json", "import", "arazzo", str(spec_path)])

    assert result.exit_code == 0
    payload = json.loads(result.stdout.strip())
    assert payload["project_id"] == _IMPORT_RESULT["project_id"]


def test_import_arazzo_async_polls_until_completed(
    httpx_mock: object,
    tmp_path: Path,
) -> None:
    """202 responses poll GET /imports/{job_id} until completed."""
    spec_path = tmp_path / "checkout.json"
    _write_spec(spec_path)
    httpx_mock.add_response(
        url="http://localhost:8000/v1/tenants/acme-corp/imports/upload",
        method="POST",
        status_code=202,
        json={"job_id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc", "status": "pending"},
    )
    httpx_mock.add_response(
        url="http://localhost:8000/v1/tenants/acme-corp/imports/cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        json={"status": "running", "job_id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc"},
    )
    httpx_mock.add_response(
        url="http://localhost:8000/v1/tenants/acme-corp/imports/cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        json={
            "status": "completed",
            "job_id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            "result": _IMPORT_RESULT,
        },
    )

    result = runner.invoke(app, ["import", "arazzo", str(spec_path)])

    assert result.exit_code == 0
    assert "Import completed." in result.stdout


def test_import_arazzo_invalid_spec_exits_usage(tmp_path: Path) -> None:
    """Structural validation failures exit 2 before any REST call."""
    spec_path = tmp_path / "bad.json"
    spec_path.write_text('{"arazzo": "1.0.0", "workflows": []}', encoding="utf-8")

    result = runner.invoke(app, ["import", "arazzo", str(spec_path)])

    assert result.exit_code == EXIT_USAGE
    assert result.stdout == ""


def test_import_arazzo_rejects_openapi_file(tmp_path: Path) -> None:
    """OpenAPI files suggest ``import openapi`` instead."""
    spec_path = tmp_path / "openapi.json"
    spec_path.write_text(
        json.dumps(
            {
                "openapi": "3.1.0",
                "info": {"title": "API", "version": "1.0.0"},
                "paths": {},
            },
        ),
        encoding="utf-8",
    )

    result = runner.invoke(app, ["import", "arazzo", str(spec_path)])

    assert result.exit_code == EXIT_USAGE
    assert "import openapi" in result.stderr
    assert result.stdout == ""


def test_import_arazzo_rejects_json_schema_file(tmp_path: Path) -> None:
    """JSON Schema files suggest ``import json-schema`` instead."""
    spec_path = tmp_path / "schema.json"
    spec_path.write_text(
        json.dumps(
            {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "type": "object",
            },
        ),
        encoding="utf-8",
    )

    result = runner.invoke(app, ["import", "arazzo", str(spec_path)])

    assert result.exit_code == EXIT_USAGE
    assert "import json-schema" in result.stderr


def test_import_arazzo_errors_in_result_exit_error(
    httpx_mock: object,
    tmp_path: Path,
) -> None:
    """Non-empty ImportResult.errors exits 1 after printing the result."""
    spec_path = tmp_path / "checkout.json"
    _write_spec(spec_path)
    payload = {
        **_IMPORT_RESULT,
        "errors": [{"code": "E1", "message": "partial failure"}],
    }
    httpx_mock.add_response(
        url="http://localhost:8000/v1/tenants/acme-corp/imports/upload",
        method="POST",
        json=payload,
    )

    result = runner.invoke(app, ["import", "arazzo", str(spec_path)])

    assert result.exit_code == EXIT_ERROR
    assert "Import completed." in result.stdout
    assert "Errors: 1" in result.stdout


def test_import_arazzo_dry_run_passes_flag(httpx_mock: object, tmp_path: Path) -> None:
    """``--dry-run`` is forwarded in the multipart POST body."""
    spec_path = tmp_path / "checkout.json"
    _write_spec(spec_path)
    httpx_mock.add_response(
        url="http://localhost:8000/v1/tenants/acme-corp/imports/upload",
        method="POST",
        json=_IMPORT_RESULT,
    )

    result = runner.invoke(app, ["import", "arazzo", "--dry-run", str(spec_path)])

    assert result.exit_code == 0
    request = httpx_mock.get_requests()[0]
    body = _import_request_payload(request)
    assert body["dry_run"] is True
    assert "Dry run completed (no changes written)." in result.stdout
    assert "Planning Arazzo import (dry run) of checkout.json" in result.stderr


def test_import_arazzo_no_wait_returns_job_without_polling(
    httpx_mock: object,
    tmp_path: Path,
) -> None:
    """``--no-wait`` prints the 202 accept body and does not poll GET /imports."""
    spec_path = tmp_path / "checkout.json"
    _write_spec(spec_path)
    httpx_mock.add_response(
        url="http://localhost:8000/v1/tenants/acme-corp/imports/upload",
        method="POST",
        status_code=202,
        json={"job_id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc", "status": "pending"},
    )

    result = runner.invoke(
        app,
        ["import", "arazzo", "--no-wait", str(spec_path)],
    )

    assert result.exit_code == 0
    assert "Import accepted." in result.stdout
    assert len(httpx_mock.get_requests()) == 1


def test_import_arazzo_custom_poll_interval(
    httpx_mock: object,
    tmp_path: Path,
) -> None:
    """``--poll-interval`` is forwarded to the job poll loop."""
    spec_path = tmp_path / "checkout.json"
    _write_spec(spec_path)
    httpx_mock.add_response(
        url="http://localhost:8000/v1/tenants/acme-corp/imports/upload",
        method="POST",
        status_code=202,
        json={"job_id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc", "status": "pending"},
    )

    with patch(
        "objectified_cli.import_.upload.wait_for_import_job",
    ) as mock_wait:
        mock_wait.return_value = {
            "status": "completed",
            "result": _IMPORT_RESULT,
        }
        result = runner.invoke(
            app,
            ["import", "arazzo", "--poll-interval", "2.5", str(spec_path)],
        )

    assert result.exit_code == 0
    mock_wait.assert_called_once()
    assert mock_wait.call_args.kwargs["poll_interval"] == 2.5


def test_import_arazzo_help_lists_flags() -> None:
    """Subcommand documents PATH and import-specific options."""
    result = runner.invoke(app, ["import", "arazzo", "--help"])
    assert result.exit_code == 0
    help_text = strip_ansi(result.stdout)
    assert "PATH" in help_text
    assert "--dry-run" in help_text
    assert "--project-id" in help_text
    assert "--version-id" in help_text
    assert "--wait" in help_text
    assert "--poll-interval" in help_text


def test_import_arazzo_override_flags_in_request_body(
    httpx_mock: object,
    tmp_path: Path,
) -> None:
    """CLI overrides are sent in the multipart POST body (info and targeting ids)."""
    spec_path = tmp_path / "checkout.json"
    _write_spec(spec_path)
    httpx_mock.add_response(
        url="http://localhost:8000/v1/tenants/acme-corp/imports/upload",
        method="POST",
        status_code=200,
        json=_IMPORT_RESULT,
    )
    project_id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    version_id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

    result = runner.invoke(
        app,
        [
            "import",
            "arazzo",
            "--project-name",
            "Custom Name",
            "--version",
            "9.0.0",
            "--project-slug",
            "custom-slug",
            "--version-slug",
            "9.0.0",
            "--project-id",
            project_id,
            "--version-id",
            version_id,
            str(spec_path),
        ],
    )

    assert result.exit_code == 0
    request = httpx_mock.get_requests()[0]
    body = _import_request_payload(request)
    info = body["spec"]["info"]
    assert info["title"] == "Custom Name"
    assert info["version"] == "9.0.0"
    assert info["x-objectified-project-slug"] == "custom-slug"
    assert info["x-objectified-version-slug"] == "9.0.0"
    assert body["project_id"] == project_id
    assert body["version_id"] == version_id


def test_import_openapi_suggests_arazzo_command(tmp_path: Path) -> None:
    """Arazzo files suggest ``import arazzo`` when openapi is invoked."""
    spec_path = tmp_path / "workflow.json"
    _write_spec(spec_path)

    result = runner.invoke(app, ["import", "openapi", str(spec_path)])

    assert result.exit_code == EXIT_USAGE
    assert "import arazzo" in result.stderr
