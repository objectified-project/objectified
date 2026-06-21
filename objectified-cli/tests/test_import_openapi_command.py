"""End-to-end tests for ``objectified import openapi`` with mocked REST."""

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

_VALID_SPEC = {
    "openapi": "3.1.0",
    "info": {"title": "Pet Store", "version": "1.0.0"},
    "paths": {},
}

_IMPORT_RESULT = {
    "project_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "version_id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "project": {
        "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "tenant_id": "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        "name": "Pet Store",
        "slug": "pet-store",
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
    },
    "warnings": [],
    "errors": [],
}


@pytest.fixture(autouse=True)
def api_key_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Tier-2 import commands require an API key."""
    monkeypatch.setenv("OBJECTIFIED_API_KEY", "test-import-key")
    monkeypatch.delenv("OBJECTIFIED_TENANT_ID", raising=False)


def _write_spec(path: Path) -> None:
    path.write_text(json.dumps(_VALID_SPEC), encoding="utf-8")


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
    spec = _json_object_from_multipart(content, anchor='"openapi"')
    payload: dict[str, object] = {"spec": spec}
    for field in ("dry_run", "visibility", "project_id", "tenant_id"):
        value = _multipart_form_value(content, field)
        if value is None:
            continue
        if field == "dry_run":
            payload[field] = value.lower() in {"true", "1", "yes"}
        else:
            payload[field] = value
    return payload


def test_import_openapi_sync_success(httpx_mock: object, tmp_path: Path) -> None:
    """Successful sync import prints result on stdout and exits 0."""
    spec_path = tmp_path / "petstore.json"
    _write_spec(spec_path)
    httpx_mock.add_response(
        url="http://localhost:8000/v1/tenants/acme-corp/imports/upload",
        method="POST",
        status_code=200,
        json=_IMPORT_RESULT,
    )

    result = runner.invoke(app, ["import", "openapi", str(spec_path)])

    assert result.exit_code == 0
    assert "Import completed." in result.stdout
    assert "Pet Store" in result.stdout
    assert "pet-store" in result.stdout
    assert "Uploading OpenAPI document petstore.json" in result.stderr


def test_import_openapi_lists_local_schema_coercion_warnings(
    httpx_mock: object,
    tmp_path: Path,
) -> None:
    """Local schema default coercion warnings are listed in human import output."""
    spec_path = tmp_path / "coerced-default.json"
    spec_path.write_text(
        json.dumps(
            {
                "openapi": "3.0.0",
                "info": {"title": "Demo", "version": "1.0.0"},
                "paths": {},
                "components": {
                    "parameters": {
                        "limit": {
                            "name": "limit",
                            "in": "query",
                            "schema": {"type": "integer", "default": "100"},
                        }
                    }
                },
            }
        ),
        encoding="utf-8",
    )
    httpx_mock.add_response(
        url="http://localhost:8000/v1/tenants/acme-corp/imports/upload",
        method="POST",
        status_code=200,
        json=_IMPORT_RESULT,
    )

    result = runner.invoke(app, ["import", "openapi", str(spec_path)])

    assert result.exit_code == 0
    assert "Warnings (1):" in result.stdout
    assert "[schema_default_type_coercion]" in result.stdout
    assert "Schema default '100' was coerced" in result.stdout


def test_import_openapi_from_url(httpx_mock: object) -> None:
    """OpenAPI import accepts an HTTP(S) URL as the document source."""
    spec_url = "https://example.com/petstore.json"
    httpx_mock.add_response(url=spec_url, text=json.dumps(_VALID_SPEC))
    httpx_mock.add_response(
        url="http://localhost:8000/v1/tenants/acme-corp/imports/upload",
        method="POST",
        status_code=200,
        json=_IMPORT_RESULT,
    )

    result = runner.invoke(app, ["import", "openapi", spec_url])

    assert result.exit_code == 0
    assert "Import completed." in result.stdout
    assert "Fetching OpenAPI document petstore.json" in result.stderr


def test_import_openapi_url_fetch_failure_exits_usage(httpx_mock: object) -> None:
    """Unreachable or failing document URLs exit with usage code."""
    spec_url = "https://example.com/missing.json"
    httpx_mock.add_response(url=spec_url, status_code=404)

    result = runner.invoke(app, ["import", "openapi", spec_url])

    assert result.exit_code == EXIT_USAGE
    assert "HTTP 404" in result.stderr


def test_import_openapi_json_output(httpx_mock: object, tmp_path: Path) -> None:
    """``--json`` emits the raw ImportResult on stdout."""
    spec_path = tmp_path / "petstore.json"
    _write_spec(spec_path)
    httpx_mock.add_response(
        url="http://localhost:8000/v1/tenants/acme-corp/imports/upload",
        method="POST",
        json=_IMPORT_RESULT,
    )

    result = runner.invoke(app, ["--json", "import", "openapi", str(spec_path)])

    assert result.exit_code == 0
    payload = json.loads(result.stdout.strip())
    assert payload["project_id"] == _IMPORT_RESULT["project_id"]


def test_import_openapi_async_polls_until_completed(
    httpx_mock: object,
    tmp_path: Path,
) -> None:
    """202 responses poll GET /imports/{job_id} until completed."""
    spec_path = tmp_path / "petstore.json"
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

    result = runner.invoke(app, ["import", "openapi", str(spec_path)])

    assert result.exit_code == 0
    assert "Import completed." in result.stdout
    stderr = strip_ansi(result.stderr)
    assert "Import running" in stderr or "Uploading" in stderr


def test_import_openapi_invalid_spec_exits_usage(tmp_path: Path) -> None:
    """Structural validation failures exit 2 before any REST call."""
    spec_path = tmp_path / "bad.json"
    spec_path.write_text('{"openapi": "3.1.0", "paths": {}}', encoding="utf-8")

    result = runner.invoke(app, ["import", "openapi", str(spec_path)])

    assert result.exit_code == EXIT_USAGE
    assert result.stdout == ""


def test_import_openapi_rejects_json_schema_file(tmp_path: Path) -> None:
    """JSON Schema files suggest ``import json-schema`` instead."""
    spec_path = tmp_path / "schema.json"
    spec_path.write_text(
        json.dumps(
            {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "type": "object",
                "properties": {"id": {"type": "string"}},
            },
        ),
        encoding="utf-8",
    )

    result = runner.invoke(app, ["import", "openapi", str(spec_path)])

    assert result.exit_code == EXIT_USAGE
    assert "import json-schema" in result.stderr
    assert "Use: objectified import json-schema" in result.stderr
    assert result.stdout == ""


def test_import_openapi_errors_in_result_exit_error(
    httpx_mock: object,
    tmp_path: Path,
) -> None:
    """Non-empty ImportResult.errors exits 1 after printing the result."""
    spec_path = tmp_path / "petstore.json"
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

    result = runner.invoke(app, ["import", "openapi", str(spec_path)])

    assert result.exit_code == EXIT_ERROR
    assert "Import completed." in result.stdout
    assert "Errors: 1" in result.stdout


def test_import_openapi_uses_import_timeout(tmp_path: Path) -> None:
    """``--timeout`` applies to the REST client for upload and polling."""
    spec_path = tmp_path / "petstore.json"
    _write_spec(spec_path)

    with patch("objectified_cli.commands.import_.RestClient") as mock_client_cls:
        instance = mock_client_cls.return_value
        response = instance.post.return_value
        response.status_code = 200
        response.json.return_value = _IMPORT_RESULT

        result = runner.invoke(
            app,
            ["--timeout", "90", "import", "openapi", str(spec_path)],
        )

    assert result.exit_code == 0
    mock_client_cls.assert_called_once()
    assert mock_client_cls.call_args.kwargs["timeout"] == 90.0


def test_import_openapi_dry_run_passes_flag(httpx_mock: object, tmp_path: Path) -> None:
    """``--dry-run`` is forwarded in the POST JSON body and prints a planned summary."""
    spec_path = tmp_path / "petstore.json"
    _write_spec(spec_path)
    httpx_mock.add_response(
        url="http://localhost:8000/v1/tenants/acme-corp/imports/upload",
        method="POST",
        json=_IMPORT_RESULT,
    )

    result = runner.invoke(app, ["import", "openapi", "--dry-run", str(spec_path)])

    assert result.exit_code == 0
    request = httpx_mock.get_requests()[0]
    body = _import_request_payload(request)
    assert body["dry_run"] is True
    assert "Dry run completed (no changes written)." in result.stdout
    assert "Pet Store" in result.stdout
    assert "Planning OpenAPI import (dry run)" in result.stderr
    assert "Uploading OpenAPI document" not in result.stderr


def test_import_openapi_no_wait_returns_job_without_polling(
    httpx_mock: object,
    tmp_path: Path,
) -> None:
    """``--no-wait`` prints the 202 accept body and does not poll GET /imports."""
    spec_path = tmp_path / "petstore.json"
    _write_spec(spec_path)
    httpx_mock.add_response(
        url="http://localhost:8000/v1/tenants/acme-corp/imports/upload",
        method="POST",
        status_code=202,
        json={"job_id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc", "status": "pending"},
    )

    result = runner.invoke(
        app,
        ["import", "openapi", "--no-wait", str(spec_path)],
    )

    assert result.exit_code == 0
    assert "Import accepted." in result.stdout
    assert "cccccccc-cccc-4ccc-8ccc-cccccccccccc" in result.stdout
    assert len(httpx_mock.get_requests()) == 1


def test_import_openapi_custom_poll_interval(
    httpx_mock: object,
    tmp_path: Path,
) -> None:
    """``--poll-interval`` is forwarded to the job poll loop."""
    spec_path = tmp_path / "petstore.json"
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
            ["import", "openapi", "--poll-interval", "2.5", str(spec_path)],
        )

    assert result.exit_code == 0
    mock_wait.assert_called_once()
    assert mock_wait.call_args.kwargs["poll_interval"] == 2.5


def test_import_openapi_async_timeout_exits_error(
    httpx_mock: object,
    tmp_path: Path,
) -> None:
    """Async poll loop timeout exits with code 1 and writes timeout message."""
    spec_path = tmp_path / "petstore.json"
    _write_spec(spec_path)
    httpx_mock.add_response(
        url="http://localhost:8000/v1/tenants/acme-corp/imports/upload",
        method="POST",
        status_code=202,
        json={"job_id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc", "status": "pending"},
    )
    httpx_mock.add_response(
        url="http://localhost:8000/v1/tenants/acme-corp/imports/cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        method="GET",
        json={"status": "running", "job_id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc"},
    )

    result = runner.invoke(
        app,
        ["--timeout", "1", "--no-progress", "import", "openapi", str(spec_path)],
    )

    assert result.exit_code == EXIT_ERROR
    assert "Import timed out after 1 second." in strip_ansi(result.stderr)


def test_import_openapi_help_lists_flags() -> None:
    """Subcommand documents PATH and import-specific options."""
    result = runner.invoke(app, ["import", "openapi", "--help"])
    assert result.exit_code == 0
    help_text = strip_ansi(result.stdout)
    assert "PATH" in help_text
    assert "--dry-run" in help_text
    assert "--project-name" in help_text
    assert "--version" in help_text
    assert "--project-slug" in help_text
    assert "--version-slug" in help_text
    assert "--project-id" in help_text
    assert "--publish" in help_text
    assert "--visibility" in help_text
    assert "--wait" in help_text
    assert "--poll-interval" in help_text


def test_import_openapi_publish_private_maps_to_protected(
    httpx_mock: object,
    tmp_path: Path,
) -> None:
    """``--publish private`` sends REST ``visibility: protected``."""
    spec_path = tmp_path / "petstore.json"
    _write_spec(spec_path)
    httpx_mock.add_response(
        url="http://localhost:8000/v1/tenants/acme-corp/imports/upload",
        method="POST",
        status_code=200,
        json=_IMPORT_RESULT,
    )

    result = runner.invoke(
        app,
        ["import", "openapi", "--publish", "private", str(spec_path)],
    )

    assert result.exit_code == 0
    request = httpx_mock.get_requests()[0]
    body = _import_request_payload(request)
    assert body["visibility"] == "protected"


def test_import_openapi_publish_public_forwards_visibility(
    httpx_mock: object,
    tmp_path: Path,
) -> None:
    """``--publish public`` is forwarded in the import request body."""
    spec_path = tmp_path / "petstore.json"
    _write_spec(spec_path)
    httpx_mock.add_response(
        url="http://localhost:8000/v1/tenants/acme-corp/imports/upload",
        method="POST",
        status_code=200,
        json=_IMPORT_RESULT,
    )

    result = runner.invoke(
        app,
        ["import", "openapi", "--publish", "public", str(spec_path)],
    )

    assert result.exit_code == 0
    request = httpx_mock.get_requests()[0]
    body = _import_request_payload(request)
    assert body["visibility"] == "public"


def test_import_openapi_rejects_publish_and_visibility_together(
    tmp_path: Path,
) -> None:
    """``--publish`` and ``--visibility`` are mutually exclusive."""
    spec_path = tmp_path / "petstore.json"
    _write_spec(spec_path)

    result = runner.invoke(
        app,
        [
            "import",
            "openapi",
            "--publish",
            "public",
            "--visibility",
            "private",
            str(spec_path),
        ],
    )

    assert result.exit_code == EXIT_USAGE
    assert "only one of --publish and --visibility" in result.stderr


def test_import_openapi_override_flags_in_request_body(
    httpx_mock: object,
    tmp_path: Path,
) -> None:
    """CLI overrides are sent in the POST JSON body (info and project_id)."""
    spec_path = tmp_path / "petstore.json"
    _write_spec(spec_path)
    httpx_mock.add_response(
        url="http://localhost:8000/v1/tenants/acme-corp/imports/upload",
        method="POST",
        status_code=200,
        json=_IMPORT_RESULT,
    )
    project_id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

    result = runner.invoke(
        app,
        [
            "import",
            "openapi",
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


def test_import_openapi_project_name_field_in_request_body(
    httpx_mock: object,
    tmp_path: Path,
) -> None:
    spec_path = tmp_path / "petstore.json"
    spec = {
        "openapi": "3.1.0",
        "info": {
            "title": "Ignored",
            "version": "1.0.0",
            "summary": "Summary Name",
        },
        "paths": {},
    }
    spec_path.write_text(json.dumps(spec), encoding="utf-8")
    httpx_mock.add_response(
        url="http://localhost:8000/v1/tenants/acme-corp/imports/upload",
        method="POST",
        status_code=200,
        json=_IMPORT_RESULT,
    )

    result = runner.invoke(
        app,
        [
            "import",
            "openapi",
            "--project-name-field",
            "info.summary",
            str(spec_path),
        ],
    )

    assert result.exit_code == 0
    request = httpx_mock.get_requests()[0]
    body = _import_request_payload(request)
    assert body["spec"]["info"]["x-objectified-project-name-field"] == "info.summary"


def test_import_openapi_invalid_project_slug_exits_usage(tmp_path: Path) -> None:
    """Invalid --project-slug exits 2 before any REST call."""
    spec_path = tmp_path / "petstore.json"
    _write_spec(spec_path)

    result = runner.invoke(
        app,
        ["import", "openapi", "--project-slug", "INVALID SLUG", str(spec_path)],
    )

    assert result.exit_code == EXIT_USAGE
    assert "Project slug" in result.stderr
