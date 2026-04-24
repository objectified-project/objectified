from fastapi.testclient import TestClient

from app.auth import validate_authentication
from app.main import app

client = TestClient(app)

_MOCK_AUTH = {
    "tenant_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "user_id": "11111111-2222-3333-4444-555555555555",
    "auth_method": "jwt",
}


def _override_auth():
    return _MOCK_AUTH


def test_register_repository_returns_scan_job_and_timeline_entry():
    app.dependency_overrides[validate_authentication] = _override_auth
    try:
        response = client.post(
            "/v1/repositories",
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


def test_repository_list_and_detail_are_tenant_scoped():
    app.dependency_overrides[validate_authentication] = _override_auth
    try:
        create_response = client.post(
            "/v1/repositories",
            json={
                "linkedAccountId": "aaaaaaaa-bbbb-cccc-dddd-000000000002",
                "provider": "github",
                "owner": "widgets-co",
                "name": "orders",
                "branches": [{"branch": "main"}],
            },
        )
        repository_id = create_response.json()["repository"]["id"]
        list_response = client.get("/v1/repositories")
        detail_response = client.get(f"/v1/repositories/{repository_id}")
    finally:
        app.dependency_overrides.pop(validate_authentication, None)

    assert create_response.status_code == 201
    assert list_response.status_code == 200
    assert detail_response.status_code == 200
    assert any(item["id"] == repository_id for item in list_response.json()["repositories"])
    assert detail_response.json()["id"] == repository_id
