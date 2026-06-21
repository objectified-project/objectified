"""Tests for ``objectified import auto`` format detection and routing."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import pytest
from typer.testing import CliRunner

from objectified_cli.exit_codes import EXIT_USAGE
from objectified_cli.main import app

runner = CliRunner()

_OPENAPI_SPEC = {
    "openapi": "3.2.0",
    "info": {"title": "Auto API", "version": "1.0.0"},
    "paths": {},
}

_SWAGGER_SPEC = {
    "swagger": "2.0",
    "info": {"title": "Auto API", "version": "1.0.0"},
    "paths": {},
}

_ARAZZO_SPEC = {
    "arazzo": "1.0.0",
    "info": {"title": "Auto Flow", "version": "1.0.0"},
    "sourceDescriptions": [
        {"name": "api", "url": "https://example.test/openapi.json", "type": "openapi"},
    ],
    "workflows": [
        {
            "workflowId": "flow",
            "steps": [{"stepId": "createCart", "operationId": "createCart"}],
        }
    ],
}

_JSON_SCHEMA_SPEC = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {"id": {"type": "string"}},
}

_TYPE_LIBRARY = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$defs": {
        "Email": {"type": "string", "format": "email"},
    },
}


@pytest.mark.parametrize(
    ("spec", "runner_name"),
    [
        (_OPENAPI_SPEC, "_run_openapi_import"),
        (_SWAGGER_SPEC, "_run_openapi_import"),
        (_ARAZZO_SPEC, "_run_arazzo_import"),
        (_JSON_SCHEMA_SPEC, "_run_json_schema_import"),
        (_TYPE_LIBRARY, "_run_json_schema_type_import"),
    ],
)
def test_import_auto_dispatches_to_matching_runner(
    tmp_path: Path,
    spec: dict,
    runner_name: str,
) -> None:
    """Auto-detect delegates to the importer matching document headers."""
    spec_path = tmp_path / "document.json"
    spec_path.write_text(json.dumps(spec), encoding="utf-8")

    with patch(f"objectified_cli.commands.import_.{runner_name}") as mock_run:
        result = runner.invoke(
            app,
            ["--no-progress", "import", "auto", str(spec_path)],
            env={"OBJECTIFIED_API_KEY": "obj_test_key"},
        )

    assert result.exit_code == 0, result.stderr
    mock_run.assert_called_once()


def test_import_auto_unknown_document_exits_usage(tmp_path: Path) -> None:
    """Unrecognized headers fail before any importer runs."""
    spec_path = tmp_path / "mystery.json"
    spec_path.write_text(json.dumps({"title": "mystery"}), encoding="utf-8")

    with patch("objectified_cli.commands.import_._run_openapi_import") as mock_openapi:
        result = runner.invoke(
            app,
            ["import", "auto", str(spec_path)],
            env={"OBJECTIFIED_API_KEY": "obj_test_key"},
        )

    assert result.exit_code == EXIT_USAGE
    assert "Could not determine import type" in result.stderr
    mock_openapi.assert_not_called()


def test_import_auto_help_lists_command() -> None:
    result = runner.invoke(app, ["import", "auto", "--help"])
    assert result.exit_code == 0
    assert "Detect document format" in result.stdout
