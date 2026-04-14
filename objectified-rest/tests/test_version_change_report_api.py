"""Persisted change report routes (CR-02, #2700)."""

from datetime import datetime, timezone
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.auth import validate_authentication
from app.main import app

client = TestClient(app)

_MOCK_JWT = {
    "tenant_id": "t1",
    "user_id": "user-a",
    "auth_method": "jwt",
}

_MOCK_API_KEY = {
    "tenant_id": "t1",
    "tenant_slug": "tn",
    "auth_method": "api_key",
}

_MOCK_ROW = {
    "id": "cr-1",
    "tenant_id": "t1",
    "project_id": "p1",
    "published_revision_id": "v1",
    "baseline_revision_id": "v0",
    "change_model_json": {"schemaVersion": "1.0", "schemas": {"added": [], "removed": [], "modified": []}, "properties": [], "references": [], "relationships": [], "documentation": [], "warnings": [], "skipped": []},
    "rendered_body": "body",
    "header_snapshot": "hdr",
    "footnote_snapshot": "fn",
    "edited_rendered_body": None,
    "edited_header_snapshot": None,
    "edited_footnote_snapshot": None,
    "edited_at": None,
    "edited_by": None,
    "template_version_id": None,
    "rendered_at": datetime(2026, 4, 14, 12, 0, 0, tzinfo=timezone.utc),
    "regenerated_at": None,
    "created_at": datetime(2026, 4, 14, 11, 0, 0, tzinfo=timezone.utc),
    "updated_at": datetime(2026, 4, 14, 11, 0, 0, tzinfo=timezone.utc),
}

_MOCK_VERSION_PUBLISHED = {
    "id": "v1",
    "project_id": "p1",
    "creator_id": "user-a",
    "published": True,
}

_MOCK_VERSION_DRAFT = {
    "id": "v1",
    "project_id": "p1",
    "creator_id": "user-a",
    "published": False,
}


@pytest.fixture(autouse=True)
def _auth():
    app.dependency_overrides[validate_authentication] = lambda: _MOCK_JWT
    yield
    app.dependency_overrides.pop(validate_authentication, None)


def test_get_change_report_ok():
    with patch("app.version_change_report_routes.db") as mdb:
        mdb.get_version_by_id.return_value = _MOCK_VERSION_PUBLISHED
        mdb.get_change_report_by_published_revision.return_value = _MOCK_ROW
        r = client.get("/v1/versions/tn/p1/v1/change-report")
        assert r.status_code == 200
        d = r.json()
        assert d["publishedRevisionId"] == "v1"
        assert d["effectiveRenderedBody"] == "body"


def test_get_change_report_404_no_row():
    with patch("app.version_change_report_routes.db") as mdb:
        mdb.get_version_by_id.return_value = _MOCK_VERSION_PUBLISHED
        mdb.get_change_report_by_published_revision.return_value = None
        r = client.get("/v1/versions/tn/p1/v1/change-report")
        assert r.status_code == 404


def test_get_change_report_400_unpublished():
    with patch("app.version_change_report_routes.db") as mdb:
        mdb.get_version_by_id.return_value = _MOCK_VERSION_DRAFT
        r = client.get("/v1/versions/tn/p1/v1/change-report")
        assert r.status_code == 400


def test_patch_forbidden_api_key():
    app.dependency_overrides[validate_authentication] = lambda: _MOCK_API_KEY
    try:
        r = client.patch("/v1/versions/tn/p1/v1/change-report", json={"editedRenderedBody": "x"})
        assert r.status_code == 403
    finally:
        app.dependency_overrides[validate_authentication] = lambda: _MOCK_JWT


def test_patch_403_not_creator():
    with patch("app.version_change_report_routes.db") as mdb:
        mdb.get_version_by_id.return_value = {
            **_MOCK_VERSION_PUBLISHED,
            "creator_id": "someone-else",
        }
        mdb.is_user_tenant_admin.return_value = False
        r = client.patch(
            "/v1/versions/tn/p1/v1/change-report",
            json={"editedRenderedBody": "edited"},
        )
        assert r.status_code == 403


def test_patch_ok():
    updated = {**_MOCK_ROW, "edited_rendered_body": "edited", "edited_by": "user-a"}
    with patch("app.version_change_report_routes.db") as mdb:
        mdb.get_version_by_id.return_value = _MOCK_VERSION_PUBLISHED
        mdb.get_change_report_by_published_revision.return_value = _MOCK_ROW
        mdb.patch_change_report_edits.return_value = updated
        mdb.is_user_tenant_admin.return_value = False
        r = client.patch(
            "/v1/versions/tn/p1/v1/change-report",
            json={"editedRenderedBody": "edited"},
        )
        assert r.status_code == 200
        assert r.json()["effectiveRenderedBody"] == "edited"
        mdb.patch_change_report_edits.assert_called_once()


def test_regenerate_ok():
    regen_row = {
        **_MOCK_ROW,
        "rendered_body": "new body",
        "header_snapshot": "Publication change report",
        "regenerated_at": datetime(2026, 4, 14, 13, 0, 0, tzinfo=timezone.utc),
    }
    with patch("app.version_change_report_routes.db") as mdb:
        mdb.get_version_by_id.return_value = _MOCK_VERSION_PUBLISHED
        mdb.get_change_report_by_published_revision.return_value = _MOCK_ROW
        mdb.apply_change_report_regeneration.return_value = regen_row
        mdb.is_user_tenant_admin.return_value = False
        r = client.post("/v1/versions/tn/p1/v1/change-report/regenerate", json={})
        assert r.status_code == 200
        assert "new body" in r.json()["renderedBody"]


def test_placeholder_render_module():
    from app.change_report_render import placeholder_render_from_change_model

    h, b, f = placeholder_render_from_change_model(
        {"schemaVersion": "1.0", "schemas": {"added": [{"name": "A"}], "removed": [], "modified": []}}
    )
    assert "Schema change summary" in b
    assert h == "Publication change report"
    assert "CR-03" in f
