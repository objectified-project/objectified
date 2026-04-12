"""Workflow audit ledger writes (#2577)."""

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.auth import validate_authentication
from app.main import app

client = TestClient(app)

_MOCK_AUTH = {
    "tenant_id": "test-tenant-id",
    "user_id": "test-user-id",
    "auth_method": "jwt",
}


@pytest.fixture(autouse=True)
def _auth():
    app.dependency_overrides[validate_authentication] = lambda: _MOCK_AUTH
    yield
    app.dependency_overrides.pop(validate_authentication, None)


def test_get_version_emits_pull_audit():
    row = {
        "id": "rev-1",
        "project_id": "proj-1",
        "creator_id": "test-user-id",
        "version_id": "1.0.0",
        "description": None,
        "change_log": None,
        "visibility": "private",
        "published": False,
        "published_at": None,
        "enabled": True,
        "parent_version_id": None,
        "merge_parent_version_id": None,
        "forked_from_revision_id": None,
        "upstream_project_id": None,
        "revision_locked": False,
        "metadata": None,
        "created_at": None,
        "updated_at": None,
        "creator_name": None,
        "creator_email": None,
        "project_name": "P",
        "project_slug": "p",
    }
    with patch("app.versions_routes.db") as mdb:
        mdb.get_version_by_id.return_value = row
        mdb.insert_workflow_audit = MagicMock()
        r = client.get("/v1/versions/tn/proj-1/rev-1")
    assert r.status_code == 200
    mdb.insert_workflow_audit.assert_called_once()
    kw = mdb.insert_workflow_audit.call_args
    assert kw[0][3] == "version.pull"
    assert kw[0][4] == "success"
    assert kw[0][2] == "rev-1"


def test_create_version_push_success_audits():
    version_row = {
        "id": "new-rev",
        "project_id": "proj-1",
        "creator_id": "test-user-id",
        "version_id": "0.1.0",
        "description": "m",
        "change_log": None,
        "visibility": "private",
        "published": False,
        "published_at": None,
        "enabled": True,
        "parent_version_id": None,
        "merge_parent_version_id": None,
        "forked_from_revision_id": None,
        "upstream_project_id": None,
        "revision_locked": False,
        "metadata": None,
        "created_at": None,
        "updated_at": None,
        "creator_name": None,
        "creator_email": None,
        "project_name": "P",
        "project_slug": "p",
    }
    with patch("app.versions_routes.db") as mdb:
        mdb.get_project_by_id.return_value = {"id": "proj-1", "metadata": {}}
        mdb.get_latest_version_for_project.return_value = None
        mdb.list_version_branches_for_project.return_value = []
        mdb.get_latest_revision_id_for_project.return_value = None
        mdb.create_version_push_transaction.return_value = (version_row, 0)
        mdb.insert_workflow_audit = MagicMock()
        r = client.post(
            "/v1/versions/tn/proj-1",
            json={
                "version_id": "0.1.0",
                "short_message": "hello",
                "base_revision_id": "",
            },
        )
    assert r.status_code == 200
    mdb.insert_workflow_audit.assert_called_once()
    args = mdb.insert_workflow_audit.call_args[0]
    assert args[3] == "version.push"
    assert args[4] == "success"
    assert args[2] == "new-rev"
