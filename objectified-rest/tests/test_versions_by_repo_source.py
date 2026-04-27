from unittest.mock import patch

from fastapi.testclient import TestClient

from app.auth import validate_authentication
from app.main import app

client = TestClient(app)

_MOCK_AUTH = {
    "tenant_id": "test-tenant-id",
    "user_id": "test-user-id",
    "auth_method": "jwt",
}


def _min_version() -> dict:
    return {
        "id": "rev-1",
        "project_id": "proj-1",
        "creator_id": "test-user-id",
        "version_id": "1.0.0",
        "description": "repo import",
        "change_log": "initial",
        "visibility": "private",
        "published": False,
        "published_at": None,
        "enabled": True,
        "parent_version_id": None,
        "merge_parent_version_id": None,
        "forked_from_revision_id": None,
        "upstream_project_id": None,
        "revision_locked": False,
        "metadata": {
            "repositorySource": {
                "repositoryId": "00000000-0000-0000-0000-000000000555",
                "branch": "main",
                "path": "apis/openapi.yaml",
                "commitSha": "a" * 40,
                "contentChecksum": "b" * 64,
                "contentAlgo": "sha256",
                "importedAt": "2026-04-26T21:55:00Z",
            }
        },
        "created_at": "2026-04-26T21:55:00Z",
        "updated_at": "2026-04-26T21:55:00Z",
        "creator_name": "Test User",
        "creator_email": "test@example.com",
        "project_name": "Project One",
        "project_slug": "project-one",
    }


def test_get_version_by_repo_source_requires_auth() -> None:
    response = client.get(
        "/v1/versions/test-tenant/by-repo-source",
        params={
            "repository_id": "00000000-0000-0000-0000-000000000555",
            "path": "apis/openapi.yaml",
        },
    )
    assert response.status_code == 401


def test_get_version_by_repo_source_returns_latest_version() -> None:
    app.dependency_overrides[validate_authentication] = lambda tenant_slug: _MOCK_AUTH
    try:
        with patch("app.versions_routes.db") as mdb:
            mdb.get_latest_version_by_repository_source.return_value = _min_version()
            response = client.get(
                "/v1/versions/test-tenant/by-repo-source",
                params={
                    "repository_id": "00000000-0000-0000-0000-000000000555",
                    "path": "apis/openapi.yaml",
                },
            )
        assert response.status_code == 200
        assert response.json()["version_id"] == "1.0.0"
        mdb.get_latest_version_by_repository_source.assert_called_once_with(
            "test-tenant-id",
            "00000000-0000-0000-0000-000000000555",
            "apis/openapi.yaml",
        )
    finally:
        app.dependency_overrides.pop(validate_authentication, None)


def test_get_version_by_repo_source_rejects_invalid_repository_id() -> None:
    app.dependency_overrides[validate_authentication] = lambda tenant_slug: _MOCK_AUTH
    try:
        with patch("app.versions_routes.db") as mdb:
            response = client.get(
                "/v1/versions/test-tenant/by-repo-source",
                params={"repository_id": "not-a-uuid", "path": "apis/openapi.yaml"},
            )
        assert response.status_code == 400
        assert response.json()["detail"] == "repository_id must be a valid UUID"
        mdb.get_latest_version_by_repository_source.assert_not_called()
    finally:
        app.dependency_overrides.pop(validate_authentication, None)


def test_get_version_by_repo_source_returns_404_when_not_found() -> None:
    app.dependency_overrides[validate_authentication] = lambda tenant_slug: _MOCK_AUTH
    try:
        with patch("app.versions_routes.db") as mdb:
            mdb.get_latest_version_by_repository_source.return_value = None
            response = client.get(
                "/v1/versions/test-tenant/by-repo-source",
                params={
                    "repository_id": "00000000-0000-0000-0000-000000000555",
                    "path": "apis/openapi.yaml",
                },
            )
        assert response.status_code == 404
        assert response.json()["detail"] == "Version not found for repository source"
    finally:
        app.dependency_overrides.pop(validate_authentication, None)
