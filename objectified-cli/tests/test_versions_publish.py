"""Tests for ``versions publish`` and ``versions unpublish`` commands."""

from __future__ import annotations

import json

import pytest
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

_PROJECT = {
    "id": _PROJECT_ID,
    "tenant_id": "11111111-1111-4111-8111-111111111111",
    "name": "Payments API",
    "slug": "payments-api",
    "source": "manual",
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


def _published(visibility: str = "public") -> dict[str, object]:
    return {
        "id": _VERSION_ID,
        "project_id": _PROJECT_ID,
        "version": "1.0.0",
        "slug": "1.0.0",
        "source": "import",
        "data": {},
        "enabled": True,
        "publish_visibility": visibility,
        "published_on": "2026-06-14T00:00:00Z",
    }


def _draft() -> dict[str, object]:
    return {
        "id": _VERSION_ID,
        "project_id": _PROJECT_ID,
        "version": "1.0.0",
        "slug": "1.0.0",
        "source": "import",
        "data": {},
        "enabled": True,
        "publish_visibility": "draft",
        "published_on": None,
    }


def test_publish_by_uuid_defaults_to_public(httpx_mock: object) -> None:
    """publish posts visibility=public by default and echoes the API JSON."""
    httpx_mock.add_response(
        method="POST",
        url=f"http://localhost:8000/project-versions/{_VERSION_ID}/publish",
        json=_published("public"),
    )
    result = runner.invoke(
        app,
        ["--json", "versions", "publish", _VERSION_ID],
        env=_API_KEY_ENV,
    )
    assert result.exit_code == EXIT_SUCCESS
    assert json.loads(result.stdout.strip()) == _published("public")
    request = httpx_mock.get_requests()[0]
    assert json.loads(request.content) == {"visibility": "public"}
    assert request.headers["X-API-Key"] == "obj_test_key"


def test_publish_private_maps_to_protected(httpx_mock: object) -> None:
    """--visibility private sends the API ``protected`` enum value."""
    httpx_mock.add_response(
        method="POST",
        url=f"http://localhost:8000/project-versions/{_VERSION_ID}/publish",
        json=_published("protected"),
    )
    result = runner.invoke(
        app,
        ["versions", "publish", _VERSION_ID, "--visibility", "private"],
        env=_API_KEY_ENV,
    )
    assert result.exit_code == EXIT_SUCCESS
    request = httpx_mock.get_requests()[0]
    assert json.loads(request.content) == {"visibility": "protected"}


def test_publish_human_table_shows_visibility(httpx_mock: object) -> None:
    """Default publish output renders a record table including visibility."""
    httpx_mock.add_response(
        method="POST",
        url=f"http://localhost:8000/project-versions/{_VERSION_ID}/publish",
        json=_published("public"),
    )
    result = runner.invoke(
        app,
        ["versions", "publish", _VERSION_ID],
        env=_API_KEY_ENV,
    )
    assert result.exit_code == EXIT_SUCCESS
    assert "Visibility" in result.stdout
    assert "public" in result.stdout
    assert result.stdout.strip().startswith("{") is False


def test_publish_by_project_and_label_resolves(httpx_mock: object) -> None:
    """--project + a version label resolves to the version UUID before publishing."""
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
    httpx_mock.add_response(
        method="POST",
        url=f"http://localhost:8000/project-versions/{_VERSION_ID}/publish",
        json=_published("public"),
    )
    result = runner.invoke(
        app,
        ["versions", "publish", "1.0.0", "--project", "payments-api"],
        env=_API_KEY_ENV,
    )
    assert result.exit_code == EXIT_SUCCESS
    publish_request = httpx_mock.get_requests()[-1]
    assert publish_request.url.path == f"/project-versions/{_VERSION_ID}/publish"
    assert json.loads(publish_request.content) == {"visibility": "public"}


def test_publish_rejects_invalid_visibility() -> None:
    """An unsupported visibility fails fast without issuing a request."""
    result = runner.invoke(
        app,
        ["versions", "publish", _VERSION_ID, "--visibility", "draft"],
        env=_API_KEY_ENV,
    )
    assert result.exit_code == EXIT_USAGE
    assert "public" in result.stdout or "public" in (result.stderr or "")


def test_publish_slug_without_project_is_usage_error() -> None:
    """A non-UUID version with no --project cannot be resolved."""
    result = runner.invoke(
        app,
        ["versions", "publish", "1.0.0"],
        env=_API_KEY_ENV,
    )
    assert result.exit_code == EXIT_USAGE


def test_unpublish_by_uuid_returns_draft(httpx_mock: object) -> None:
    """unpublish posts to the unpublish route with no body and shows draft state."""
    httpx_mock.add_response(
        method="POST",
        url=f"http://localhost:8000/project-versions/{_VERSION_ID}/unpublish",
        json=_draft(),
    )
    result = runner.invoke(
        app,
        ["versions", "unpublish", _VERSION_ID],
        env=_API_KEY_ENV,
    )
    assert result.exit_code == EXIT_SUCCESS
    assert "draft" in result.stdout
    request = httpx_mock.get_requests()[0]
    assert request.url.path == f"/project-versions/{_VERSION_ID}/unpublish"
    assert not request.content


def test_unpublish_json_mode(httpx_mock: object) -> None:
    """--json unpublish echoes the raw API JSON."""
    httpx_mock.add_response(
        method="POST",
        url=f"http://localhost:8000/project-versions/{_VERSION_ID}/unpublish",
        json=_draft(),
    )
    result = runner.invoke(
        app,
        ["--json", "versions", "unpublish", _VERSION_ID],
        env=_API_KEY_ENV,
    )
    assert result.exit_code == EXIT_SUCCESS
    assert json.loads(result.stdout.strip()) == _draft()


def test_publish_requires_api_key() -> None:
    """Tier-2 publish fails fast when no API key is configured."""
    result = runner.invoke(
        app,
        ["versions", "publish", _VERSION_ID],
        env={"OBJECTIFIED_BASE_URL": "http://localhost:8000"},
    )
    assert result.exit_code != EXIT_SUCCESS


@pytest.mark.parametrize("subcommand", ["publish", "unpublish"])
def test_publish_unpublish_support_help(subcommand: str) -> None:
    """Both lifecycle commands accept --help (clig.dev)."""
    result = runner.invoke(app, ["versions", subcommand, "--help"])
    assert result.exit_code == EXIT_SUCCESS
    assert "Usage:" in result.stdout
