"""Integration tests for versions list/get output modes."""

from __future__ import annotations

import json

from typer.testing import CliRunner

from objectified_cli.exit_codes import EXIT_SUCCESS, EXIT_USAGE
from objectified_cli.main import app

runner = CliRunner()

_API_KEY_ENV = {
    "OBJECTIFIED_API_KEY": "obj_test_key",
    "OBJECTIFIED_BASE_URL": "http://localhost:8000",
    "OBJECTIFIED_TENANT_ID": "acme-corp",
}

_PROJECT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
_VERSION_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"

_PROJECTS_PAYLOAD = [
    {
        "id": _PROJECT_ID,
        "name": "Payments API",
        "slug": "payments-api",
        "enabled": True,
    },
]

_VERSIONS_PAYLOAD = [
    {
        "id": _VERSION_ID,
        "project_id": _PROJECT_ID,
        "version": "1.0.0",
        "slug": "v1-0-0",
        "source": "manual",
        "data": {"description": "Initial release"},
        "enabled": True,
    },
]


def _mock_projects_lookup(httpx_mock: object) -> None:
    httpx_mock.add_response(
        url="http://localhost:8000/v1/projects/acme-corp",
        json=_PROJECTS_PAYLOAD,
    )


def _mock_versions_for_project(httpx_mock: object) -> None:
    httpx_mock.add_response(
        url=f"http://localhost:8000/v1/versions/acme-corp/{_PROJECT_ID}",
        json=_VERSIONS_PAYLOAD,
    )


def test_versions_list_json_mode(httpx_mock: object) -> None:
    """--json versions list emits a {total, items} JSON envelope."""
    _mock_projects_lookup(httpx_mock)
    _mock_versions_for_project(httpx_mock)
    result = runner.invoke(app, ["--json", "versions", "list"], env=_API_KEY_ENV)
    assert result.exit_code == EXIT_SUCCESS
    assert json.loads(result.stdout.strip()) == {"total": 1, "items": _VERSIONS_PAYLOAD}


def test_versions_list_human_table(httpx_mock: object) -> None:
    """Default versions list renders a table with project name/slug and version data."""
    _mock_projects_lookup(httpx_mock)
    _mock_versions_for_project(httpx_mock)
    result = runner.invoke(app, ["versions", "list"], env=_API_KEY_ENV)
    assert result.exit_code == EXIT_SUCCESS
    assert "1.0.0" in result.stdout
    assert "v1-0-0" in result.stdout
    assert "manual" in result.stdout
    assert "Payments" in result.stdout
    assert "API" in result.stdout
    assert "payments-" in result.stdout
    assert "Project" in result.stdout
    assert "Showing 1 of 1" in result.stdout
    assert result.stdout.strip().startswith("{") is False


def test_versions_list_with_project_id_filter(httpx_mock: object) -> None:
    """--project-id passes project_id as a query parameter to the API."""
    httpx_mock.add_response(
        url=f"http://localhost:8000/project-versions?project_id={_PROJECT_ID}&offset=0&limit=50",
        json=_LIST_PAYLOAD,
    )
    _mock_projects_lookup(httpx_mock)
    result = runner.invoke(
        app,
        ["versions", "list", "--project-id", _PROJECT_ID],
        env=_API_KEY_ENV,
    )
    assert result.exit_code == EXIT_SUCCESS
    assert "1.0.0" in result.stdout
    assert "Payments" in result.stdout
    assert "API" in result.stdout
    assert "Showing 1 of 1" in result.stdout


def test_versions_list_with_project_id_filter_json(httpx_mock: object) -> None:
    """--json --project-id emits a JSON envelope filtered by the given project."""
    httpx_mock.add_response(
        url=f"http://localhost:8000/project-versions?project_id={_PROJECT_ID}&offset=0&limit=50",
        json=_LIST_PAYLOAD,
    )
    result = runner.invoke(
        app,
        ["--json", "versions", "list", "--project-id", _PROJECT_ID],
        env=_API_KEY_ENV,
    )
    assert result.exit_code == EXIT_SUCCESS
    payload = json.loads(result.stdout.strip())
    assert payload["total"] == 1
    assert payload["items"][0]["project_id"] == _PROJECT_ID


def test_versions_list_rejects_invalid_project_uuid() -> None:
    """versions list --project-id fails fast when the value is not a UUID."""
    result = runner.invoke(app, ["versions", "list", "--project-id", "not-a-uuid"])
    assert result.exit_code == EXIT_USAGE


def test_versions_get_json_mode(httpx_mock: object) -> None:
    """--json versions get prints raw API JSON."""
    httpx_mock.add_response(
        url=f"http://localhost:8000/project-versions/{_VERSION_ID}",
        json=_GET_PAYLOAD,
    )
    result = runner.invoke(
        app,
        ["--json", "versions", "get", _VERSION_ID],
        env=_API_KEY_ENV,
    )
    assert result.exit_code == EXIT_SUCCESS
    assert json.loads(result.stdout.strip()) == _GET_PAYLOAD


def test_versions_get_human_table(httpx_mock: object) -> None:
    """Default versions get renders field/value rows including project_id."""
    httpx_mock.add_response(
        url=f"http://localhost:8000/project-versions/{_VERSION_ID}",
        json=_GET_PAYLOAD,
    )
    result = runner.invoke(app, ["versions", "get", _VERSION_ID], env=_API_KEY_ENV)
    assert result.exit_code == EXIT_SUCCESS
    assert "1.0.0" in result.stdout
    assert "Field" in result.stdout
    assert result.stdout.strip().startswith("{") is False


def test_versions_get_rejects_invalid_uuid() -> None:
    """versions get fails fast when version id is not a UUID."""
    result = runner.invoke(app, ["versions", "get", "not-a-uuid"])
    assert result.exit_code == EXIT_USAGE


def test_versions_list_sends_api_key_header(httpx_mock: object) -> None:
    """RestClient forwards OBJECTIFIED_API_KEY as X-API-Key."""
    httpx_mock.add_response(
        url="http://localhost:8000/project-versions?offset=0&limit=10",
        json=_LIST_PAYLOAD,
    )
    _mock_projects_lookup(httpx_mock)
    result = runner.invoke(
        app,
        ["versions", "list", "--limit", "10"],
        env=_API_KEY_ENV,
    )
    assert result.exit_code == EXIT_SUCCESS
    request = httpx_mock.get_requests()[0]
    assert request.headers["X-API-Key"] == "obj_test_key"


# ---------------------------------------------------------------------------
# --all flag (multi-page fetching)
# ---------------------------------------------------------------------------

_PAGE_1_PAYLOAD = {
    "total": 3,
    "offset": 0,
    "limit": 2,
    "items": [
        {
            "id": "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            "project_id": _PROJECT_ID,
            "version": "1.0.0",
            "slug": "v1-0-0",
            "source": "manual",
            "data": {},
            "enabled": True,
        },
        {
            "id": "ffffffff-ffff-4fff-8fff-ffffffffffff",
            "project_id": _PROJECT_ID,
            "version": "1.1.0",
            "slug": "v1-1-0",
            "source": "manual",
            "data": {},
            "enabled": True,
        },
    ],
}

_PAGE_2_PAYLOAD = {
    "total": 3,
    "offset": 2,
    "limit": 2,
    "items": [
        {
            "id": "11111111-1111-4111-8111-111111111111",
            "project_id": _PROJECT_ID,
            "version": "2.0.0",
            "slug": "v2-0-0",
            "source": "import",
            "data": {},
            "enabled": True,
        },
    ],
}


def test_versions_list_all_fetches_multiple_pages(httpx_mock: object) -> None:
    """--all issues multiple requests to collect all pages."""
    httpx_mock.add_response(
        url="http://localhost:8000/project-versions?offset=0&limit=2",
        json=_PAGE_1_PAYLOAD,
    )
    httpx_mock.add_response(
        url="http://localhost:8000/project-versions?offset=2&limit=2",
        json=_PAGE_2_PAYLOAD,
    )
    _mock_projects_lookup(httpx_mock)
    result = runner.invoke(
        app,
        ["versions", "list", "--limit", "2", "--all"],
        env=_API_KEY_ENV,
    )
    assert result.exit_code == EXIT_SUCCESS
    assert "1.0.0" in result.stdout
    assert "1.1.0" in result.stdout
    assert "2.0.0" in result.stdout
    assert "Showing 3 of 3" in result.stdout


def test_versions_list_all_json_mode(httpx_mock: object) -> None:
    """--all --json emits a combined JSON envelope with all items."""
    httpx_mock.add_response(
        url="http://localhost:8000/project-versions?offset=0&limit=2",
        json=_PAGE_1_PAYLOAD,
    )
    httpx_mock.add_response(
        url="http://localhost:8000/project-versions?offset=2&limit=2",
        json=_PAGE_2_PAYLOAD,
    )
    result = runner.invoke(
        app,
        ["--json", "versions", "list", "--limit", "2", "--all"],
        env=_API_KEY_ENV,
    )
    assert result.exit_code == EXIT_SUCCESS
    payload = json.loads(result.stdout.strip())
    assert payload["total"] == 3
    assert len(payload["items"]) == 3
    slugs = [item["slug"] for item in payload["items"]]
    assert slugs == ["v1-0-0", "v1-1-0", "v2-0-0"]


def test_versions_list_without_all_stops_after_first_page(httpx_mock: object) -> None:
    """Without --all, only one page is fetched even when total > limit."""
    httpx_mock.add_response(
        url="http://localhost:8000/project-versions?offset=0&limit=2",
        json=_PAGE_1_PAYLOAD,
    )
    _mock_projects_lookup(httpx_mock)
    result = runner.invoke(
        app,
        ["versions", "list", "--limit", "2"],
        env=_API_KEY_ENV,
    )
    assert result.exit_code == EXIT_SUCCESS
    assert "1.0.0" in result.stdout
    assert "1.1.0" in result.stdout
    version_list_requests = [
        request
        for request in httpx_mock.get_requests()
        if request.url.path == "/project-versions"
    ]
    assert len(version_list_requests) == 1


def test_versions_list_all_with_project_id_filter(httpx_mock: object) -> None:
    """--all --project-id combines pagination with the project filter."""
    page1 = {
        "total": 2,
        "offset": 0,
        "limit": 1,
        "items": [_PAGE_1_PAYLOAD["items"][0]],
    }
    page2 = {
        "total": 2,
        "offset": 1,
        "limit": 1,
        "items": [_PAGE_1_PAYLOAD["items"][1]],
    }
    httpx_mock.add_response(
        url=f"http://localhost:8000/project-versions?project_id={_PROJECT_ID}&offset=0&limit=1",
        json=page1,
    )
    httpx_mock.add_response(
        url=f"http://localhost:8000/project-versions?project_id={_PROJECT_ID}&offset=1&limit=1",
        json=page2,
    )
    _mock_projects_lookup(httpx_mock)
    result = runner.invoke(
        app,
        ["versions", "list", "--project-id", _PROJECT_ID, "--limit", "1", "--all"],
        env=_API_KEY_ENV,
    )
    assert result.exit_code == EXIT_SUCCESS
    assert "1.0.0" in result.stdout
    assert "1.1.0" in result.stdout
    assert "Showing 2 of 2" in result.stdout
