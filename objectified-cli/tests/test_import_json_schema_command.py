"""End-to-end tests for ``objectified import json-schema`` with mocked REST."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from typer.testing import CliRunner

from objectified_cli.exit_codes import EXIT_ERROR, EXIT_USAGE
from objectified_cli.main import app

from helpers import strip_ansi

runner = CliRunner()

_VALID_PROPERTY = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "string",
    "title": "Email",
    "format": "email",
}

_VALID_OPENAPI = {
    "openapi": "3.1.0",
    "info": {"title": "API", "version": "1.0.0"},
    "paths": {},
}

_IMPORT_RESULT = {
    "project_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "version_id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "project": {
        "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "tenant_id": "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        "name": "unlinked",
        "slug": "unlinked",
        "source": "import",
        "enabled": True,
    },
    "version": {
        "id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        "project_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "version": "unlinked",
        "slug": "unlinked",
        "source": "import",
        "enabled": True,
    },
    "created": {
        "schemas": 0,
        "properties": 1,
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


def _write_schema(path: Path, document: dict | None = None) -> None:
    path.write_text(json.dumps(document or _VALID_PROPERTY), encoding="utf-8")


def test_import_json_schema_property_sync_success(
    httpx_mock: object,
    tmp_path: Path,
) -> None:
    """Successful property import prints result on stdout and exits 0."""
    schema_path = tmp_path / "email.json"
    _write_schema(schema_path)
    httpx_mock.add_response(
        url="http://localhost:8000/imports/json-schema",
        method="POST",
        status_code=200,
        json=_IMPORT_RESULT,
    )

    result = runner.invoke(app, ["import", "json-schema", str(schema_path)])

    assert result.exit_code == 0
    assert "Import completed." in result.stdout
    assert "Created entities" in result.stdout
    assert "Properties" in result.stdout
    assert "Uploading JSON Schema document email.json" in result.stderr
    request = httpx_mock.get_requests()[0]
    body = json.loads(request.content.decode())
    assert body["body"] == _VALID_PROPERTY
    assert body["as"] == "property"
    assert body["name"] == "Email"


def test_import_json_schema_from_url(httpx_mock: object) -> None:
    """JSON Schema import accepts an HTTP(S) URL as the document source."""
    schema_url = "https://example.com/email.json"
    httpx_mock.add_response(url=schema_url, text=json.dumps(_VALID_PROPERTY))
    httpx_mock.add_response(
        url="http://localhost:8000/imports/json-schema",
        method="POST",
        status_code=200,
        json=_IMPORT_RESULT,
    )

    result = runner.invoke(app, ["import", "json-schema", schema_url])

    assert result.exit_code == 0
    assert "Import completed." in result.stdout
    assert "Fetching JSON Schema document email.json" in result.stderr


def test_import_json_schema_json_output(httpx_mock: object, tmp_path: Path) -> None:
    """``--json`` emits the raw ImportResult on stdout."""
    schema_path = tmp_path / "email.json"
    _write_schema(schema_path)
    httpx_mock.add_response(
        url="http://localhost:8000/imports/json-schema",
        method="POST",
        json=_IMPORT_RESULT,
    )

    result = runner.invoke(
        app,
        ["--json", "import", "json-schema", str(schema_path)],
    )

    assert result.exit_code == 0
    payload = json.loads(result.stdout.strip())
    assert payload["created"]["properties"] == 1


def test_import_json_schema_dry_run(httpx_mock: object, tmp_path: Path) -> None:
    """``--dry-run`` is forwarded in the POST body."""
    schema_path = tmp_path / "email.json"
    _write_schema(schema_path)
    httpx_mock.add_response(
        url="http://localhost:8000/imports/json-schema",
        method="POST",
        json=_IMPORT_RESULT,
    )

    result = runner.invoke(
        app,
        ["import", "json-schema", "--dry-run", str(schema_path)],
    )

    assert result.exit_code == 0
    body = json.loads(httpx_mock.get_requests()[0].content.decode())
    assert body["dry_run"] is True
    assert "Dry run completed (no changes written)." in result.stdout
    assert "Planning JSON Schema import (dry run) of email.json" in result.stderr


def test_import_json_schema_rejects_openapi_file(tmp_path: Path) -> None:
    """OpenAPI files suggest ``import openapi`` before any REST call."""
    spec_path = tmp_path / "api.json"
    spec_path.write_text(json.dumps(_VALID_OPENAPI), encoding="utf-8")

    result = runner.invoke(app, ["import", "json-schema", str(spec_path)])

    assert result.exit_code == EXIT_USAGE
    assert "import openapi" in result.stderr
    assert result.stdout == ""


def test_import_json_schema_invalid_document_exits_usage(tmp_path: Path) -> None:
    """Meta-schema validation failures exit 2 before REST."""
    schema_path = tmp_path / "bad.json"
    schema_path.write_text(
        json.dumps(
            {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "type": "object",
                "required": "must-be-array",
            },
        ),
        encoding="utf-8",
    )

    result = runner.invoke(app, ["import", "json-schema", str(schema_path)])

    assert result.exit_code == EXIT_USAGE
    assert result.stdout == ""


def test_import_json_schema_displays_link_created_counts(
    httpx_mock: object,
    tmp_path: Path,
) -> None:
    """Import result reports ``project_properties`` and ``version_schemas`` counts."""
    schema_path = tmp_path / "user.json"
    document = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "title": "User",
        "properties": {"email": {"type": "string"}},
    }
    _write_schema(schema_path, document)
    httpx_mock.add_response(
        url="http://localhost:8000/imports/json-schema",
        method="POST",
        status_code=200,
        json={
            **_IMPORT_RESULT,
            "created": {
                "schemas": 1,
                "properties": 0,
                "project_properties": 0,
                "version_schemas": 1,
            },
        },
    )
    version_id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

    result = runner.invoke(
        app,
        [
            "import",
            "json-schema",
            "--as",
            "schema",
            "--version-id",
            version_id,
            str(schema_path),
        ],
    )

    assert result.exit_code == 0
    assert "Version schema links" in result.stdout
    body = json.loads(httpx_mock.get_requests()[0].content.decode())
    assert body["as"] == "schema"
    assert body["version_id"] == version_id


def test_import_json_schema_project_link_flags_in_request_body(
    httpx_mock: object,
    tmp_path: Path,
) -> None:
    """``--project-id`` and ``--link-project-property`` are sent in the POST body for a property import."""
    schema_path = tmp_path / "email.json"
    _write_schema(schema_path)
    httpx_mock.add_response(
        url="http://localhost:8000/imports/json-schema",
        method="POST",
        json=_IMPORT_RESULT,
    )
    project_id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

    result = runner.invoke(
        app,
        [
            "import",
            "json-schema",
            "--name",
            "contact_email",
            "--description",
            "Primary contact email",
            "--as",
            "property",
            "--project-id",
            project_id,
            "--link-project-property",
            str(schema_path),
        ],
    )

    assert result.exit_code == 0
    body = json.loads(httpx_mock.get_requests()[0].content.decode())
    assert body["name"] == "contact_email"
    assert body["description"] == "Primary contact email"
    assert body["as"] == "property"
    assert body["project_id"] == project_id
    assert body["link_project_property"] is True


def test_import_json_schema_version_id_rejected_for_property_target(
    httpx_mock: object,
    tmp_path: Path,
) -> None:
    """``--version-id`` exits usage when the resolved target is ``property``."""
    schema_path = tmp_path / "email.json"
    _write_schema(schema_path)
    version_id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

    result = runner.invoke(
        app,
        [
            "import",
            "json-schema",
            "--as",
            "property",
            "--version-id",
            version_id,
            str(schema_path),
        ],
    )

    assert result.exit_code == EXIT_USAGE
    assert "--version-id is only valid for schema imports, not property imports." in result.stderr
    assert httpx_mock.get_requests() == []


def test_import_json_schema_schema_target_auto_detected(
    httpx_mock: object,
    tmp_path: Path,
) -> None:
    """Documents with top-level ``properties`` import as schema by default."""
    document = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "title": "User",
        "properties": {"email": {"type": "string"}},
    }
    schema_path = tmp_path / "user.json"
    _write_schema(schema_path, document)
    httpx_mock.add_response(
        url="http://localhost:8000/imports/json-schema",
        method="POST",
        status_code=200,
        json={
            **_IMPORT_RESULT,
            "created": {
                "schemas": 1,
                "properties": 0,
                "project_properties": 0,
                "version_schemas": 0,
            },
        },
    )

    result = runner.invoke(app, ["import", "json-schema", str(schema_path)])

    assert result.exit_code == 0
    body = json.loads(httpx_mock.get_requests()[0].content.decode())
    assert body["as"] == "schema"
    assert body["name"] == "User"


def test_import_json_schema_link_project_property_requires_project_id(
    httpx_mock: object,
    tmp_path: Path,
) -> None:
    """``--link-project-property`` exits usage when ``--project-id`` is missing."""
    schema_path = tmp_path / "email.json"
    _write_schema(schema_path)

    result = runner.invoke(
        app,
        ["import", "json-schema", "--link-project-property", str(schema_path)],
    )

    assert result.exit_code == EXIT_USAGE
    assert "--link-project-property requires --project-id." in result.stderr
    assert httpx_mock.get_requests() == []


def test_import_json_schema_errors_in_result_exit_error(
    httpx_mock: object,
    tmp_path: Path,
) -> None:
    """Non-empty ImportResult.errors exits 1 after printing the result."""
    schema_path = tmp_path / "email.json"
    _write_schema(schema_path)
    payload = {
        **_IMPORT_RESULT,
        "errors": [{"code": "E1", "message": "partial failure"}],
    }
    httpx_mock.add_response(
        url="http://localhost:8000/imports/json-schema",
        method="POST",
        json=payload,
    )

    result = runner.invoke(app, ["import", "json-schema", str(schema_path)])

    assert result.exit_code == EXIT_ERROR
    assert "Errors: 1" in result.stdout


def test_import_json_schema_help_lists_flags() -> None:
    """Subcommand documents PATH and import-specific options."""
    result = runner.invoke(app, ["import", "json-schema", "--help"])
    assert result.exit_code == 0
    help_text = strip_ansi(result.stdout)
    assert "PATH" in help_text
    assert "--as" in help_text
    assert "--name" in help_text
    assert "--project-id" in help_text
    assert "--version-id" in help_text
    assert "--link-project-pro" in help_text
    assert "--dry-run" in help_text
    assert "--no-wait" not in help_text
    assert "--poll-interval" not in help_text


def test_import_openapi_suggests_json_schema_command(tmp_path: Path) -> None:
    """OpenAPI command points users at ``import json-schema`` for schema files."""
    schema_path = tmp_path / "schema.json"
    _write_schema(schema_path)

    result = runner.invoke(app, ["import", "openapi", str(schema_path)])

    assert result.exit_code == EXIT_USAGE
    assert "import json-schema" in result.stderr
    assert "not available yet" not in result.stderr
