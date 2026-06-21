"""Tests for tenant repository list and add commands."""

from __future__ import annotations

import json

import pytest
from typer.testing import CliRunner

from objectified_cli.exit_codes import EXIT_ERROR, EXIT_SUCCESS, EXIT_USAGE
from objectified_cli.main import app

from helpers import strip_ansi

runner = CliRunner()

_TENANT_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
_REPO_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
_REPO_ID_2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

_REPO_ITEM = {
    "id": _REPO_ID,
    "tenant_id": _TENANT_ID,
    "name": "API Specs",
    "provider": "github",
    "linked_account_id": None,
    "clone_url": "https://github.com/acme/api-specs.git",
    "default_branch": "main",
    "visibility": "private",
    "status": "ready",
    "last_scanned_at": "2026-06-07T12:00:00Z",
    "total_files": 12,
    "total_bytes": 4096,
    "last_error_message": None,
    "enabled": True,
    "created_on": "2026-06-01T00:00:00Z",
    "updated_on": None,
    "deleted_on": None,
    "_links": {
        "self": {"href": f"/tenants/{_TENANT_ID}/repositories/{_REPO_ID}"},
        "files": {"href": f"/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files"},
        "imports": {"href": f"/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/imports"},
        "scans": {"href": f"/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/scans"},
        "branches": {"href": f"/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/branches"},
    },
}

_REPO_ITEM_2 = {
    **_REPO_ITEM,
    "id": _REPO_ID_2,
    "name": "Public Specs",
    "provider": "public_url",
    "status": "pending",
    "last_scanned_at": None,
    "total_files": 0,
}

_LINKED_ACCOUNT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"

_LINKED_ACCOUNTS_PAYLOAD = {
    "generated_on": "2026-06-07T12:00:00Z",
    "active_tenant_id": _TENANT_ID,
    "sections": [
        {
            "category": "source_control",
            "title": "Source control",
            "description": "Git hosts",
            "connected_count": 1,
            "items": [
                {
                    "id": _LINKED_ACCOUNT_ID,
                    "provider": "github",
                    "display_name": "Acme GitHub",
                    "status": "connected",
                    "summary": None,
                    "external_account_ref": "acme-org",
                    "last_sync_on": None,
                    "expires_on": None,
                    "error_count": 0,
                    "last_error": None,
                    "scope": "tenant",
                    "data": {},
                },
            ],
        },
    ],
}

_ACCESSIBLE_REPOS_PAYLOAD = {
    "generated_on": "2026-06-07T12:00:00Z",
    "linked_account_id": _LINKED_ACCOUNT_ID,
    "provider": "github",
    "items": [
        {
            "provider_repository_id": "123",
            "name": "api-specs",
            "full_name": "acme/api-specs",
            "description": None,
            "provider": "github",
            "default_branch": "main",
            "visibility": "private",
            "clone_url": "https://github.com/acme/api-specs.git",
            "html_url": "https://github.com/acme/api-specs",
            "already_registered": False,
        },
    ],
}

_PUBLIC_PREFLIGHT = {
    "provider": "github",
    "clone_url": "https://github.com/acme/public-specs.git",
    "default_branch": "main",
    "visibility": "public",
}

_PUBLIC_CREATE_BODY = {
    "connection_type": "public_url",
    "clone_url": "https://github.com/acme/public-specs.git",
    "name": "public-specs",
    "default_branch": "main",
    "visibility": "public",
}

_LINKED_CREATE_BODY = {
    "connection_type": "linked_account",
    "provider": "github",
    "linked_account_id": _LINKED_ACCOUNT_ID,
    "clone_url": "https://github.com/acme/api-specs.git",
    "name": "api-specs",
    "default_branch": "main",
    "visibility": "private",
}

_SCAN_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"

_SCAN_ENQUEUE_RESULT = {
    "scan_id": _SCAN_ID,
    "branch_id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "branch": "main",
    "status": "queued",
    "created": True,
}

_SCAN_DONE_RESULT = {
    "scan_id": _SCAN_ID,
    "branch_id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "branch": "main",
    "status": "done",
    "queued_at": "2026-06-07T12:00:00Z",
    "files_seen": 42,
    "files_added": 5,
    "files_changed": 2,
    "files_removed": 1,
    "attempts": 1,
}

_FILE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"

_FILE_ITEM = {
    "id": _FILE_ID,
    "repository_id": _REPO_ID,
    "branch_id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "path": "openapi.yaml",
    "name": "openapi.yaml",
    "ext": "yaml",
    "size_bytes": 128,
    "blob_sha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "commit_sha": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "content_integrity_verified": True,
    "signature_status": "valid",
    "last_commit_sha": None,
    "last_commit_at": None,
    "detected_kind": "openapi-candidate",
    "detected_confidence": "filename_only",
    "importable": True,
    "import_blocked_reason": None,
    "enabled": True,
    "created_on": "2026-06-07T12:00:00Z",
    "updated_on": None,
    "deleted_on": None,
    "_links": {
        "self": {
            "href": (
                f"/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files/{_FILE_ID}"
            ),
        },
        "content": {
            "href": (
                f"/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files/{_FILE_ID}/content"
            ),
        },
        "sniff": {
            "href": (
                f"/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files/{_FILE_ID}/sniff"
            ),
        },
        "import": {
            "href": (
                f"/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files/{_FILE_ID}/import"
            ),
        },
    },
}

_FILE_ITEM_2 = {
    **_FILE_ITEM,
    "id": "11111111-1111-4111-8111-111111111111",
    "path": "docs/readme.md",
    "name": "readme.md",
    "ext": "md",
    "size_bytes": 64,
    "detected_kind": None,
    "detected_confidence": None,
    "importable": None,
}

_FAILED_FILE_ITEM = {
    **_FILE_ITEM,
    "id": "22222222-2222-4222-8222-222222222222",
    "path": "broken.yaml",
    "name": "broken.yaml",
    "content_integrity_verified": False,
    "signature_status": "invalid",
    "importable": False,
    "import_blocked_reason": "Git blob integrity verification failed.",
}


@pytest.fixture
def repos_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OBJECTIFIED_API_KEY", "obj_test_workspace_key")
    monkeypatch.setenv("OBJECTIFIED_BASE_URL", "http://localhost:8000")
    monkeypatch.setenv("OBJECTIFIED_TENANT_ID", _TENANT_ID)


@pytest.fixture
def api_key_only_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OBJECTIFIED_API_KEY", "obj_test_workspace_key")
    monkeypatch.setenv("OBJECTIFIED_BASE_URL", "http://localhost:8000")


@pytest.fixture
def session_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OBJECTIFIED_SESSION_TOKEN", "obj_sess_test_token")


@pytest.fixture
def repos_add_env(monkeypatch: pytest.MonkeyPatch, repos_env: None, session_env: None) -> None:
    """API key, tenant, and session token for repository registration."""


def test_repos_list_requires_api_key() -> None:
    result = runner.invoke(app, ["repos", "list"])
    assert result.exit_code == EXIT_USAGE
    assert "API key required" in strip_ansi(result.stderr)


def test_repos_list_requires_tenant_scope(api_key_only_env: None) -> None:
    result = runner.invoke(app, ["repos", "list"])
    assert result.exit_code == EXIT_USAGE
    assert "Tenant scope required" in strip_ansi(result.stderr)


def test_repos_list_human_output(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories"
            "?offset=0&limit=50"
        ),
        json={"items": [_REPO_ITEM], "total": 1, "offset": 0, "limit": 50},
        match_headers={"X-API-Key": "obj_test_workspace_key"},
    )
    result = runner.invoke(app, ["repos", "list"])
    assert result.exit_code == EXIT_SUCCESS
    output = strip_ansi(result.stdout)
    assert "API" in output
    assert "Specs" in output
    assert "github" in output
    assert "ready" in output
    assert "main" in output
    assert "private" in output
    assert "12" in output
    assert "Showing 1 of 1" in output


def test_repos_list_json_format(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories"
            "?offset=0&limit=50"
        ),
        json={"items": [_REPO_ITEM], "total": 1, "offset": 0, "limit": 50},
    )
    result = runner.invoke(app, ["repos", "list", "--format", "json"])
    assert result.exit_code == EXIT_SUCCESS
    payload = json.loads(result.stdout)
    assert payload["total"] == 1
    assert payload["items"][0]["name"] == "API Specs"
    assert payload["items"][0]["provider"] == "github"


def test_repos_list_global_json_flag(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories"
            "?offset=0&limit=50"
        ),
        json={"items": [_REPO_ITEM], "total": 1, "offset": 0, "limit": 50},
    )
    result = runner.invoke(app, ["--json", "repos", "list"])
    assert result.exit_code == EXIT_SUCCESS
    payload = json.loads(result.stdout)
    assert payload["items"][0]["status"] == "ready"


def test_repos_list_filtered_by_provider_status_and_name(
    httpx_mock: object,
    repos_env: None,
) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories"
            "?provider=github&status=ready&name=API&offset=0&limit=50"
        ),
        json={"items": [_REPO_ITEM], "total": 1, "offset": 0, "limit": 50},
    )
    result = runner.invoke(
        app,
        [
            "repos",
            "list",
            "--provider",
            "github",
            "--status",
            "ready",
            "--name",
            "API",
        ],
    )
    assert result.exit_code == EXIT_SUCCESS
    output = strip_ansi(result.stdout)
    assert "API" in output
    assert "Specs" in output
    assert "Public" not in output


def test_repos_list_rejects_invalid_provider(repos_env: None) -> None:
    result = runner.invoke(app, ["repos", "list", "--provider", "svn"])
    assert result.exit_code != EXIT_SUCCESS
    assert "provider must be one of" in strip_ansi(result.output)


def test_repos_list_rejects_invalid_status(repos_env: None) -> None:
    result = runner.invoke(app, ["repos", "list", "--status", "deleted"])
    assert result.exit_code != EXIT_SUCCESS
    assert "status must be one of" in strip_ansi(result.output)


def test_repos_list_rejects_invalid_format(repos_env: None) -> None:
    result = runner.invoke(app, ["repos", "list", "--format", "yaml"])
    assert result.exit_code != EXIT_SUCCESS
    assert "format must be 'table' or 'json'" in strip_ansi(result.output)


def test_repos_list_empty_human_output(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories"
            "?offset=0&limit=50"
        ),
        json={"items": [], "total": 0, "offset": 0, "limit": 50},
    )
    result = runner.invoke(app, ["repos", "list"])
    assert result.exit_code == EXIT_SUCCESS
    output = strip_ansi(result.stdout)
    assert "No items." in output
    assert "Total: 0" in output


_LIST_PAGE_1 = {
    "items": [_REPO_ITEM, _REPO_ITEM_2],
    "total": 3,
    "offset": 0,
    "limit": 2,
}

_LIST_PAGE_2 = {
    "items": [
        {
            **_REPO_ITEM,
            "id": "33333333-3333-4333-8333-333333333333",
            "name": "Third Repo",
            "status": "archived",
        },
    ],
    "total": 3,
    "offset": 2,
    "limit": 2,
}


def test_repos_list_all_fetches_multiple_pages(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories"
            "?offset=0&limit=2"
        ),
        json=_LIST_PAGE_1,
    )
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories"
            "?offset=2&limit=2"
        ),
        json=_LIST_PAGE_2,
    )
    result = runner.invoke(app, ["repos", "list", "--limit", "2", "--all"])
    assert result.exit_code == EXIT_SUCCESS
    output = strip_ansi(result.stdout)
    assert "API" in output
    assert "Specs" in output
    assert "Public" in output
    assert "Third" in output
    assert "Repo" in output
    assert "Showing 3 of 3" in output


def test_repos_list_all_json_mode(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories"
            "?offset=0&limit=2"
        ),
        json=_LIST_PAGE_1,
    )
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories"
            "?offset=2&limit=2"
        ),
        json=_LIST_PAGE_2,
    )
    result = runner.invoke(app, ["--json", "repos", "list", "--limit", "2", "--all"])
    assert result.exit_code == EXIT_SUCCESS
    payload = json.loads(result.stdout.strip())
    assert payload["total"] == 3
    assert len(payload["items"]) == 3


def test_repos_list_without_all_stops_after_first_page(
    httpx_mock: object,
    repos_env: None,
) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories"
            "?offset=0&limit=2"
        ),
        json=_LIST_PAGE_1,
    )
    result = runner.invoke(app, ["repos", "list", "--limit", "2"])
    assert result.exit_code == EXIT_SUCCESS
    output = strip_ansi(result.stdout)
    assert "API" in output
    assert "Specs" in output
    assert "Public" in output
    assert "Third" not in output
    assert "Showing 2 of 3" in output


def test_repos_list_resolves_tenant_slug(httpx_mock: object, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OBJECTIFIED_API_KEY", "obj_test_workspace_key")
    monkeypatch.setenv("OBJECTIFIED_BASE_URL", "http://localhost:8000")
    monkeypatch.setenv("OBJECTIFIED_TENANT_ID", "acme-corp")

    httpx_mock.add_response(
        url="http://localhost:8000/tenants?offset=0&limit=200",
        json={
            "items": [{"id": _TENANT_ID, "slug": "acme-corp"}],
            "total": 1,
            "offset": 0,
            "limit": 200,
        },
    )
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories"
            "?offset=0&limit=50"
        ),
        json={"items": [_REPO_ITEM_2], "total": 1, "offset": 0, "limit": 50},
    )

    result = runner.invoke(app, ["repos", "list"])
    assert result.exit_code == EXIT_SUCCESS
    output = strip_ansi(result.stdout)
    assert "Public" in output
    assert "Specs" in output
    assert "public" in output


def test_repos_help_lists_subcommands() -> None:
    group_result = runner.invoke(app, ["repos", "--help"])
    assert group_result.exit_code == EXIT_SUCCESS
    group_help = strip_ansi(group_result.stdout)
    assert "list" in group_help
    assert "files" in group_help
    assert "add" in group_help
    assert "scan" in group_help
    assert "inspect" in group_help
    assert "verify" in group_help

    inspect_result = runner.invoke(app, ["repos", "inspect", "--help"])
    assert inspect_result.exit_code == EXIT_SUCCESS
    inspect_help = strip_ansi(inspect_result.stdout)
    assert "--format" in inspect_help
    assert "--closure" in inspect_help
    assert "--deep" in inspect_help

    files_result = runner.invoke(app, ["repos", "files", "--help"])
    assert files_result.exit_code == EXIT_SUCCESS
    files_help = strip_ansi(files_result.stdout)
    assert "--glob" in files_help
    assert "--regex" in files_help
    assert "--preset" in files_help
    assert "--detected-kind" in files_help
    assert "--importable" in files_help
    assert "--closure" in files_help

    list_result = runner.invoke(app, ["repos", "list", "--help"])
    assert list_result.exit_code == EXIT_SUCCESS
    list_help = strip_ansi(list_result.stdout)
    assert "--provider" in list_help
    assert "--status" in list_help
    assert "--format" in list_help

    add_result = runner.invoke(app, ["repos", "add", "--help"])
    assert add_result.exit_code == EXIT_SUCCESS
    add_help = strip_ansi(add_result.stdout)
    assert "--account" in add_help
    assert "--repo" in add_help
    assert "--url" in add_help
    assert "--branch" in add_help

    scan_result = runner.invoke(app, ["repos", "scan", "--help"])
    assert scan_result.exit_code == EXIT_SUCCESS
    scan_help = strip_ansi(scan_result.stdout)
    assert "--wait" in scan_help
    assert "--branch" in scan_help
    assert "--poll-interval" in scan_help


def test_repos_add_requires_api_key() -> None:
    result = runner.invoke(
        app,
        ["repos", "add", "--url", "https://github.com/acme/public-specs.git"],
    )
    assert result.exit_code == EXIT_USAGE
    assert "API key required" in strip_ansi(result.stderr)


def test_repos_add_requires_tenant_scope(api_key_only_env: None) -> None:
    result = runner.invoke(
        app,
        ["repos", "add", "--url", "https://github.com/acme/public-specs.git"],
    )
    assert result.exit_code == EXIT_USAGE
    assert "Tenant scope required" in strip_ansi(result.stderr)


def test_repos_add_requires_mode(repos_env: None) -> None:
    result = runner.invoke(app, ["repos", "add"])
    assert result.exit_code == EXIT_USAGE
    assert "Register a repository" in strip_ansi(result.output)


def test_repos_add_rejects_mixed_modes(repos_env: None) -> None:
    result = runner.invoke(
        app,
        [
            "repos",
            "add",
            "--url",
            "https://github.com/acme/public-specs.git",
            "--account",
            "Acme GitHub",
            "--repo",
            "acme/api-specs",
        ],
    )
    assert result.exit_code == EXIT_USAGE
    assert "not both" in strip_ansi(result.output)


def test_repos_add_public_url_human_output(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/test-public-url"
        ),
        method="POST",
        json=_PUBLIC_PREFLIGHT,
        match_headers={"X-API-Key": "obj_test_workspace_key"},
    )
    httpx_mock.add_response(
        url=f"http://localhost:8000/tenants/{_TENANT_ID}/repositories",
        method="POST",
        json=_REPO_ITEM_2,
        match_headers={"X-API-Key": "obj_test_workspace_key"},
        match_json=_PUBLIC_CREATE_BODY,
    )

    result = runner.invoke(
        app,
        ["repos", "add", "--url", "https://github.com/acme/public-specs.git"],
    )
    assert result.exit_code == EXIT_SUCCESS
    output = strip_ansi(result.stdout)
    assert "Repository registered." in output
    assert "Public" in output
    assert "Specs" in output
    assert "public" in output
    assert "pending" in output


def test_repos_add_public_url_json_format(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/test-public-url"
        ),
        method="POST",
        json=_PUBLIC_PREFLIGHT,
    )
    httpx_mock.add_response(
        url=f"http://localhost:8000/tenants/{_TENANT_ID}/repositories",
        method="POST",
        json=_REPO_ITEM_2,
        match_json=_PUBLIC_CREATE_BODY,
    )

    result = runner.invoke(
        app,
        [
            "repos",
            "add",
            "--url",
            "https://github.com/acme/public-specs.git",
            "--format",
            "json",
        ],
    )
    assert result.exit_code == EXIT_SUCCESS
    payload = json.loads(result.stdout)
    assert payload["name"] == "Public Specs"
    assert payload["provider"] == "public_url"


def test_repos_add_public_url_honors_branch_override(
    httpx_mock: object,
    repos_env: None,
) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/test-public-url"
        ),
        method="POST",
        json=_PUBLIC_PREFLIGHT,
    )
    httpx_mock.add_response(
        url=f"http://localhost:8000/tenants/{_TENANT_ID}/repositories",
        method="POST",
        json=_REPO_ITEM_2,
        match_json={**_PUBLIC_CREATE_BODY, "default_branch": "release"},
    )

    result = runner.invoke(
        app,
        [
            "repos",
            "add",
            "--url",
            "https://github.com/acme/public-specs.git",
            "--branch",
            "release",
        ],
    )
    assert result.exit_code == EXIT_SUCCESS
    assert "Repository registered." in strip_ansi(result.stdout)


def test_repos_add_linked_account_requires_session_token(repos_env: None) -> None:
    result = runner.invoke(
        app,
        [
            "repos",
            "add",
            "--account",
            "Acme GitHub",
            "--repo",
            "acme/api-specs",
        ],
    )
    assert result.exit_code == EXIT_USAGE
    assert "Session token required" in strip_ansi(result.stderr)


def test_repos_add_linked_account_human_output(
    httpx_mock: object,
    repos_add_env: None,
) -> None:
    httpx_mock.add_response(
        url="http://localhost:8000/dashboard/linked-accounts",
        json=_LINKED_ACCOUNTS_PAYLOAD,
        match_headers={"Authorization": "Bearer obj_sess_test_token"},
    )
    httpx_mock.add_response(
        url=(
            "http://localhost:8000/dashboard/linked-accounts/"
            f"{_LINKED_ACCOUNT_ID}/repositories"
        ),
        json=_ACCESSIBLE_REPOS_PAYLOAD,
        match_headers={"Authorization": "Bearer obj_sess_test_token"},
    )
    httpx_mock.add_response(
        url=f"http://localhost:8000/tenants/{_TENANT_ID}/repositories",
        method="POST",
        json=_REPO_ITEM,
        match_headers={"X-API-Key": "obj_test_workspace_key"},
        match_json=_LINKED_CREATE_BODY,
    )

    result = runner.invoke(
        app,
        [
            "repos",
            "add",
            "--account",
            "Acme GitHub",
            "--repo",
            "acme/api-specs",
        ],
    )
    assert result.exit_code == EXIT_SUCCESS
    output = strip_ansi(result.stdout)
    assert "Repository registered." in output
    assert "API" in output
    assert "Specs" in output
    assert "github" in output
    assert "ready" in output


def test_repos_add_linked_account_not_found(
    httpx_mock: object,
    repos_add_env: None,
) -> None:
    httpx_mock.add_response(
        url="http://localhost:8000/dashboard/linked-accounts",
        json=_LINKED_ACCOUNTS_PAYLOAD,
    )

    result = runner.invoke(
        app,
        [
            "repos",
            "add",
            "--account",
            "Missing Account",
            "--repo",
            "acme/api-specs",
        ],
    )
    assert result.exit_code == EXIT_USAGE
    assert "No linked Git account found" in strip_ansi(result.output)


def test_repos_add_rejects_invalid_format(repos_env: None) -> None:
    result = runner.invoke(
        app,
        [
            "repos",
            "add",
            "--url",
            "https://github.com/acme/public-specs.git",
            "--format",
            "yaml",
        ],
    )
    assert result.exit_code != EXIT_SUCCESS
    assert "format must be 'table' or 'json'" in strip_ansi(result.output)


def test_repos_add_linked_account_json_format(
    httpx_mock: object,
    repos_add_env: None,
) -> None:
    httpx_mock.add_response(
        url="http://localhost:8000/dashboard/linked-accounts",
        json=_LINKED_ACCOUNTS_PAYLOAD,
    )
    httpx_mock.add_response(
        url=(
            "http://localhost:8000/dashboard/linked-accounts/"
            f"{_LINKED_ACCOUNT_ID}/repositories"
        ),
        json=_ACCESSIBLE_REPOS_PAYLOAD,
    )
    httpx_mock.add_response(
        url=f"http://localhost:8000/tenants/{_TENANT_ID}/repositories",
        method="POST",
        json=_REPO_ITEM,
        match_json=_LINKED_CREATE_BODY,
    )

    result = runner.invoke(
        app,
        [
            "repos",
            "add",
            "--account",
            "Acme GitHub",
            "--repo",
            "acme/api-specs",
            "--format",
            "json",
        ],
    )
    assert result.exit_code == EXIT_SUCCESS
    payload = json.loads(result.stdout)
    assert payload["name"] == "API Specs"
    assert payload["provider"] == "github"


def test_repos_add_linked_account_repo_not_found(
    httpx_mock: object,
    repos_add_env: None,
) -> None:
    httpx_mock.add_response(
        url="http://localhost:8000/dashboard/linked-accounts",
        json=_LINKED_ACCOUNTS_PAYLOAD,
    )
    httpx_mock.add_response(
        url=(
            "http://localhost:8000/dashboard/linked-accounts/"
            f"{_LINKED_ACCOUNT_ID}/repositories"
        ),
        json=_ACCESSIBLE_REPOS_PAYLOAD,
    )

    result = runner.invoke(
        app,
        [
            "repos",
            "add",
            "--account",
            "Acme GitHub",
            "--repo",
            "acme/missing",
        ],
    )
    assert result.exit_code == EXIT_USAGE
    assert "No accessible repository found" in strip_ansi(result.output)


def test_repos_scan_requires_api_key() -> None:
    result = runner.invoke(app, ["repos", "scan", _REPO_ID])
    assert result.exit_code == EXIT_USAGE
    assert "API key required" in strip_ansi(result.stderr)


def test_repos_scan_requires_tenant_scope(api_key_only_env: None) -> None:
    result = runner.invoke(app, ["repos", "scan", _REPO_ID])
    assert result.exit_code == EXIT_USAGE
    assert "Tenant scope required" in strip_ansi(result.stderr)


def test_repos_scan_enqueue_human_output(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/scans",
        method="POST",
        json=_SCAN_ENQUEUE_RESULT,
        match_headers={"X-API-Key": "obj_test_workspace_key"},
    )

    result = runner.invoke(app, ["repos", "scan", _REPO_ID])
    assert result.exit_code == EXIT_SUCCESS
    output = strip_ansi(result.stdout)
    assert "Scan enqueued." in output
    assert _SCAN_ID in output
    assert "main" in output
    assert "queued" in output


def test_repos_scan_enqueue_json_format(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/scans",
        method="POST",
        json=_SCAN_ENQUEUE_RESULT,
    )

    result = runner.invoke(app, ["repos", "scan", _REPO_ID, "--format", "json"])
    assert result.exit_code == EXIT_SUCCESS
    payload = json.loads(result.stdout)
    assert payload["scan_id"] == _SCAN_ID
    assert payload["status"] == "queued"


def test_repos_scan_enqueue_with_branch_override(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/scans",
        method="POST",
        json={**_SCAN_ENQUEUE_RESULT, "branch": "release"},
        match_json={"branch": "release"},
    )

    result = runner.invoke(app, ["repos", "scan", _REPO_ID, "--branch", "release"])
    assert result.exit_code == EXIT_SUCCESS
    assert "Scan enqueued." in strip_ansi(result.stdout)


def test_repos_scan_wait_polls_until_done(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/scans",
        method="POST",
        json=_SCAN_ENQUEUE_RESULT,
    )
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/scans/{_SCAN_ID}"
        ),
        json={"status": "running", "scan_id": _SCAN_ID},
    )
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/scans/{_SCAN_ID}"
        ),
        json=_SCAN_DONE_RESULT,
    )

    result = runner.invoke(app, ["repos", "scan", _REPO_ID, "--wait"])
    assert result.exit_code == EXIT_SUCCESS
    output = strip_ansi(result.stdout)
    assert "Scan completed." in output
    assert "Files seen: 42" in output
    assert "Files added: 5" in output
    assert "Files changed: 2" in output
    assert "Files removed: 1" in output


def test_repos_scan_rejects_invalid_format(repos_env: None) -> None:
    result = runner.invoke(
        app,
        ["repos", "scan", _REPO_ID, "--format", "yaml"],
    )
    assert result.exit_code != EXIT_SUCCESS
    assert "format must be 'table' or 'json'" in strip_ansi(result.output)


def test_repos_scan_enqueue_idempotent_note(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/scans",
        method="POST",
        json={**_SCAN_ENQUEUE_RESULT, "created": False},
    )

    result = runner.invoke(app, ["repos", "scan", _REPO_ID])
    assert result.exit_code == EXIT_SUCCESS
    assert "idempotent enqueue" in strip_ansi(result.stdout)


def test_repos_scan_wait_exits_on_failure(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/scans",
        method="POST",
        json=_SCAN_ENQUEUE_RESULT,
    )
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/scans/{_SCAN_ID}"
        ),
        json={"status": "failed", "error_message": "provider walk failed"},
    )

    result = runner.invoke(
        app,
        ["repos", "scan", _REPO_ID, "--wait", "--poll-interval", "0.1"],
    )
    assert result.exit_code == EXIT_ERROR
    assert "provider walk failed" in strip_ansi(result.stderr + result.stdout)


def test_repos_scan_wait_json_format(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/scans",
        method="POST",
        json=_SCAN_ENQUEUE_RESULT,
    )
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/scans/{_SCAN_ID}"
        ),
        json=_SCAN_DONE_RESULT,
    )

    result = runner.invoke(
        app,
        ["repos", "scan", _REPO_ID, "--wait", "--format", "json"],
    )
    assert result.exit_code == EXIT_SUCCESS
    payload = json.loads(result.stdout)
    assert payload["status"] == "done"
    assert payload["files_seen"] == 42


def test_repos_files_requires_api_key() -> None:
    result = runner.invoke(app, ["repos", "files", _REPO_ID])
    assert result.exit_code == EXIT_USAGE
    assert "API key required" in strip_ansi(result.stderr)


def test_repos_files_requires_tenant_scope(api_key_only_env: None) -> None:
    result = runner.invoke(app, ["repos", "files", _REPO_ID])
    assert result.exit_code == EXIT_USAGE
    assert "Tenant scope required" in strip_ansi(result.stderr)


def test_repos_files_human_output(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files"
            "?offset=0&limit=50"
        ),
        json={"items": [_FILE_ITEM, _FILE_ITEM_2], "total": 2, "offset": 0, "limit": 50},
        match_headers={"X-API-Key": "obj_test_workspace_key"},
    )
    result = runner.invoke(app, ["repos", "files", _REPO_ID])
    assert result.exit_code == EXIT_SUCCESS
    output = strip_ansi(result.stdout)
    assert "openapi.yaml" in output
    assert "openapi-candidate" in output
    assert "yes" in output
    assert "docs/readme.md" in output
    assert "pending" in output
    assert "Showing 2 of 2" in output


def test_repos_files_json_format(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files"
            "?offset=0&limit=50"
        ),
        json={"items": [_FILE_ITEM], "total": 1, "offset": 0, "limit": 50},
    )
    result = runner.invoke(app, ["repos", "files", _REPO_ID, "--format", "json"])
    assert result.exit_code == EXIT_SUCCESS
    payload = json.loads(result.stdout)
    assert payload["total"] == 1
    assert payload["items"][0]["path"] == "openapi.yaml"
    assert payload["items"][0]["detected_kind"] == "openapi-candidate"
    assert payload["items"][0]["importable"] is True


def test_repos_files_filtered_by_glob_preset_and_importable(
    httpx_mock: object,
    repos_env: None,
) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files"
            "?glob=%2A%2A%2Fopenapi%2A.yaml&preset=openapi&importable=true&offset=0&limit=50"
        ),
        json={"items": [_FILE_ITEM], "total": 1, "offset": 0, "limit": 50},
    )
    result = runner.invoke(
        app,
        [
            "repos",
            "files",
            _REPO_ID,
            "--glob",
            "**/openapi*.yaml",
            "--preset",
            "openapi",
            "--importable",
        ],
    )
    assert result.exit_code == EXIT_SUCCESS
    output = strip_ansi(result.stdout)
    assert "openapi.yaml" in output
    assert "readme.md" not in output


def test_repos_files_filtered_by_regex(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files"
            "?regex=openapi&offset=0&limit=50"
        ),
        json={"items": [_FILE_ITEM], "total": 1, "offset": 0, "limit": 50},
    )
    result = runner.invoke(
        app,
        ["repos", "files", _REPO_ID, "--regex", "openapi"],
    )
    assert result.exit_code == EXIT_SUCCESS
    assert "openapi.yaml" in strip_ansi(result.stdout)


def test_repos_files_rejects_glob_and_regex_together(repos_env: None) -> None:
    result = runner.invoke(
        app,
        [
            "repos",
            "files",
            _REPO_ID,
            "--glob",
            "**/*.yaml",
            "--regex",
            "openapi",
        ],
    )
    assert result.exit_code != EXIT_SUCCESS
    assert "mutually exclusive" in strip_ansi(result.output)


def test_repos_files_rejects_invalid_preset(repos_env: None) -> None:
    result = runner.invoke(
        app,
        ["repos", "files", _REPO_ID, "--preset", "custom"],
    )
    assert result.exit_code != EXIT_SUCCESS
    assert "preset must be one of" in strip_ansi(result.output)


def test_repos_files_empty_human_output(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files"
            "?offset=0&limit=50"
        ),
        json={"items": [], "total": 0, "offset": 0, "limit": 50},
    )
    result = runner.invoke(app, ["repos", "files", _REPO_ID])
    assert result.exit_code == EXIT_SUCCESS
    output = strip_ansi(result.stdout)
    assert "No items." in output
    assert "Total: 0" in output


def test_repos_files_filtered_by_detected_kind(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files"
            "?detected_kind=openapi-candidate&offset=0&limit=50"
        ),
        json={"items": [_FILE_ITEM], "total": 1, "offset": 0, "limit": 50},
    )
    result = runner.invoke(
        app,
        ["repos", "files", _REPO_ID, "--detected-kind", "openapi-candidate"],
    )
    assert result.exit_code == EXIT_SUCCESS
    assert "openapi.yaml" in strip_ansi(result.stdout)


def test_repos_files_filtered_by_not_importable(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files"
            "?importable=false&offset=0&limit=50"
        ),
        json={
            "items": [
                {
                    **_FILE_ITEM_2,
                    "importable": False,
                    "import_blocked_reason": "Unsupported format",
                },
            ],
            "total": 1,
            "offset": 0,
            "limit": 50,
        },
    )
    result = runner.invoke(app, ["repos", "files", _REPO_ID, "--not-importable"])
    assert result.exit_code == EXIT_SUCCESS
    output = strip_ansi(result.stdout)
    assert "readme.md" in output
    assert "no (Unsupported format)" in output


def test_repos_files_global_json_flag(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files"
            "?offset=0&limit=50"
        ),
        json={"items": [_FILE_ITEM], "total": 1, "offset": 0, "limit": 50},
    )
    result = runner.invoke(app, ["--json", "repos", "files", _REPO_ID])
    assert result.exit_code == EXIT_SUCCESS
    payload = json.loads(result.stdout)
    assert payload["items"][0]["path"] == "openapi.yaml"


def test_repos_files_rejects_invalid_format(repos_env: None) -> None:
    result = runner.invoke(
        app,
        ["repos", "files", _REPO_ID, "--format", "yaml"],
    )
    assert result.exit_code != EXIT_SUCCESS
    assert "format must be 'table' or 'json'" in strip_ansi(result.output)


_SNIFF_IMPORTABLE_RESULT = {
    "file_id": _FILE_ID,
    "detected_kind": "openapi",
    "detected_confidence": "content_sniffed",
    "detected_version": "3.1.0",
    "importable": True,
    "import_blocked_reason": None,
    "reasons": ["Top-level openapi key is 3.1.0."],
}

_SNIFF_NOT_IMPORTABLE_RESULT = {
    "file_id": _FILE_ID,
    "detected_kind": None,
    "detected_confidence": "content_sniffed",
    "detected_version": None,
    "importable": False,
    "import_blocked_reason": "No supported import kind found.",
    "reasons": ["No supported import kind found."],
}

_DEEP_VERDICT_CLEAN = {
    "file_id": _FILE_ID,
    "deep_verdict_at": "2026-06-11T12:00:00Z",
    "validation_status": "valid",
    "validation_errors": [],
    "lint_findings": [],
    "fidelity": "exact",
    "fidelity_nodes": [],
    "secrets_findings": [],
    "detected_kind": "openapi",
    "bundle_members": [
        {
            "file_id": _FILE_ID,
            "path": "openapi.yaml",
            "blob_sha": "abc1234567890",
            "size_bytes": 128,
        },
    ],
    "blocking": False,
    "blocking_reasons": [],
    "_links": {
        "self": {"href": f"/files/{_FILE_ID}"},
        "verify": {"href": f"/files/{_FILE_ID}/verify"},
    },
}

_DEEP_VERDICT_BLOCKING = {
    **_DEEP_VERDICT_CLEAN,
    "validation_status": "invalid",
    "blocking": True,
    "blocking_reasons": ["Structural validation failed."],
    "validation_errors": [
        {
            "code": "invalid_document",
            "message": "Document failed structural validation.",
            "path": "/paths",
            "severity": "error",
        },
    ],
    "fidelity": "lossy",
    "fidelity_nodes": ["/components/schemas/Pet"],
    "lint_findings": [
        {
            "code": "duplicate_operation_id",
            "message": "Duplicate operationId.",
            "path": "/paths/~1items/get/operationId",
            "severity": "error",
        },
    ],
    "secrets_findings": [
        {
            "code": "secret_detected",
            "message": "Potential secret detected.",
            "path": "/servers/0/url",
            "severity": "error",
        },
    ],
}


def test_repos_inspect_requires_api_key() -> None:
    result = runner.invoke(app, ["repos", "inspect", _REPO_ID, _FILE_ID])
    assert result.exit_code == EXIT_USAGE
    assert "API key required" in strip_ansi(result.stderr)


def test_repos_inspect_requires_tenant_scope(api_key_only_env: None) -> None:
    result = runner.invoke(app, ["repos", "inspect", _REPO_ID, _FILE_ID])
    assert result.exit_code == EXIT_USAGE
    assert "Tenant scope required" in strip_ansi(result.stderr)


def test_repos_inspect_human_output(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files/{_FILE_ID}/sniff"
        ),
        method="POST",
        json=_SNIFF_IMPORTABLE_RESULT,
        match_headers={"X-API-Key": "obj_test_workspace_key"},
    )
    result = runner.invoke(app, ["repos", "inspect", _REPO_ID, _FILE_ID])
    assert result.exit_code == EXIT_SUCCESS
    output = strip_ansi(result.stdout)
    assert "Content sniff completed." in output
    assert "Kind: openapi" in output
    assert "Version: 3.1.0" in output
    assert "Importable: yes" in output
    assert "Top-level openapi key is 3.1.0." in output


def test_repos_inspect_not_importable_human_output(
    httpx_mock: object,
    repos_env: None,
) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files/{_FILE_ID}/sniff"
        ),
        method="POST",
        json=_SNIFF_NOT_IMPORTABLE_RESULT,
    )
    result = runner.invoke(app, ["repos", "inspect", _REPO_ID, _FILE_ID])
    assert result.exit_code == EXIT_SUCCESS
    output = strip_ansi(result.stdout)
    assert "Importable: no (No supported import kind found.)" in output
    assert "No supported import kind found." in output


def test_repos_inspect_json_format(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files/{_FILE_ID}/sniff"
        ),
        method="POST",
        json=_SNIFF_IMPORTABLE_RESULT,
    )
    result = runner.invoke(
        app,
        ["repos", "inspect", _REPO_ID, _FILE_ID, "--format", "json"],
    )
    assert result.exit_code == EXIT_SUCCESS
    payload = json.loads(result.stdout)
    assert payload["detected_kind"] == "openapi"
    assert payload["importable"] is True
    assert payload["reasons"] == ["Top-level openapi key is 3.1.0."]


def test_repos_inspect_global_json_flag(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files/{_FILE_ID}/sniff"
        ),
        method="POST",
        json=_SNIFF_IMPORTABLE_RESULT,
    )
    result = runner.invoke(app, ["--json", "repos", "inspect", _REPO_ID, _FILE_ID])
    assert result.exit_code == EXIT_SUCCESS
    payload = json.loads(result.stdout)
    assert payload["detected_confidence"] == "content_sniffed"


def test_repos_inspect_rejects_invalid_format(repos_env: None) -> None:
    result = runner.invoke(
        app,
        ["repos", "inspect", _REPO_ID, _FILE_ID, "--format", "yaml"],
    )
    assert result.exit_code != EXIT_SUCCESS
    assert "format must be 'table' or 'json'" in strip_ansi(result.output)


def test_repos_inspect_deep_human_output(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files/{_FILE_ID}/verify"
        ),
        method="POST",
        json=_DEEP_VERDICT_CLEAN,
        match_headers={"X-API-Key": "obj_test_workspace_key"},
    )
    result = runner.invoke(app, ["repos", "inspect", _REPO_ID, _FILE_ID, "--deep"])
    assert result.exit_code == EXIT_SUCCESS
    output = strip_ansi(result.stdout)
    assert "Deep pre-import verdict completed." in output
    assert "Validation: valid" in output
    assert "Fidelity: exact" in output
    assert "Blocking: no" in output
    assert "openapi.yaml (abc1234)" in output


def test_repos_inspect_deep_exits_non_zero_on_blocking(
    httpx_mock: object,
    repos_env: None,
) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files/{_FILE_ID}/verify"
        ),
        method="POST",
        json=_DEEP_VERDICT_BLOCKING,
    )
    result = runner.invoke(app, ["repos", "inspect", _REPO_ID, _FILE_ID, "--deep"])
    assert result.exit_code == EXIT_ERROR
    output = strip_ansi(result.stdout)
    assert "Blocking: yes" in output
    assert "Structural validation failed." in output
    assert "duplicate_operation_id" in output
    assert "secret_detected" in output
    assert "/components/schemas/Pet" in output


def test_repos_inspect_deep_json_format(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files/{_FILE_ID}/verify"
        ),
        method="POST",
        json=_DEEP_VERDICT_CLEAN,
    )
    result = runner.invoke(
        app,
        ["repos", "inspect", _REPO_ID, _FILE_ID, "--deep", "--format", "json"],
    )
    assert result.exit_code == EXIT_SUCCESS
    payload = json.loads(result.stdout)
    assert payload["validation_status"] == "valid"
    assert payload["blocking"] is False
    assert payload["fidelity"] == "exact"


def test_repos_inspect_deep_json_exits_non_zero_on_blocking(
    httpx_mock: object,
    repos_env: None,
) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files/{_FILE_ID}/verify"
        ),
        method="POST",
        json=_DEEP_VERDICT_BLOCKING,
    )
    result = runner.invoke(
        app,
        ["repos", "inspect", _REPO_ID, _FILE_ID, "--deep", "--format", "json"],
    )
    assert result.exit_code == EXIT_ERROR
    payload = json.loads(result.stdout)
    assert payload["blocking"] is True
    assert payload["validation_errors"][0]["code"] == "invalid_document"


def test_repos_inspect_deep_skips_sniff_endpoint(
    httpx_mock: object,
    repos_env: None,
) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files/{_FILE_ID}/verify"
        ),
        method="POST",
        json=_DEEP_VERDICT_CLEAN,
    )
    result = runner.invoke(app, ["repos", "inspect", _REPO_ID, _FILE_ID, "--deep"])
    assert result.exit_code == EXIT_SUCCESS
    assert len(httpx_mock.get_requests()) == 1
    assert httpx_mock.get_requests()[0].url.path.endswith("/verify")


def test_repos_verify_requires_api_key() -> None:
    result = runner.invoke(app, ["repos", "verify", _REPO_ID])
    assert result.exit_code == EXIT_USAGE
    assert "API key required" in strip_ansi(result.stderr)


def test_repos_verify_requires_tenant_scope(api_key_only_env: None) -> None:
    result = runner.invoke(app, ["repos", "verify", _REPO_ID])
    assert result.exit_code == EXIT_USAGE
    assert "Tenant scope required" in strip_ansi(result.stderr)


def test_repos_verify_single_file_human_output(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        method="GET",
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files/{_FILE_ID}"
        ),
        json=_FILE_ITEM,
    )
    result = runner.invoke(app, ["repos", "verify", _REPO_ID, _FILE_ID])
    assert result.exit_code == EXIT_SUCCESS
    output = strip_ansi(result.stdout)
    assert "Repository trust verification" in output
    assert "openapi.yaml" in output
    assert "verified" in output
    assert "valid" in output


def test_repos_verify_single_file_json_format(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        method="GET",
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files/{_FILE_ID}"
        ),
        json=_FILE_ITEM,
    )
    result = runner.invoke(app, ["repos", "verify", _REPO_ID, _FILE_ID, "--format", "json"])
    assert result.exit_code == EXIT_SUCCESS
    payload = json.loads(result.stdout)
    assert payload["passed"] is True
    assert payload["failure_count"] == 0
    assert payload["items"][0]["integrity_status"] == "verified"
    assert payload["items"][0]["signature_status"] == "valid"


def test_repos_verify_repository_exits_non_zero_on_failure(
    httpx_mock: object,
    repos_env: None,
) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files"
            "?offset=0&limit=50"
        ),
        json={
            "items": [_FILE_ITEM, _FAILED_FILE_ITEM],
            "total": 2,
            "offset": 0,
            "limit": 50,
        },
    )
    result = runner.invoke(app, ["repos", "verify", _REPO_ID])
    assert result.exit_code == EXIT_ERROR
    output = strip_ansi(result.stdout)
    assert "Failures: 1" in output
    assert "broken.yaml" in output


def test_repos_verify_repository_json_reports_failure(
    httpx_mock: object,
    repos_env: None,
) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files"
            "?offset=0&limit=50"
        ),
        json={
            "items": [_FAILED_FILE_ITEM],
            "total": 1,
            "offset": 0,
            "limit": 50,
        },
    )
    result = runner.invoke(
        app,
        ["repos", "verify", _REPO_ID, "--format", "json"],
    )
    assert result.exit_code == EXIT_ERROR
    payload = json.loads(result.stdout)
    assert payload["passed"] is False
    assert payload["failure_count"] == 1
    assert payload["items"][0]["failures"] == [
        "content_integrity_failed",
        "signature_invalid",
    ]


def test_repos_verify_rejects_invalid_format(repos_env: None) -> None:
    result = runner.invoke(
        app,
        ["repos", "verify", _REPO_ID, "--format", "yaml"],
    )
    assert result.exit_code != EXIT_SUCCESS
    assert "format must be 'table' or 'json'" in strip_ansi(result.output)


_MULTI_FILE_CONTENT = (
    "paths:\n"
    "  /users:\n"
    "    $ref: './paths/users.yaml'\n"
    "components:\n"
    "  schemas:\n"
    "    Error:\n"
    "      $ref: '../schemas/error-missing.yaml'\n"
)

_DEPENDENCY_FILE_ITEM = {
    **_FILE_ITEM,
    "path": "specs/openapi.yaml",
    "name": "openapi.yaml",
}

_RESOLVED_DEPENDENCY_FILE_ITEM = {
    **_FILE_ITEM,
    "id": "22222222-2222-4222-8222-222222222222",
    "path": "specs/paths/users.yaml",
    "name": "users.yaml",
    "blob_sha": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
}


def test_repos_inspect_closure_human_output(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files/{_FILE_ID}/sniff"
        ),
        method="POST",
        json=_SNIFF_IMPORTABLE_RESULT,
    )
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files/{_FILE_ID}"
        ),
        json=_DEPENDENCY_FILE_ITEM,
    )
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files/{_FILE_ID}/content"
        ),
        content=_MULTI_FILE_CONTENT.encode("utf-8"),
    )
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files"
            "?offset=0&limit=10000"
        ),
        json={
            "items": [_DEPENDENCY_FILE_ITEM, _RESOLVED_DEPENDENCY_FILE_ITEM],
            "total": 2,
            "offset": 0,
            "limit": 10000,
        },
    )
    result = runner.invoke(
        app,
        ["repos", "inspect", _REPO_ID, _FILE_ID, "--closure"],
    )
    assert result.exit_code == EXIT_SUCCESS
    output = strip_ansi(result.stdout)
    assert "Content sniff completed." in output
    assert "$ref closure" in output
    assert "[resolved] specs/paths/users.yaml" in output
    assert "[missing] schemas/error-missing.yaml" in output


def test_repos_inspect_closure_json_format(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files/{_FILE_ID}/sniff"
        ),
        method="POST",
        json=_SNIFF_IMPORTABLE_RESULT,
    )
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files/{_FILE_ID}"
        ),
        json=_DEPENDENCY_FILE_ITEM,
    )
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files/{_FILE_ID}/content"
        ),
        content=_MULTI_FILE_CONTENT.encode("utf-8"),
    )
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files"
            "?offset=0&limit=10000"
        ),
        json={
            "items": [_DEPENDENCY_FILE_ITEM, _RESOLVED_DEPENDENCY_FILE_ITEM],
            "total": 2,
            "offset": 0,
            "limit": 10000,
        },
    )
    result = runner.invoke(
        app,
        ["repos", "inspect", _REPO_ID, _FILE_ID, "--closure", "--format", "json"],
    )
    assert result.exit_code == EXIT_SUCCESS
    payload = json.loads(result.stdout)
    assert payload["detected_kind"] == "openapi"
    assert payload["closure"]["total"] == 2
    assert payload["closure"]["resolved_count"] == 1
    assert payload["closure"]["missing_count"] == 1


def test_repos_files_closure_human_output(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files"
            "?offset=0&limit=50"
        ),
        json={
            "items": [_DEPENDENCY_FILE_ITEM],
            "total": 1,
            "offset": 0,
            "limit": 50,
        },
    )
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files"
            "?offset=0&limit=10000"
        ),
        json={
            "items": [_DEPENDENCY_FILE_ITEM, _RESOLVED_DEPENDENCY_FILE_ITEM],
            "total": 2,
            "offset": 0,
            "limit": 10000,
        },
    )
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files/{_FILE_ID}/content"
        ),
        content=_MULTI_FILE_CONTENT.encode("utf-8"),
    )
    result = runner.invoke(app, ["repos", "files", _REPO_ID, "--closure"])
    assert result.exit_code == EXIT_SUCCESS
    output = strip_ansi(result.stdout)
    assert "Closure" in output
    assert "1 resolved" in output
    assert "missing" in output
    assert "specs/openapi.y" in output


def test_repos_files_closure_json_format(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files"
            "?offset=0&limit=50"
        ),
        json={
            "items": [_DEPENDENCY_FILE_ITEM],
            "total": 1,
            "offset": 0,
            "limit": 50,
        },
    )
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files"
            "?offset=0&limit=10000"
        ),
        json={
            "items": [_DEPENDENCY_FILE_ITEM, _RESOLVED_DEPENDENCY_FILE_ITEM],
            "total": 2,
            "offset": 0,
            "limit": 10000,
        },
    )
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files/{_FILE_ID}/content"
        ),
        content=_MULTI_FILE_CONTENT.encode("utf-8"),
    )
    result = runner.invoke(
        app,
        ["repos", "files", _REPO_ID, "--closure", "--format", "json"],
    )
    assert result.exit_code == EXIT_SUCCESS
    payload = json.loads(result.stdout)
    assert payload["total"] == 1
    assert payload["items"][0]["closure"]["missing_count"] == 1
    assert payload["items"][0]["closure_indicator"] == "1 resolved, 1 missing"


_PROJECT_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
_VERSION_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff"

_IMPORT_RESULT = {
    "project_id": _PROJECT_ID,
    "version_id": _VERSION_ID,
    "project": {
        "id": _PROJECT_ID,
        "tenant_id": _TENANT_ID,
        "name": "Pet Store",
        "slug": "pet-store",
        "source": "import",
        "enabled": True,
    },
    "version": {
        "id": _VERSION_ID,
        "project_id": _PROJECT_ID,
        "version": "1.0.0",
        "slug": "1.0.0",
        "source": "import",
        "enabled": True,
    },
    "created": {
        "schemas": 1,
        "properties": 2,
        "project_properties": 0,
        "version_schemas": 1,
    },
    "warnings": [],
    "errors": [],
}

_BATCH_RUN_ID = "99999999-9999-4999-8999-999999999999"
_FILE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

_BATCH_FILE_ITEM = {
    **_FILE_ITEM,
    "id": _FILE_B,
    "path": "openapi/users.yaml",
    "name": "users.yaml",
}

_BATCH_IMPORT_RESULT = {
    "run_id": _BATCH_RUN_ID,
    "status": "completed",
    "dry_run": False,
    "resumed": False,
    "counts": {"total": 2, "succeeded": 2, "failed": 0, "skipped": 0},
    "items": [
        {
            "file_id": _FILE_ID,
            "status": "succeeded",
            "import_id": "88888888-8888-4888-8888-888888888888",
            "result": _IMPORT_RESULT,
            "failure": None,
        },
        {
            "file_id": _FILE_B,
            "status": "succeeded",
            "import_id": "77777777-7777-4777-8777-777777777777",
            "result": _IMPORT_RESULT,
            "failure": None,
        },
    ],
    "_links": {
        "self": {
            "href": (
                f"/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/imports/batch/{_BATCH_RUN_ID}"
            ),
        },
    },
}


def _mock_repository_file_detail(httpx_mock: object) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/"
            f"{_REPO_ID}/files/{_FILE_ID}"
        ),
        method="GET",
        json=_FILE_ITEM,
    )


def test_repos_import_requires_api_key() -> None:
    result = runner.invoke(app, ["repos", "import", _REPO_ID, _FILE_ID, "--new-project"])
    assert result.exit_code == EXIT_USAGE
    assert "API key required" in strip_ansi(result.stderr)


def test_repos_import_requires_tenant_scope(api_key_only_env: None) -> None:
    result = runner.invoke(
        app,
        ["repos", "import", _REPO_ID, _FILE_ID, "--new-project"],
    )
    assert result.exit_code == EXIT_USAGE
    assert "Tenant scope required" in strip_ansi(result.stderr)


def test_repos_import_requires_target_mode(repos_env: None) -> None:
    result = runner.invoke(app, ["repos", "import", _REPO_ID, _FILE_ID])
    assert result.exit_code == EXIT_USAGE
    assert "--new-project or --project" in strip_ansi(result.output)


def test_repos_import_new_project_human_output(httpx_mock: object, repos_env: None) -> None:
    _mock_repository_file_detail(httpx_mock)
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files/{_FILE_ID}/import"
        ),
        method="POST",
        json=_IMPORT_RESULT,
        match_headers={"X-API-Key": "obj_test_workspace_key"},
        match_json={"mapping": "new_project", "dry_run": False},
    )
    result = runner.invoke(
        app,
        ["repos", "import", _REPO_ID, _FILE_ID, "--new-project"],
    )
    assert result.exit_code == EXIT_SUCCESS
    output = strip_ansi(result.stdout)
    assert "Import completed." in output
    assert "Pet Store" in output
    assert "1.0.0" in output
    assert _PROJECT_ID in output
    assert _VERSION_ID in output
    assert "Importing repository file openapi.yaml" in strip_ansi(result.stderr)


def test_repos_import_new_project_with_version_name(
    httpx_mock: object,
    repos_env: None,
) -> None:
    _mock_repository_file_detail(httpx_mock)
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files/{_FILE_ID}/import"
        ),
        method="POST",
        json=_IMPORT_RESULT,
        match_json={
            "mapping": "new_project",
            "dry_run": False,
            "version_name": "3.0.0-beta",
        },
    )
    result = runner.invoke(
        app,
        [
            "repos",
            "import",
            _REPO_ID,
            _FILE_ID,
            "--new-project",
            "--version-name",
            "3.0.0-beta",
        ],
    )
    assert result.exit_code == EXIT_SUCCESS
    assert "Import completed." in strip_ansi(result.stdout)


def test_repos_import_existing_project_new_version(
    httpx_mock: object,
    repos_env: None,
) -> None:
    _mock_repository_file_detail(httpx_mock)
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files/{_FILE_ID}/import"
        ),
        method="POST",
        json=_IMPORT_RESULT,
        match_json={
            "mapping": "existing_project_new_version",
            "dry_run": False,
            "project_id": _PROJECT_ID,
            "version_name": "2.0.0",
        },
    )
    result = runner.invoke(
        app,
        [
            "repos",
            "import",
            _REPO_ID,
            _FILE_ID,
            "--project",
            _PROJECT_ID,
            "--version-name",
            "2.0.0",
        ],
    )
    assert result.exit_code == EXIT_SUCCESS
    assert "Import completed." in strip_ansi(result.stdout)


def test_repos_import_existing_version(httpx_mock: object, repos_env: None) -> None:
    _mock_repository_file_detail(httpx_mock)
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files/{_FILE_ID}/import"
        ),
        method="POST",
        json=_IMPORT_RESULT,
        match_json={
            "mapping": "existing_version",
            "dry_run": False,
            "project_id": _PROJECT_ID,
            "version_id": _VERSION_ID,
        },
    )
    result = runner.invoke(
        app,
        [
            "repos",
            "import",
            _REPO_ID,
            _FILE_ID,
            "--project",
            _PROJECT_ID,
            "--version-id",
            _VERSION_ID,
        ],
    )
    assert result.exit_code == EXIT_SUCCESS
    assert "Import completed." in strip_ansi(result.stdout)


def test_repos_import_dry_run_human_output(httpx_mock: object, repos_env: None) -> None:
    _mock_repository_file_detail(httpx_mock)
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files/{_FILE_ID}/import"
        ),
        method="POST",
        json=_IMPORT_RESULT,
        match_json={"mapping": "new_project", "dry_run": True},
    )
    result = runner.invoke(
        app,
        ["repos", "import", _REPO_ID, _FILE_ID, "--new-project", "--dry-run"],
    )
    assert result.exit_code == EXIT_SUCCESS
    assert "Dry run completed" in strip_ansi(result.stdout)
    assert "Planning repository file import of openapi.yaml" in strip_ansi(result.stderr)


def test_repos_import_json_format(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files/{_FILE_ID}/import"
        ),
        method="POST",
        json=_IMPORT_RESULT,
    )
    result = runner.invoke(
        app,
        ["repos", "import", _REPO_ID, _FILE_ID, "--new-project", "--format", "json"],
    )
    assert result.exit_code == EXIT_SUCCESS
    payload = json.loads(result.stdout)
    assert payload["project_id"] == _PROJECT_ID
    assert payload["version_id"] == _VERSION_ID


def test_repos_import_errors_exit_nonzero(httpx_mock: object, repos_env: None) -> None:
    _mock_repository_file_detail(httpx_mock)
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files/{_FILE_ID}/import"
        ),
        method="POST",
        json={**_IMPORT_RESULT, "errors": [{"message": "import failed"}]},
    )
    result = runner.invoke(
        app,
        ["repos", "import", _REPO_ID, _FILE_ID, "--new-project"],
    )
    assert result.exit_code != EXIT_SUCCESS
    assert "Import completed." in strip_ansi(result.stdout)


def test_repos_import_rejects_invalid_format(repos_env: None) -> None:
    result = runner.invoke(
        app,
        [
            "repos",
            "import",
            _REPO_ID,
            _FILE_ID,
            "--new-project",
            "--format",
            "yaml",
        ],
    )
    assert result.exit_code != EXIT_SUCCESS
    assert "format must be 'table' or 'json'" in strip_ansi(result.output)


def test_repos_import_global_json_flag(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files/{_FILE_ID}/import"
        ),
        method="POST",
        json=_IMPORT_RESULT,
    )
    result = runner.invoke(
        app,
        ["--json", "repos", "import", _REPO_ID, _FILE_ID, "--new-project"],
    )
    assert result.exit_code == EXIT_SUCCESS
    payload = json.loads(result.stdout)
    assert payload["project_id"] == _PROJECT_ID


def test_repos_import_rejects_mixed_project_and_new_project(repos_env: None) -> None:
    result = runner.invoke(
        app,
        [
            "repos",
            "import",
            _REPO_ID,
            _FILE_ID,
            "--new-project",
            "--project",
            _PROJECT_ID,
            "--version-name",
            "1.0.0",
        ],
    )
    assert result.exit_code == EXIT_USAGE
    assert "not both" in strip_ansi(result.output)


def test_repos_help_lists_import_subcommand() -> None:
    group_result = runner.invoke(app, ["repos", "--help"])
    assert group_result.exit_code == EXIT_SUCCESS
    assert "import" in strip_ansi(group_result.stdout)

    import_result = runner.invoke(app, ["repos", "import", "--help"])
    assert import_result.exit_code == EXIT_SUCCESS
    import_help = strip_ansi(import_result.stdout)
    assert "--new-project" in import_help
    assert "--project" in import_help
    assert "--version-id" in import_help
    assert "--version-name" in import_help
    assert "--dry-run" in import_help
    assert "--files" in import_help
    assert "--regex" in import_help
    assert "--map" in import_help
    assert "--resume-run-id" in import_help
    assert "--manifest" in import_help
    assert "--manifest-file" in import_help


_MANIFEST_BLOB_SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
_MANIFEST_COMMIT_SHA = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
_MANIFEST_FILE_ID = "dddddddd-dddd-4ddd-addd-dddddddddddd"

_MANIFEST_IMPORT_RESULT = {
    **_BATCH_IMPORT_RESULT,
    "manifest": {
        "path": ".objectified.yaml",
        "file_id": _MANIFEST_FILE_ID,
        "blob_sha": _MANIFEST_BLOB_SHA,
        "commit_sha": _MANIFEST_COMMIT_SHA,
    },
}


def test_repos_import_manifest_repo(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/imports:manifest"
        ),
        method="POST",
        json=_MANIFEST_IMPORT_RESULT,
        match_json={"dry_run": False},
    )
    result = runner.invoke(
        app,
        ["repos", "import", _REPO_ID, "--manifest"],
    )
    assert result.exit_code == EXIT_SUCCESS
    output = strip_ansi(result.stdout)
    assert "Manifest import completed." in output
    assert "Status: completed" in output
    assert ".objectified.yaml" in output
    assert _MANIFEST_BLOB_SHA in output
    assert _MANIFEST_COMMIT_SHA in output


def test_repos_import_manifest_repo_json_format(
    httpx_mock: object,
    repos_env: None,
) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/imports:manifest"
        ),
        method="POST",
        json=_MANIFEST_IMPORT_RESULT,
    )
    result = runner.invoke(
        app,
        ["repos", "import", _REPO_ID, "--manifest", "--format", "json"],
    )
    assert result.exit_code == EXIT_SUCCESS
    payload = json.loads(result.stdout)
    assert payload["manifest"]["path"] == ".objectified.yaml"
    assert payload["counts"]["succeeded"] == 2


def test_repos_import_manifest_repo_resume(
    httpx_mock: object,
    repos_env: None,
) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/imports:manifest"
        ),
        method="POST",
        json={**_MANIFEST_IMPORT_RESULT, "resumed": True},
        match_json={"dry_run": False, "resume_run_id": _BATCH_RUN_ID},
    )
    result = runner.invoke(
        app,
        [
            "repos",
            "import",
            _REPO_ID,
            "--manifest",
            "--resume-run-id",
            _BATCH_RUN_ID,
        ],
    )
    assert result.exit_code == EXIT_SUCCESS
    assert "Manifest import completed." in strip_ansi(result.stdout)


def test_repos_import_manifest_local_file(
    httpx_mock: object,
    repos_env: None,
    tmp_path: object,
) -> None:
    manifest_path = tmp_path / ".objectified.yaml"
    manifest_path.write_text(
        """
version: 1
imports:
  - path: openapi.yaml
    project: pet-store
    version: "1.0.0"
  - path: openapi/users.yaml
    newProject:
      title: Users API
    version: "2.0.0"
""",
        encoding="utf-8",
    )
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files"
            "?offset=0&limit=50"
        ),
        json={
            "items": [_FILE_ITEM, _BATCH_FILE_ITEM],
            "total": 2,
            "offset": 0,
            "limit": 50,
        },
    )
    httpx_mock.add_response(
        url="http://localhost:8000/v1/projects/acme-corp",
        json={
            "items": [{"id": _PROJECT_ID, "slug": "pet-store", "name": "Pet Store"}],
            "total": 1,
            "offset": 0,
            "limit": 50,
        },
    )
    httpx_mock.add_response(
        url="http://localhost:8000/project-versions?offset=0&limit=50",
        json={
            "items": [
                {
                    "id": _VERSION_ID,
                    "project_id": _PROJECT_ID,
                    "slug": "1.0.0",
                    "version": "1.0.0",
                },
            ],
            "total": 1,
            "offset": 0,
            "limit": 50,
        },
    )
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/imports:batch"
        ),
        method="POST",
        json=_BATCH_IMPORT_RESULT,
        match_json={
            "dry_run": False,
            "items": [
                {
                    "file_id": _FILE_ID,
                    "mapping": "existing_version",
                    "project_id": _PROJECT_ID,
                    "version_id": _VERSION_ID,
                },
                {
                    "file_id": _FILE_B,
                    "mapping": "new_project",
                    "version_name": "2.0.0",
                },
            ],
        },
    )
    result = runner.invoke(
        app,
        [
            "repos",
            "import",
            _REPO_ID,
            "--manifest-file",
            str(manifest_path),
        ],
    )
    assert result.exit_code == EXIT_SUCCESS
    assert "Manifest import completed." in strip_ansi(result.stdout)


def test_repos_import_manifest_rejects_mapping_flags(repos_env: None) -> None:
    result = runner.invoke(
        app,
        ["repos", "import", _REPO_ID, "--manifest", "--new-project"],
    )
    assert result.exit_code == EXIT_USAGE
    assert "does not accept" in strip_ansi(result.output)


def test_repos_import_batch_requires_files_or_regex(repos_env: None) -> None:
    result = runner.invoke(
        app,
        ["repos", "import", _REPO_ID, "--new-project"],
    )
    assert result.exit_code == EXIT_USAGE
    assert "pass --files/--regex for batch import" in strip_ansi(result.output)


def test_repos_import_batch_rejects_file_id_with_files(repos_env: None) -> None:
    result = runner.invoke(
        app,
        [
            "repos",
            "import",
            _REPO_ID,
            _FILE_ID,
            "--files",
            "**/*.yaml",
            "--new-project",
        ],
    )
    assert result.exit_code == EXIT_USAGE
    assert "not both" in strip_ansi(result.output)


def test_repos_import_batch_with_files_and_global_mapping(
    httpx_mock: object,
    repos_env: None,
) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files"
            "?glob=%2A%2A%2Fopenapi%2A.yaml&offset=0&limit=50"
        ),
        json={
            "items": [_FILE_ITEM, _BATCH_FILE_ITEM],
            "total": 2,
            "offset": 0,
            "limit": 50,
        },
    )
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/imports:batch"
        ),
        method="POST",
        json=_BATCH_IMPORT_RESULT,
        match_json={
            "dry_run": False,
            "items": [
                {"file_id": _FILE_ID, "mapping": "new_project"},
                {"file_id": _FILE_B, "mapping": "new_project"},
            ],
        },
    )
    result = runner.invoke(
        app,
        [
            "repos",
            "import",
            _REPO_ID,
            "--files",
            "**/openapi*.yaml",
            "--new-project",
        ],
    )
    assert result.exit_code == EXIT_SUCCESS
    output = strip_ansi(result.stdout)
    assert "Batch import completed." in output
    assert "Status: completed" in output
    assert "Succeeded: 2" in output
    assert "openapi.yaml" in output
    assert "openapi/users.yaml" in output


def test_repos_import_batch_with_map_file(
    httpx_mock: object,
    repos_env: None,
    tmp_path: object,
) -> None:
    map_path = tmp_path / "map.yaml"
    map_path.write_text(
        f"""
items:
  - path: openapi.yaml
    mapping: new_project
  - path: openapi/users.yaml
    mapping: existing_version
    project_id: {_PROJECT_ID}
    version_id: {_VERSION_ID}
""",
        encoding="utf-8",
    )
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files"
            "?glob=%2A%2A%2F%2A.yaml&offset=0&limit=50"
        ),
        json={
            "items": [_FILE_ITEM, _BATCH_FILE_ITEM],
            "total": 2,
            "offset": 0,
            "limit": 50,
        },
    )
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/imports:batch"
        ),
        method="POST",
        json=_BATCH_IMPORT_RESULT,
        match_json={
            "dry_run": False,
            "items": [
                {"file_id": _FILE_ID, "mapping": "new_project"},
                {
                    "file_id": _FILE_B,
                    "mapping": "existing_version",
                    "project_id": _PROJECT_ID,
                    "version_id": _VERSION_ID,
                },
            ],
        },
    )
    result = runner.invoke(
        app,
        [
            "repos",
            "import",
            _REPO_ID,
            "--files",
            "**/*.yaml",
            "--map",
            str(map_path),
        ],
    )
    assert result.exit_code == EXIT_SUCCESS
    assert "Batch import completed." in strip_ansi(result.stdout)


def test_repos_import_batch_json_format(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files"
            "?regex=openapi&offset=0&limit=50"
        ),
        json={"items": [_FILE_ITEM], "total": 1, "offset": 0, "limit": 50},
    )
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/imports:batch"
        ),
        method="POST",
        json={
            **_BATCH_IMPORT_RESULT,
            "counts": {"total": 1, "succeeded": 1, "failed": 0, "skipped": 0},
            "items": [_BATCH_IMPORT_RESULT["items"][0]],
        },
    )
    result = runner.invoke(
        app,
        [
            "repos",
            "import",
            _REPO_ID,
            "--regex",
            "openapi",
            "--new-project",
            "--format",
            "json",
        ],
    )
    assert result.exit_code == EXIT_SUCCESS
    payload = json.loads(result.stdout)
    assert payload["run_id"] == _BATCH_RUN_ID
    assert payload["counts"]["succeeded"] == 1


def test_repos_import_batch_exits_nonzero_on_failure(
    httpx_mock: object,
    repos_env: None,
) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/files"
            "?glob=%2A%2A%2F%2A.yaml&offset=0&limit=50"
        ),
        json={"items": [_FILE_ITEM], "total": 1, "offset": 0, "limit": 50},
    )
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/imports:batch"
        ),
        method="POST",
        json={
            **_BATCH_IMPORT_RESULT,
            "status": "failed",
            "counts": {"total": 1, "succeeded": 0, "failed": 1, "skipped": 0},
            "items": [
                {
                    "file_id": _FILE_ID,
                    "status": "failed",
                    "failure": {"message": "import failed"},
                },
            ],
        },
    )
    result = runner.invoke(
        app,
        ["repos", "import", _REPO_ID, "--files", "**/*.yaml", "--new-project"],
    )
    assert result.exit_code == EXIT_ERROR
    assert "Batch import completed." in strip_ansi(result.stdout)


def test_repos_import_batch_resume_run(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/imports:batch"
        ),
        method="POST",
        json={**_BATCH_IMPORT_RESULT, "resumed": True},
        match_json={"dry_run": False, "resume_run_id": _BATCH_RUN_ID},
    )
    result = runner.invoke(
        app,
        ["repos", "import", _REPO_ID, "--resume-run-id", _BATCH_RUN_ID],
    )
    assert result.exit_code == EXIT_SUCCESS
    assert "Batch import completed." in strip_ansi(result.stdout)


_IMPORT_ID = "22222222-2222-4222-8222-222222222222"
_IMPORT_ID_2 = "33333333-3333-4333-8333-333333333333"
_IMPORT_RUN_ID = "44444444-4444-4444-8444-444444444444"
_USER_ID = "55555555-5555-4555-8555-555555555555"

_IMPORT_ITEM = {
    "id": _IMPORT_ID,
    "repository_file_id": _FILE_ID,
    "file_path": "openapi/petstore.yaml",
    "file_name": "petstore.yaml",
    "project_id": _PROJECT_ID,
    "project_name": "Pet Store",
    "project_version_id": _VERSION_ID,
    "version_name": "1.0.0",
    "spec_version": "1.0.0",
    "imported_by_user_id": _USER_ID,
    "imported_at": "2026-06-07T12:00:00Z",
    "blob_sha": "a" * 40,
    "import_run_id": _IMPORT_RUN_ID,
}

_IMPORT_ITEM_2 = {
    **_IMPORT_ITEM,
    "id": _IMPORT_ID_2,
    "file_path": "arazzo/checkout.yaml",
    "file_name": "checkout.yaml",
    "project_name": "Checkout Flow",
    "version_name": "2.0.0",
    "imported_at": "2026-06-06T12:00:00Z",
}


def test_repos_imports_requires_api_key() -> None:
    result = runner.invoke(app, ["repos", "imports", _REPO_ID])
    assert result.exit_code == EXIT_USAGE
    assert "API key required" in strip_ansi(result.stderr)


def test_repos_imports_requires_tenant_scope(api_key_only_env: None) -> None:
    result = runner.invoke(app, ["repos", "imports", _REPO_ID])
    assert result.exit_code == EXIT_USAGE
    assert "Tenant scope required" in strip_ansi(result.stderr)


def test_repos_imports_human_output(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/imports"
            "?offset=0&limit=50"
        ),
        json={"items": [_IMPORT_ITEM, _IMPORT_ITEM_2], "total": 2, "offset": 0, "limit": 50},
        match_headers={"X-API-Key": "obj_test_workspace_key"},
    )
    result = runner.invoke(app, ["repos", "imports", _REPO_ID])
    assert result.exit_code == EXIT_SUCCESS
    output = strip_ansi(result.stdout)
    assert "openapi/pet" in output
    assert "Pet Store" in output
    assert "1.0.0" in output
    assert "Checkout" in output
    assert "Flow" in output
    assert "Showing 2 of 2" in output


def test_repos_imports_json_format(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/imports"
            "?offset=0&limit=50"
        ),
        json={"items": [_IMPORT_ITEM], "total": 1, "offset": 0, "limit": 50},
    )
    result = runner.invoke(app, ["repos", "imports", _REPO_ID, "--format", "json"])
    assert result.exit_code == EXIT_SUCCESS
    payload = json.loads(result.stdout)
    assert payload["total"] == 1
    assert payload["items"][0]["file_path"] == "openapi/petstore.yaml"
    assert payload["items"][0]["project_name"] == "Pet Store"


def test_repos_imports_filtered_by_project_version_and_actor(
    httpx_mock: object,
    repos_env: None,
) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/imports"
            f"?project_id={_PROJECT_ID}&version_id={_VERSION_ID}&actor_id={_USER_ID}"
            "&since=2026-06-01T00%3A00%3A00Z&until=2026-06-30T23%3A59%3A59Z"
            "&offset=0&limit=50"
        ),
        json={"items": [_IMPORT_ITEM], "total": 1, "offset": 0, "limit": 50},
    )
    result = runner.invoke(
        app,
        [
            "repos",
            "imports",
            _REPO_ID,
            "--project",
            _PROJECT_ID,
            "--version-id",
            _VERSION_ID,
            "--actor",
            _USER_ID,
            "--since",
            "2026-06-01T00:00:00Z",
            "--until",
            "2026-06-30T23:59:59Z",
        ],
    )
    assert result.exit_code == EXIT_SUCCESS
    output = strip_ansi(result.stdout)
    assert "openapi/pet" in output
    assert "Checkout" not in output


def test_repos_imports_empty_human_output(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/imports"
            "?offset=0&limit=50"
        ),
        json={"items": [], "total": 0, "offset": 0, "limit": 50},
    )
    result = runner.invoke(app, ["repos", "imports", _REPO_ID])
    assert result.exit_code == EXIT_SUCCESS
    output = strip_ansi(result.stdout)
    assert "No items." in output
    assert "Total: 0" in output


def test_repos_imports_global_json_flag(httpx_mock: object, repos_env: None) -> None:
    httpx_mock.add_response(
        url=(
            f"http://localhost:8000/tenants/{_TENANT_ID}/repositories/{_REPO_ID}/imports"
            "?offset=0&limit=50"
        ),
        json={"items": [_IMPORT_ITEM], "total": 1, "offset": 0, "limit": 50},
    )
    result = runner.invoke(app, ["--json", "repos", "imports", _REPO_ID])
    assert result.exit_code == EXIT_SUCCESS
    payload = json.loads(result.stdout)
    assert payload["items"][0]["version_name"] == "1.0.0"


def test_repos_imports_rejects_invalid_format(repos_env: None) -> None:
    result = runner.invoke(
        app,
        ["repos", "imports", _REPO_ID, "--format", "yaml"],
    )
    assert result.exit_code != EXIT_SUCCESS
    assert "format must be 'table' or 'json'" in strip_ansi(result.output)


def test_repos_imports_rejects_invalid_since(repos_env: None) -> None:
    result = runner.invoke(
        app,
        ["repos", "imports", _REPO_ID, "--since", "not-a-date"],
    )
    assert result.exit_code != EXIT_SUCCESS
    assert "--since must be an ISO-8601" in strip_ansi(result.output)


def test_repos_help_lists_imports_subcommand() -> None:
    group_result = runner.invoke(app, ["repos", "--help"])
    assert group_result.exit_code == EXIT_SUCCESS
    assert "imports" in strip_ansi(group_result.stdout)

    imports_result = runner.invoke(app, ["repos", "imports", "--help"])
    assert imports_result.exit_code == EXIT_SUCCESS
    imports_help = strip_ansi(imports_result.stdout)
    assert "--project" in imports_help
    assert "--version-id" in imports_help
    assert "--actor" in imports_help
    assert "--since" in imports_help
    assert "--until" in imports_help
    assert "--format" in imports_help
