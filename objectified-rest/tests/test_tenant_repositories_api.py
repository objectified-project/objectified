"""Tests for GET/POST /v1/tenants/{slug}/repositories."""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from psycopg2 import errors as pg_errors

from app.auth import validate_authentication
from app.main import app

client = TestClient(app)

_TENANT_ID = "550e8400-e29b-41d4-a716-446655440000"
_USER_ID = "660e8400-e29b-41d4-a716-446655440001"
_LINKED_ACCOUNT_ID = "770e8400-e29b-41d4-a716-446655440002"

_JWT = {
    "tenant_id": _TENANT_ID,
    "tenant_slug": "acme",
    "user_id": _USER_ID,
    "auth_method": "jwt",
}

_API_KEY_AUTH = {
    "tenant_id": _TENANT_ID,
    "tenant_slug": "acme",
    "auth_method": "api_key",
}

_LIST_ROW = {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "tenant_id": _TENANT_ID,
    "source": "public_url",
    "provider": "github",
    "clone_url": "https://github.com/octocat/Hello-World.git",
    "repository_full_name": "octocat/Hello-World",
    "description": "Hi",
    "default_branch": "main",
    "visibility": "public",
    "status": "scanning",
    "created_at": None,
    "updated_at": None,
    "linked_account_id": None,
    "last_scanned_at": None,
    "total_files": None,
    "importable_count": None,
}


@pytest.fixture(autouse=True)
def _auth_jwt():
    app.dependency_overrides[validate_authentication] = lambda: _JWT
    yield
    app.dependency_overrides.pop(validate_authentication, None)


def test_list_repositories_ok():
    with patch("app.tenant_repositories_routes.db") as mdb:
        mdb.list_tenant_repositories.return_value = [_LIST_ROW]
        r = client.get("/v1/tenants/acme/repositories")
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert len(data["repositories"]) == 1
    assert data["repositories"][0]["full_name"] == "octocat/Hello-World"


def test_get_repository_ok():
    rid = _LIST_ROW["id"]
    with patch("app.tenant_repositories_routes.db") as mdb:
        mdb.get_tenant_repository.return_value = _LIST_ROW
        r = client.get(f"/v1/tenants/acme/repositories/{rid}")
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["repository"]["id"] == rid
    assert body["repository"]["full_name"] == "octocat/Hello-World"


def test_get_repository_not_found():
    with patch("app.tenant_repositories_routes.db") as mdb:
        mdb.get_tenant_repository.return_value = None
        r = client.get("/v1/tenants/acme/repositories/880e8400-e29b-41d4-a716-446655440099")
    assert r.status_code == 404


def test_create_public_url_ok():
    meta = {
        "provider": "github",
        "repository_full_name": "octocat/Hello-World",
        "description": None,
        "default_branch": "main",
        "visibility": "public",
        "canonical_clone_url": "https://github.com/octocat/Hello-World.git",
    }
    inserted = {**_LIST_ROW, "clone_url": meta["canonical_clone_url"]}
    with (
        patch("app.tenant_repositories_routes.validate_public_clone_url", return_value=meta),
        patch("app.tenant_repositories_routes.db") as mdb,
    ):
        mdb.insert_tenant_repository.return_value = inserted
        r = client.post(
            "/v1/tenants/acme/repositories",
            json={"source": "public_url", "clone_url": "https://github.com/octocat/Hello-World.git"},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert body["repository"]["provider"] == "github"
        assert body["repository"]["status"] == "scanning"
        mdb.insert_tenant_repository.assert_called_once()
        assert mdb.insert_tenant_repository.call_args.kwargs.get("status") == "scanning"
        mdb.enqueue_repository_file_scan_job.assert_called_once_with(
            _TENANT_ID,
            _LIST_ROW["id"],
            "main",
        )


def test_create_public_url_validation_error():
    with patch(
        "app.tenant_repositories_routes.validate_public_clone_url",
        side_effect=ValueError("nope"),
    ):
        r = client.post(
            "/v1/tenants/acme/repositories",
            json={"source": "public_url", "clone_url": "https://example.com/x.git"},
        )
    assert r.status_code == 400
    assert r.json()["detail"] == "nope"


def test_create_linked_github_ok():
    meta = {
        "provider": "github",
        "repository_full_name": "octocat/Hello-World",
        "description": None,
        "default_branch": "main",
        "visibility": "public",
        "canonical_clone_url": "https://github.com/octocat/Hello-World.git",
    }
    oauth_row = {"id": _LINKED_ACCOUNT_ID, "provider": "github", "access_token": "tok"}
    inserted = {**_LIST_ROW}
    with (
        patch("app.tenant_repositories_routes.db") as mdb,
        patch(
            "app.tenant_repositories_routes.fetch_github_repo_with_token",
            return_value=meta,
        ),
    ):
        mdb.get_external_auth_provider_for_user.return_value = oauth_row
        mdb.insert_tenant_repository.return_value = inserted
        r = client.post(
            "/v1/tenants/acme/repositories",
            json={
                "source": "linked_account",
                "linked_account_id": _LINKED_ACCOUNT_ID,
                "repository_full_name": "octocat/Hello-World",
                "clone_url": "https://github.com/octocat/Hello-World.git",
            },
        )
    assert r.status_code == 200
    mdb.get_external_auth_provider_for_user.assert_called_once()
    assert mdb.insert_tenant_repository.call_args.kwargs.get("status") == "scanning"
    assert mdb.insert_tenant_repository.call_args.kwargs.get("linked_account_id") == _LINKED_ACCOUNT_ID
    mdb.enqueue_repository_file_scan_job.assert_called_once()


def test_create_duplicate_conflict():
    meta = {
        "provider": "github",
        "repository_full_name": "octocat/Hello-World",
        "description": None,
        "default_branch": "main",
        "visibility": "public",
        "canonical_clone_url": "https://github.com/octocat/Hello-World.git",
    }
    with (
        patch("app.tenant_repositories_routes.validate_public_clone_url", return_value=meta),
        patch("app.tenant_repositories_routes.db") as mdb,
    ):
        mdb.insert_tenant_repository.side_effect = pg_errors.UniqueViolation()
        r = client.post(
            "/v1/tenants/acme/repositories",
            json={"source": "public_url", "clone_url": "https://github.com/octocat/Hello-World.git"},
        )
    assert r.status_code == 409


def test_create_requires_jwt():
    app.dependency_overrides[validate_authentication] = lambda: _API_KEY_AUTH
    try:
        r = client.post(
            "/v1/tenants/acme/repositories",
            json={"source": "public_url", "clone_url": "https://github.com/octocat/Hello-World.git"},
        )
    finally:
        app.dependency_overrides[validate_authentication] = lambda: _JWT
    assert r.status_code == 403


def test_delete_repository_ok():
    rid = _LIST_ROW["id"]
    with patch("app.tenant_repositories_routes.db") as mdb:
        mdb.delete_tenant_repository.return_value = True
        r = client.delete(f"/v1/tenants/acme/repositories/{rid}")
    assert r.status_code == 200
    assert r.json() == {"success": True}
    mdb.delete_tenant_repository.assert_called_once_with(_TENANT_ID, rid)


def test_delete_repository_not_found():
    with patch("app.tenant_repositories_routes.db") as mdb:
        mdb.delete_tenant_repository.return_value = False
        r = client.delete("/v1/tenants/acme/repositories/880e8400-e29b-41d4-a716-446655440099")
    assert r.status_code == 404
