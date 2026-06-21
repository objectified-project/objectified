"""httpx-mocked integration tests for OpenAPI/Arazzo path workflow commands."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from typer.testing import CliRunner

from objectified_cli.exit_codes import EXIT_SUCCESS, EXIT_USAGE
from objectified_cli.main import app

pytestmark = pytest.mark.usefixtures("api_key_env")

_FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"

_PROJECT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
_VERSION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
_TENANT_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
_PATH_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"

_PROJECT = {
    "id": _PROJECT_ID,
    "tenant_id": _TENANT_ID,
    "name": "Payments API",
    "slug": "payments-api",
    "source": "import",
    "enabled": True,
}
_VERSION = {
    "id": _VERSION_ID,
    "project_id": _PROJECT_ID,
    "version": "1.0.0",
    "slug": "1.0.0",
    "source": "import",
    "enabled": True,
}
_PATH = {
    "id": _PATH_ID,
    "version_id": _VERSION_ID,
    "tenant_id": _TENANT_ID,
    "pathname": "/payments",
    "metadata": {},
    "enabled": True,
    "created_on": "2026-01-01T00:00:00Z",
}
_OPERATION = {
    "id": "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    "version_path_id": _PATH_ID,
    "tenant_id": _TENANT_ID,
    "operation": "POST",
    "deprecated": False,
    "metadata": {},
    "enabled": True,
    "created_on": "2026-01-01T00:00:00Z",
    "description": {
        "operation_id": "createPayment",
        "summary": "Create a payment",
        "tags": ["payments"],
    },
}

_ARAZZO_IMPORT_RESULT = {
    "project_id": _PROJECT_ID,
    "version_id": _VERSION_ID,
    "project": _PROJECT,
    "version": _VERSION,
    "created": {
        "schemas": 0,
        "properties": 0,
        "project_properties": 0,
        "version_schemas": 0,
        "workflows_created": 1,
        "steps_created": 2,
    },
    "warnings": [],
    "errors": [],
}


def _mock_project_version_scope(httpx_mock: object) -> None:
    httpx_mock.add_response(
        url="http://localhost:8000/v1/projects/acme-corp",
        json={"total": 1, "offset": 0, "limit": 200, "items": [_PROJECT]},
    )
    httpx_mock.add_response(
        url=(
            "http://localhost:8000/project-versions"
            f"?project_id={_PROJECT_ID}&offset=0&limit=50"
        ),
        json={"total": 1, "offset": 0, "limit": 50, "items": [_VERSION]},
    )


def test_import_arazzo_from_fixture_sync_200(
    httpx_mock: object,
    runner: CliRunner,
) -> None:
    """Import reads the checkout.arazzo.yaml fixture and completes on HTTP 200."""
    fixture = _FIXTURES / "checkout.arazzo.yaml"
    httpx_mock.add_response(
        url="http://localhost:8000/v1/tenants/acme-corp/imports/upload",
        method="POST",
        status_code=200,
        json=_ARAZZO_IMPORT_RESULT,
    )

    result = runner.invoke(app, ["import", "arazzo", str(fixture)])

    assert result.exit_code == EXIT_SUCCESS
    assert "Import completed." in result.stdout
    assert "Created entities" in result.stdout
    assert "Workflows" in result.stdout


def test_path_workflow_inspect_and_export(
    httpx_mock: object,
    runner: CliRunner,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Representative import → paths list → spec export chain against mocked REST."""
    monkeypatch.setenv("OBJECTIFIED_TENANT_ID", "acme-corp")
    reconstructed = (_FIXTURES / "reconstructed-openapi.json").read_bytes()

    _mock_project_version_scope(httpx_mock)
    httpx_mock.add_response(
        url=f"http://localhost:8000/versions/{_VERSION_ID}/paths?offset=0&limit=50",
        json={"total": 1, "offset": 0, "limit": 50, "items": [_PATH]},
    )
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/versions/{_VERSION_ID}/paths/{_PATH_ID}/operations"
            "?offset=0&limit=50"
        ),
        json={"total": 1, "offset": 0, "limit": 50, "items": [_OPERATION]},
    )
    list_result = runner.invoke(
        app,
        ["paths", "list", "--project", "payments-api", "--version", "1.0.0"],
    )
    assert list_result.exit_code == EXIT_SUCCESS
    assert "/payments" in list_result.stdout

    _mock_project_version_scope(httpx_mock)
    httpx_mock.add_response(
        url=f"http://localhost:8000/projects/{_PROJECT_ID}",
        json=_PROJECT,
    )
    httpx_mock.add_response(
        url=f"http://localhost:8000/project-versions/{_VERSION_ID}",
        json=_VERSION,
    )
    httpx_mock.add_response(
        url=f"http://localhost:8000/versions/{_VERSION_ID}/import-fidelity-diff",
        status_code=404,
    )
    httpx_mock.add_response(
        url=(
            "http://localhost:8000/browse/tenants/acme-corp/projects/payments-api"
            "/versions/1.0.0/spec?format=openapi"
        ),
        content=reconstructed,
        headers={"Content-Type": "application/json", "ETag": '"fixture-etag"'},
    )

    out_file = tmp_path / "export.json"
    export_result = runner.invoke(
        app,
        [
            "spec",
            "export",
            "--project",
            "payments-api",
            "--version",
            "1.0.0",
            "--format",
            "openapi",
            "--output",
            str(out_file),
        ],
    )
    assert export_result.exit_code == EXIT_SUCCESS
    assert json.loads(out_file.read_text(encoding="utf-8"))["info"]["title"] == "Payments API"


def test_paths_list_404_maps_to_usage(httpx_mock: object, runner: CliRunner) -> None:
    """HTTP 404 on paths list maps to EXIT_USAGE (4xx client error)."""
    _mock_project_version_scope(httpx_mock)
    httpx_mock.add_response(
        url=f"http://localhost:8000/versions/{_VERSION_ID}/paths?offset=0&limit=50",
        status_code=404,
        json={"code": 404, "message": "Version not found", "details": {}},
    )

    result = runner.invoke(
        app,
        ["paths", "list", "--project", "payments-api", "--version", "1.0.0"],
    )

    assert result.exit_code == EXIT_USAGE
    assert "404" in result.stderr or "not found" in result.stderr.lower()


def test_spec_export_missing_tenant_exits_usage(
    httpx_mock: object,
    runner: CliRunner,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """spec export without tenant scope maps to EXIT_USAGE."""
    monkeypatch.delenv("OBJECTIFIED_TENANT_ID", raising=False)

    result = runner.invoke(
        app,
        [
            "spec",
            "export",
            "--project",
            "payments-api",
            "--version",
            "1.0.0",
            "--format",
            "openapi",
            "--output",
            "-",
        ],
    )

    assert result.exit_code == EXIT_USAGE
    assert "tenant" in result.stderr.lower()


def test_fixtures_contain_no_secrets() -> None:
    """Fixture documents must not embed credentials or PII patterns."""
    forbidden = ("obj_", "password", "secret", "api_key", "bearer ")
    for path in _FIXTURES.glob("*"):
        if path.suffix in {".yaml", ".json"}:
            text = path.read_text(encoding="utf-8").lower()
            for token in forbidden:
                assert token not in text, f"{path.name} must not contain {token!r}"
