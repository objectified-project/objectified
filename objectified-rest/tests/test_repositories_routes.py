from fastapi.testclient import TestClient

from app.auth import validate_authentication
from app.main import app

client = TestClient(app)

_MOCK_AUTH = {
    "tenant_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "tenant_slug": "test-tenant",
    "user_id": "11111111-2222-3333-4444-555555555555",
    "auth_method": "jwt",
}

_TENANT_SLUG = "test-tenant"


def _override_auth():
    return _MOCK_AUTH


def test_register_repository_returns_scan_job_and_timeline_entry():
    app.dependency_overrides[validate_authentication] = _override_auth
    try:
        response = client.post(
            f"/v1/repositories/{_TENANT_SLUG}",
            json={
                "linkedAccountId": "aaaaaaaa-bbbb-cccc-dddd-000000000001",
                "provider": "github",
                "owner": "acme",
                "name": "api-platform",
                "branches": [{"branch": "main", "subpathGlob": "specs/**"}],
                "manifest": "scan:\n  paths:\n    - specs/openapi.yaml\n",
            },
        )
    finally:
        app.dependency_overrides.pop(validate_authentication, None)

    assert response.status_code == 201
    body = response.json()
    assert body["initialScanJobId"]
    assert body["repository"]["fullName"] == "acme/api-platform"
    assert body["repository"]["status"] == "scan_in_progress"
    assert body["repository"]["timeline"][0]["message"] == "Scan in progress..."
    assert body["repository"]["branches"] == [{"branch": "main", "subpathGlob": "specs/**", "pollIntervalSec": None}]


def test_repository_list_and_detail_are_tenant_scoped():
    app.dependency_overrides[validate_authentication] = _override_auth
    try:
        create_response = client.post(
            f"/v1/repositories/{_TENANT_SLUG}",
            json={
                "linkedAccountId": "aaaaaaaa-bbbb-cccc-dddd-000000000002",
                "provider": "github",
                "owner": "widgets-co",
                "name": "orders",
                "branches": [{"branch": "main"}],
            },
        )
        repository_id = create_response.json()["repository"]["id"]
        list_response = client.get(f"/v1/repositories/{_TENANT_SLUG}")
        detail_response = client.get(f"/v1/repositories/{_TENANT_SLUG}/{repository_id}")
    finally:
        app.dependency_overrides.pop(validate_authentication, None)

    assert create_response.status_code == 201
    assert list_response.status_code == 200
    assert detail_response.status_code == 200
    assert any(item["id"] == repository_id for item in list_response.json()["repositories"])
    assert detail_response.json()["id"] == repository_id


def test_register_repository_defaults_subpath_and_accepts_wildcard_branch():
    app.dependency_overrides[validate_authentication] = _override_auth
    try:
        response = client.post(
            f"/v1/repositories/{_TENANT_SLUG}",
            json={
                "linkedAccountId": "aaaaaaaa-bbbb-cccc-dddd-000000000003",
                "provider": "github",
                "owner": "acme",
                "name": "api-platform",
                "branches": [{"branch": "release/*"}],
            },
        )
    finally:
        app.dependency_overrides.pop(validate_authentication, None)

    assert response.status_code == 201
    body = response.json()
    assert body["repository"]["branches"] == [{"branch": "release/*", "subpathGlob": "**/*", "pollIntervalSec": None}]


def test_update_repository_branches_replaces_config_and_updates_timestamp():
    app.dependency_overrides[validate_authentication] = _override_auth
    try:
        create_response = client.post(
            f"/v1/repositories/{_TENANT_SLUG}",
            json={
                "linkedAccountId": "aaaaaaaa-bbbb-cccc-dddd-000000000004",
                "provider": "github",
                "owner": "widgets-co",
                "name": "orders",
                "branches": [{"branch": "main"}],
            },
        )
        repository_id = create_response.json()["repository"]["id"]
        original_updated_at = create_response.json()["repository"]["updatedAt"]
        patch_response = client.patch(
            f"/v1/repositories/{_TENANT_SLUG}/{repository_id}/branches",
            json={
                "branches": [
                    {"branch": "release/*", "subpathGlob": "services/**", "pollIntervalSec": 120},
                    {"branch": "main", "pollIntervalSec": 300},
                ]
            },
        )
    finally:
        app.dependency_overrides.pop(validate_authentication, None)

    assert create_response.status_code == 201
    assert patch_response.status_code == 200
    body = patch_response.json()
    assert body["branches"] == [
        {"branch": "release/*", "subpathGlob": "services/**", "pollIntervalSec": 120},
        {"branch": "main", "subpathGlob": "**/*", "pollIntervalSec": 300},
    ]
    assert body["updatedAt"] >= original_updated_at
