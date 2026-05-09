"""Contract tests for specification import REST surface (#3329)."""

import json

import pytest
from fastapi.testclient import TestClient

from app.auth import validate_authentication
from app.main import app
from app.spec_import_routes import SPEC_IMPORT_NOT_IMPLEMENTED

client = TestClient(app)

_MOCK_AUTH = {
    "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
    "tenant_slug": "acme",
    "user_id": "660e8400-e29b-41d4-a716-446655440001",
    "auth_method": "jwt",
}


@pytest.fixture(autouse=True)
def _auth_override():
    def _fake_auth(tenant_slug: str):
        return {**_MOCK_AUTH, "tenant_slug": tenant_slug}

    app.dependency_overrides[validate_authentication] = _fake_auth
    app.openapi_schema = None
    yield
    app.dependency_overrides.pop(validate_authentication, None)
    app.openapi_schema = None


def test_openapi_lists_spec_import_paths_and_operations():
    spec = app.openapi()
    paths = spec["paths"]
    base = "/v1/tenants/{tenant_slug}/imports"
    upload = f"{base}/upload"
    job = f"{base}/{{job_id}}"
    assert base in paths
    assert "post" in paths[base]
    assert upload in paths
    assert job in paths
    assert "get" in paths[job]
    assert "delete" in paths[job]
    assert f"{job}/commit" in paths
    assert f"{job}/rollback" in paths


def test_start_spec_import_json_returns_501():
    body = {
        "metadata": {
            "source_kind": "openapi-3",
            "project": {"name": "Payments", "slug": "payments-api"},
            "version": {"version_id": "1.0.0"},
            "options": {},
        },
        "document_base64": "b3BlbmFwaTogMy4xLjA=",
        "filename": "spec.yaml",
    }
    r = client.post("/v1/tenants/acme/imports", json=body)
    assert r.status_code == 501
    assert r.json()["detail"] == SPEC_IMPORT_NOT_IMPLEMENTED


def test_start_spec_import_multipart_returns_501():
    meta = json.dumps(
        {
            "source_kind": "openapi-3",
            "project": {"name": "Payments", "slug": "payments-api"},
            "version": {"version_id": "1.0.0"},
            "options": {},
        }
    )
    r = client.post(
        "/v1/tenants/acme/imports/upload",
        files={"file": ("spec.yaml", b"openapi: 3.1.0\n", "application/yaml")},
        data={"metadata": meta},
    )
    assert r.status_code == 501
    assert r.json()["detail"] == SPEC_IMPORT_NOT_IMPLEMENTED


def test_get_cancel_commit_rollback_return_501():
    for method, url in [
        ("GET", "/v1/tenants/acme/imports/job-1"),
        ("DELETE", "/v1/tenants/acme/imports/job-1"),
        ("POST", "/v1/tenants/acme/imports/job-1/commit"),
        ("POST", "/v1/tenants/acme/imports/job-1/rollback"),
    ]:
        r = client.request(method, url)
        assert r.status_code == 501, (method, url, r.text)
        assert r.json()["detail"] == SPEC_IMPORT_NOT_IMPLEMENTED
