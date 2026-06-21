"""End-to-end tests for ``objectified import json-schema-type`` with mocked REST."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from typer.testing import CliRunner

from objectified_cli.exit_codes import EXIT_USAGE
from objectified_cli.main import app

from helpers import strip_ansi

runner = CliRunner()

_TYPE_LIBRARY = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://example.com/schemas/common-types.json",
    "$defs": {
        "Email": {
            "type": "string",
            "title": "Email",
            "format": "email",
        },
        "Timestamp": {
            "type": "string",
            "title": "Timestamp",
            "format": "date-time",
        },
        "MonetaryAmount": {
            "type": "object",
            "title": "MonetaryAmount",
            "properties": {
                "amount": {"type": "number"},
                "currency": {"type": "string"},
            },
        },
    },
}

_SINGLE_TYPE = {
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
    "status": "completed",
    "dry_run": False,
    "created": 2,
    "updated": 1,
    "skipped": 0,
    "entries": [
        {
            "name": "Email",
            "slug": "email",
            "ref_path": "#/$defs/Email",
            "action": "created",
            "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        },
        {
            "name": "Timestamp",
            "slug": "timestamp",
            "ref_path": "#/$defs/Timestamp",
            "action": "created",
            "id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        },
        {
            "name": "MonetaryAmount",
            "slug": "monetary-amount",
            "ref_path": "#/$defs/MonetaryAmount",
            "action": "updated",
            "id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        },
    ],
}


@pytest.fixture(autouse=True)
def api_key_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Type import requires an API key but not tenant scope."""
    monkeypatch.setenv("OBJECTIFIED_API_KEY", "test-import-key")


def _write_document(path: Path, document: dict) -> None:
    path.write_text(json.dumps(document), encoding="utf-8")


def test_import_json_schema_type_sync_success(
    httpx_mock: object,
    tmp_path: Path,
) -> None:
    """Successful type import prints table output and exits 0."""
    schema_path = tmp_path / "common-types.json"
    _write_document(schema_path, _TYPE_LIBRARY)
    httpx_mock.add_response(
        url="http://localhost:8000/imports/json-schema-type",
        method="POST",
        status_code=200,
        json=_IMPORT_RESULT,
    )

    result = runner.invoke(app, ["import", "json-schema-type", str(schema_path)])

    assert result.exit_code == 0
    assert "Import completed." in result.stdout
    assert "Imported types (3)" in result.stdout
    assert "Email" in result.stdout
    assert "monetary-amount" in result.stdout
    assert "Created" in result.stdout
    assert "Updated" in result.stdout
    assert "Skipped" in result.stdout
    assert "Uploading JSON Schema type document common-types.json" in result.stderr
    request = httpx_mock.get_requests()[0]
    body = json.loads(request.content.decode())
    assert body["document"] == _TYPE_LIBRARY
    assert "tenant_id" not in body


def test_import_json_schema_type_from_url(httpx_mock: object) -> None:
    """Type import accepts an HTTP(S) URL as the document source."""
    schema_url = "https://example.com/common-types.json"
    httpx_mock.add_response(url=schema_url, text=json.dumps(_TYPE_LIBRARY))
    httpx_mock.add_response(
        url="http://localhost:8000/imports/json-schema-type",
        method="POST",
        status_code=200,
        json=_IMPORT_RESULT,
    )

    result = runner.invoke(app, ["import", "json-schema-type", schema_url])

    assert result.exit_code == 0
    assert "Import completed." in result.stdout
    assert "Fetching JSON Schema type document common-types.json" in result.stderr
    body = json.loads(httpx_mock.get_requests()[-1].content.decode())
    assert body["source_url"] == schema_url


def test_import_json_schema_type_json_output(httpx_mock: object, tmp_path: Path) -> None:
    """``--json`` emits the raw ImportJsonSchemaTypeResult on stdout."""
    schema_path = tmp_path / "common-types.json"
    _write_document(schema_path, _TYPE_LIBRARY)
    httpx_mock.add_response(
        url="http://localhost:8000/imports/json-schema-type",
        method="POST",
        json=_IMPORT_RESULT,
    )

    result = runner.invoke(
        app,
        ["--json", "import", "json-schema-type", str(schema_path)],
    )

    assert result.exit_code == 0
    payload = json.loads(result.stdout.strip())
    assert payload["created"] == 2
    assert len(payload["entries"]) == 3


def test_import_json_schema_type_dry_run(httpx_mock: object, tmp_path: Path) -> None:
    """``--dry-run`` is forwarded in the POST body."""
    schema_path = tmp_path / "common-types.json"
    _write_document(schema_path, _TYPE_LIBRARY)
    httpx_mock.add_response(
        url="http://localhost:8000/imports/json-schema-type",
        method="POST",
        json={**_IMPORT_RESULT, "dry_run": True},
    )

    result = runner.invoke(
        app,
        ["import", "json-schema-type", "--dry-run", str(schema_path)],
    )

    assert result.exit_code == 0
    body = json.loads(httpx_mock.get_requests()[0].content.decode())
    assert body["dry_run"] is True
    assert "Dry run completed (no changes written)." in result.stdout
    assert "Planning JSON Schema type import (dry run) of common-types.json" in result.stderr


def test_import_json_schema_type_rejects_openapi_file(tmp_path: Path) -> None:
    """OpenAPI files are rejected before any REST call."""
    spec_path = tmp_path / "api.json"
    spec_path.write_text(json.dumps(_VALID_OPENAPI), encoding="utf-8")

    result = runner.invoke(app, ["import", "json-schema-type", str(spec_path)])

    assert result.exit_code == EXIT_USAGE
    assert "import openapi" in result.stderr
    assert result.stdout == ""


def test_import_json_schema_type_name_override_single_type(
    httpx_mock: object,
    tmp_path: Path,
) -> None:
    """``--name`` is sent for single-type imports."""
    schema_path = tmp_path / "email.json"
    _write_document(schema_path, _SINGLE_TYPE)
    httpx_mock.add_response(
        url="http://localhost:8000/imports/json-schema-type",
        method="POST",
        json={
            **_IMPORT_RESULT,
            "created": 1,
            "updated": 0,
            "entries": [
                {
                    "name": "contact_email",
                    "slug": "contact-email",
                    "ref_path": None,
                    "action": "created",
                    "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                },
            ],
        },
    )

    result = runner.invoke(
        app,
        [
            "import",
            "json-schema-type",
            "--name",
            "contact_email",
            str(schema_path),
        ],
    )

    assert result.exit_code == 0
    body = json.loads(httpx_mock.get_requests()[0].content.decode())
    assert body["name"] == "contact_email"


def test_import_json_schema_type_description_override_single_type(
    httpx_mock: object,
    tmp_path: Path,
) -> None:
    """``--description`` is applied to the document for single-type imports."""
    schema_path = tmp_path / "email.json"
    _write_document(schema_path, _SINGLE_TYPE)
    httpx_mock.add_response(
        url="http://localhost:8000/imports/json-schema-type",
        method="POST",
        json=_IMPORT_RESULT,
    )

    result = runner.invoke(
        app,
        [
            "import",
            "json-schema-type",
            "--description",
            "Primary contact email",
            str(schema_path),
        ],
    )

    assert result.exit_code == 0
    body = json.loads(httpx_mock.get_requests()[0].content.decode())
    assert body["document"]["description"] == "Primary contact email"


def test_import_json_schema_type_name_rejected_for_defs_library(
    httpx_mock: object,
    tmp_path: Path,
) -> None:
    """``--name`` exits usage when the document is a multi-type ``$defs`` library."""
    schema_path = tmp_path / "common-types.json"
    _write_document(schema_path, _TYPE_LIBRARY)

    result = runner.invoke(
        app,
        ["import", "json-schema-type", "--name", "ignored", str(schema_path)],
    )

    assert result.exit_code == EXIT_USAGE
    assert "--name applies only when importing a single type" in result.stderr
    assert httpx_mock.get_requests() == []


def test_import_json_schema_type_help_lists_flags() -> None:
    """Subcommand documents PATH and type-import options."""
    result = runner.invoke(app, ["import", "json-schema-type", "--help"])
    assert result.exit_code == 0
    help_text = strip_ansi(result.stdout)
    assert "PATH" in help_text
    assert "--name" in help_text
    assert "--description" in help_text
    assert "--dry-run" in help_text
    assert "--publish" in help_text
    assert "--visibility" in help_text


def test_import_json_schema_type_publish_public_forwards_system(
    httpx_mock: object,
    tmp_path: Path,
) -> None:
    """``--publish public`` sends REST ``system: true``."""
    schema_path = tmp_path / "common-types.json"
    _write_document(schema_path, _TYPE_LIBRARY)
    httpx_mock.add_response(
        url="http://localhost:8000/imports/json-schema-type",
        method="POST",
        status_code=200,
        json={**_IMPORT_RESULT, "system": True, "scope": "system"},
    )

    result = runner.invoke(
        app,
        ["import", "json-schema-type", "--publish", "public", str(schema_path)],
    )

    assert result.exit_code == 0
    body = json.loads(httpx_mock.get_requests()[0].content.decode())
    assert body["system"] is True


def test_import_json_schema_type_publish_private_forwards_system_false(
    httpx_mock: object,
    tmp_path: Path,
) -> None:
    """``--publish private`` sends REST ``system: false``."""
    schema_path = tmp_path / "common-types.json"
    _write_document(schema_path, _TYPE_LIBRARY)
    httpx_mock.add_response(
        url="http://localhost:8000/imports/json-schema-type",
        method="POST",
        status_code=200,
        json={**_IMPORT_RESULT, "system": False, "scope": "tenant"},
    )

    result = runner.invoke(
        app,
        ["import", "json-schema-type", "--publish", "private", str(schema_path)],
    )

    assert result.exit_code == 0
    body = json.loads(httpx_mock.get_requests()[0].content.decode())
    assert body["system"] is False


def test_import_json_schema_type_rejects_publish_and_visibility_together(
    tmp_path: Path,
) -> None:
    """``--publish`` and ``--visibility`` are mutually exclusive."""
    schema_path = tmp_path / "common-types.json"
    _write_document(schema_path, _TYPE_LIBRARY)

    result = runner.invoke(
        app,
        [
            "import",
            "json-schema-type",
            "--publish",
            "public",
            "--visibility",
            "private",
            str(schema_path),
        ],
    )

    assert result.exit_code == EXIT_USAGE
    assert "only one of --publish and --visibility" in result.stderr


def test_import_json_schema_suggests_json_schema_type_command(tmp_path: Path) -> None:
    """``import json-schema`` points users at ``import json-schema-type`` for libraries."""
    schema_path = tmp_path / "common-types.json"
    _write_document(schema_path, _TYPE_LIBRARY)

    result = runner.invoke(app, ["import", "json-schema", str(schema_path)])

    assert result.exit_code == EXIT_USAGE
    assert "import json-schema-type" in result.stderr
    assert "Use: objectified import json-schema-type" in result.stderr


def test_import_json_schema_type_accepts_draft_07_definitions(
    httpx_mock: object,
    tmp_path: Path,
) -> None:
    """Draft 7 ``definitions`` libraries validate locally and upload successfully."""
    draft_7_library = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "definitions": {
            "Email": {
                "type": "string",
                "title": "Email",
                "format": "email",
            },
        },
    }
    schema_path = tmp_path / "legacy-types.json"
    _write_document(schema_path, draft_7_library)
    httpx_mock.add_response(
        url="http://localhost:8000/imports/json-schema-type",
        method="POST",
        status_code=200,
        json={
            **_IMPORT_RESULT,
            "created": 1,
            "updated": 0,
            "entries": [
                {
                    "name": "Email",
                    "slug": "email",
                    "ref_path": "#/definitions/Email",
                    "action": "created",
                    "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                },
            ],
        },
    )

    result = runner.invoke(app, ["import", "json-schema-type", str(schema_path)])

    assert result.exit_code == 0
    body = json.loads(httpx_mock.get_requests()[0].content.decode())
    assert body["document"] == draft_7_library


def test_import_json_schema_type_from_stdin(httpx_mock: object) -> None:
    """Type import accepts stdin (``-``) as the document source."""
    httpx_mock.add_response(
        url="http://localhost:8000/imports/json-schema-type",
        method="POST",
        status_code=200,
        json=_IMPORT_RESULT,
    )

    result = runner.invoke(
        app,
        ["import", "json-schema-type", "-"],
        input=json.dumps(_TYPE_LIBRARY),
    )

    assert result.exit_code == 0
    assert "Import completed." in result.stdout
    assert "Uploading JSON Schema type document stdin" in result.stderr
    body = json.loads(httpx_mock.get_requests()[0].content.decode())
    assert body["document"] == _TYPE_LIBRARY
    assert "source_url" not in body
