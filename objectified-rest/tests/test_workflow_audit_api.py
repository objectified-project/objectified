"""Workflow audit list API (#2578)."""

from datetime import datetime, timezone
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.auth import validate_authentication
from app.main import app
from app.repositories.spec_detail import derive_change_report_summary_kind

client = TestClient(app)

_MOCK_AUTH = {
    "tenant_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "user_id": "11111111-2222-3333-4444-555555555555",
    "auth_method": "jwt",
}

_PROJECT_ID = "33333333-4444-5555-6666-777777777777"


@pytest.fixture(autouse=True)
def _auth():
    app.dependency_overrides[validate_authentication] = lambda: _MOCK_AUTH
    yield
    app.dependency_overrides.pop(validate_authentication, None)


def _sample_row():
    return {
        "id": "aaaaaaaa-bbbb-cccc-dddd-000000000001",
        "tenant_id": _MOCK_AUTH["tenant_id"],
        "project_id": _PROJECT_ID,
        "version_id": "aaaaaaaa-bbbb-cccc-dddd-000000000002",
        "action": "version.push",
        "outcome": "success",
        "actor_id": _MOCK_AUTH["user_id"],
        "detail": {"k": 1},
        "created_at": datetime(2026, 4, 1, 12, 0, 0, tzinfo=timezone.utc),
    }


def test_workflow_audit_offset_mode():
    with patch("app.workflow_audit_routes.db") as mdb:
        mdb.count_workflow_audit_filtered.return_value = 2
        mdb.search_workflow_audit.return_value = [_sample_row()]
        mdb.get_project_by_id.return_value = {"id": _PROJECT_ID}
        r = client.get(
            f"/v1/versions/t/workflow-audit?limit=1&offset=0&projectId={_PROJECT_ID}"
        )
    assert r.status_code == 200
    data = r.json()
    assert data["schemaVersion"] == 1
    assert data["pagination"]["total"] == 2
    assert data["pagination"]["hasMore"] is True
    assert data["pagination"]["offset"] == 0
    assert data["pagination"]["nextOffset"] == 1
    assert data["pagination"]["nextCursor"] is not None
    assert data["items"][0]["action"] == "version.push"
    assert data["items"][0]["tenantId"] == _MOCK_AUTH["tenant_id"]
    mdb.search_workflow_audit.assert_called_once()
    kw = mdb.search_workflow_audit.call_args
    assert kw[1]["limit"] == 1
    assert kw[1]["offset"] == 0


def test_workflow_audit_project_not_found():
    with patch("app.workflow_audit_routes.db") as mdb:
        mdb.get_project_by_id.return_value = None
        r = client.get(
            f"/v1/versions/t/workflow-audit?projectId={_PROJECT_ID}"
        )
    assert r.status_code == 404


def test_workflow_audit_cursor_and_offset_rejected():
    with patch("app.workflow_audit_routes.db") as mdb:
        mdb.count_workflow_audit_filtered.return_value = 0
        r = client.get(
            "/v1/versions/t/workflow-audit?cursor=eyJ0IjoiMjAyNi0wNC0wMVQxMjowMDowMCswMDowMCIsImkiOiJhYWFhYWFhYS1iYmJiLWNjY2MtZGRkZC0wMDAwMDAwMDAwMDEifQ&offset=1"
        )
    assert r.status_code == 400


def test_workflow_audit_invalid_outcome():
    with patch("app.workflow_audit_routes.db"):
        r = client.get("/v1/versions/t/workflow-audit?outcome=maybe")
    assert r.status_code == 400


def test_workflow_audit_invalid_cursor():
    with patch("app.workflow_audit_routes.db") as mdb:
        mdb.count_workflow_audit_filtered.return_value = 0
        r = client.get("/v1/versions/t/workflow-audit?cursor=not-valid")
    assert r.status_code == 400


def test_workflow_audit_cursor_mode_next_cursor():
    row = _sample_row()
    with patch("app.workflow_audit_routes.db") as mdb:
        mdb.count_workflow_audit_filtered.return_value = 10
        mdb.search_workflow_audit.return_value = [row, row]
        r = client.get("/v1/versions/t/workflow-audit?limit=1")
    assert r.status_code == 200
    data = r.json()
    assert data["pagination"]["hasMore"] is True
    assert data["pagination"]["nextCursor"] is not None
    assert data["pagination"]["offset"] == 0
    nc = data["pagination"]["nextCursor"]
    with patch("app.workflow_audit_routes.db") as mdb:
        mdb.count_workflow_audit_filtered.return_value = 10
        mdb.search_workflow_audit.return_value = []
        r2 = client.get(f"/v1/versions/t/workflow-audit?limit=1&cursor={nc}")
    assert r2.status_code == 200
    assert r2.json()["pagination"]["offset"] is None
    ca = mdb.search_workflow_audit.call_args[1]["cursor_created_at"]
    assert ca is not None
    assert mdb.search_workflow_audit.call_args[1]["cursor_id"] == row["id"]


def test_workflow_audit_repository_auto_imported_change_report_projection():
    rid = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    row = {
        "id": "aaaaaaaa-bbbb-cccc-dddd-000000000099",
        "tenant_id": _MOCK_AUTH["tenant_id"],
        "project_id": None,
        "version_id": None,
        "action": "repository.auto_imported",
        "outcome": "success",
        "actor_id": _MOCK_AUTH["user_id"],
        "detail": {
            "repositoryId": rid,
            "importJobId": "aaaaaaaa-bbbb-cccc-dddd-000000000088",
            "changeReportId": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            "changeReportSummaryKind": "breaking",
            "changeReportBreakingChangeCount": 3,
            "changeReportAdditiveChangeCount": 1,
        },
        "created_at": datetime(2026, 4, 1, 12, 0, 0, tzinfo=timezone.utc),
    }
    with patch("app.workflow_audit_routes.db") as mdb:
        mdb.count_workflow_audit_filtered.return_value = 1
        mdb.search_workflow_audit.return_value = [row]
        r = client.get("/v1/versions/t/workflow-audit?action=repository.auto_imported")
    assert r.status_code == 200
    item = r.json()["items"][0]
    assert item["action"] == "repository.auto_imported"
    assert item["changeReport"]["id"] == "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
    assert item["changeReport"]["summaryKind"] == "breaking"
    assert item["changeReport"]["breakingChangeCount"] == 3


def test_derive_change_report_summary_kind() -> None:
    assert derive_change_report_summary_kind(1, 99) == "breaking"
    assert derive_change_report_summary_kind(0, 4) == "additive"
    assert derive_change_report_summary_kind(0, 0) == "none"

