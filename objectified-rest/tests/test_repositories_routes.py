from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.auth import validate_authentication
from app.main import app
from app.repositories_routes import (
    _build_repository_sync_change_report_for_test_status,
    _complete_repository_scan_for_tests,
    _get_repository_audit_rows_for_tests,
    _get_repository_change_reports_for_tests,
    _get_repository_import_jobs_for_tests,
    _get_repository_relations_exist_for_tests,
    _get_repository_resolved_versions_for_tests,
    _list_poll_targets_for_tests,
    _reset_repository_state_for_tests,
    _seed_repository_relations_for_tests,
)

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


def _override_auth_tenant_admin_with_repo_project_autocreate():
    return {
        **_MOCK_AUTH,
        "is_tenant_admin": True,
        "featureFlags": {"repoManifestProjectAutoCreate": True},
    }


@pytest.fixture(autouse=True)
def _clear_repository_state():
    _reset_repository_state_for_tests()
    yield
    _reset_repository_state_for_tests()


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
    list_item = next(item for item in list_response.json()["repositories"] if item["id"] == repository_id)
    assert list_item["lastScanAt"] == create_response.json()["repository"]["timeline"][0]["createdAt"]
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


def test_register_repository_normalizes_whitespace_only_subpath_glob():
    app.dependency_overrides[validate_authentication] = _override_auth
    try:
        response = client.post(
            f"/v1/repositories/{_TENANT_SLUG}",
            json={
                "linkedAccountId": "aaaaaaaa-bbbb-cccc-dddd-000000000005",
                "provider": "github",
                "owner": "acme",
                "name": "whitespace-subpath-test",
                "branches": [{"branch": "main", "subpathGlob": "   "}],
            },
        )
    finally:
        app.dependency_overrides.pop(validate_authentication, None)

    assert response.status_code == 201
    body = response.json()
    assert body["repository"]["branches"] == [{"branch": "main", "subpathGlob": "**/*", "pollIntervalSec": None}]


def test_patch_repository_updates_owner_name_and_manifest():
    app.dependency_overrides[validate_authentication] = _override_auth
    try:
        create_response = client.post(
            f"/v1/repositories/{_TENANT_SLUG}",
            json={
                "linkedAccountId": "aaaaaaaa-bbbb-cccc-dddd-000000000011",
                "provider": "github",
                "owner": "acme",
                "name": "service-a",
                "branches": [{"branch": "main"}],
            },
        )
        repository_id = create_response.json()["repository"]["id"]
        patch_response = client.patch(
            f"/v1/repositories/{_TENANT_SLUG}/{repository_id}",
            json={
                "owner": "acme-inc",
                "name": "service-core",
                "manifest": "scan:\n  include:\n    - src/**\n",
            },
        )
    finally:
        app.dependency_overrides.pop(validate_authentication, None)

    assert patch_response.status_code == 200
    body = patch_response.json()
    assert body["owner"] == "acme-inc"
    assert body["name"] == "service-core"
    assert body["fullName"] == "acme-inc/service-core"
    assert body["manifest"] == "scan:\n  include:\n    - src/**\n"


def test_archive_unarchive_writes_audit_and_scheduler_skips_archived():
    app.dependency_overrides[validate_authentication] = _override_auth
    try:
        create_response = client.post(
            f"/v1/repositories/{_TENANT_SLUG}",
            json={
                "linkedAccountId": "aaaaaaaa-bbbb-cccc-dddd-000000000012",
                "provider": "github",
                "owner": "acme",
                "name": "service-b",
                "branches": [{"branch": "main"}, {"branch": "release/*"}],
            },
        )
        repository_id = create_response.json()["repository"]["id"]
        archive_response = client.post(f"/v1/repositories/{_TENANT_SLUG}/{repository_id}/archive")
        poll_targets_after_archive = _list_poll_targets_for_tests(_MOCK_AUTH["tenant_id"])
        unarchive_response = client.post(f"/v1/repositories/{_TENANT_SLUG}/{repository_id}/unarchive")
        poll_targets_after_unarchive = _list_poll_targets_for_tests(_MOCK_AUTH["tenant_id"])
        audit_rows = _get_repository_audit_rows_for_tests(repository_id)
    finally:
        app.dependency_overrides.pop(validate_authentication, None)

    assert archive_response.status_code == 200
    assert archive_response.json()["status"] == "archived"
    assert archive_response.json()["archivedAt"] is not None
    assert poll_targets_after_archive == []

    assert unarchive_response.status_code == 200
    assert unarchive_response.json()["status"] == "healthy"
    assert unarchive_response.json()["archivedAt"] is None
    assert sorted(target["branch"] for target in poll_targets_after_unarchive) == ["main", "release/*"]

    assert [row["eventType"] for row in audit_rows] == ["repository.archived", "repository.unarchived"]


def test_delete_repository_requires_confirmation_and_cascades():
    app.dependency_overrides[validate_authentication] = _override_auth
    try:
        create_response = client.post(
            f"/v1/repositories/{_TENANT_SLUG}",
            json={
                "linkedAccountId": "aaaaaaaa-bbbb-cccc-dddd-000000000013",
                "provider": "github",
                "owner": "acme",
                "name": "service-c",
                "branches": [{"branch": "main"}],
            },
        )
        repository = create_response.json()["repository"]
        repository_id = repository["id"]
        _seed_repository_relations_for_tests(repository_id)
        wrong_confirmation = client.request(
            method="DELETE",
            url=f"/v1/repositories/{_TENANT_SLUG}/{repository_id}",
            json={"confirmFullName": "acme/wrong-repo"},
        )
        delete_response = client.request(
            method="DELETE",
            url=f"/v1/repositories/{_TENANT_SLUG}/{repository_id}",
            json={"confirmFullName": repository["fullName"]},
        )
        relations_exist = _get_repository_relations_exist_for_tests(repository_id)
        detail_response = client.get(f"/v1/repositories/{_TENANT_SLUG}/{repository_id}")
        audit_rows = _get_repository_audit_rows_for_tests(repository_id)
    finally:
        app.dependency_overrides.pop(validate_authentication, None)

    assert wrong_confirmation.status_code == 400
    assert delete_response.status_code == 204
    assert all(not exists for exists in relations_exist.values())
    assert detail_response.status_code == 404
    assert [row["eventType"] for row in audit_rows] == ["repository.removed"]


def test_list_scans_returns_initial_register_scan_with_default_page_limit():
    app.dependency_overrides[validate_authentication] = _override_auth
    try:
        create_response = client.post(
            f"/v1/repositories/{_TENANT_SLUG}",
            json={
                "linkedAccountId": "aaaaaaaa-bbbb-cccc-dddd-000000000021",
                "provider": "github",
                "owner": "acme",
                "name": "scan-api",
                "branches": [{"branch": "main"}],
            },
        )
        repository_id = create_response.json()["repository"]["id"]
        scans_response = client.get(f"/v1/repositories/{_TENANT_SLUG}/{repository_id}/scans")
    finally:
        app.dependency_overrides.pop(validate_authentication, None)

    assert create_response.status_code == 201
    assert scans_response.status_code == 200
    body = scans_response.json()
    assert body["limit"] == 50
    assert len(body["items"]) == 1
    assert body["items"][0]["trigger"] == "register"
    assert body["items"][0]["status"] == "pending"


def test_post_scans_support_force_and_skipped_unchanged_with_single_audit_entry():
    app.dependency_overrides[validate_authentication] = _override_auth
    try:
        create_response = client.post(
            f"/v1/repositories/{_TENANT_SLUG}",
            json={
                "linkedAccountId": "aaaaaaaa-bbbb-cccc-dddd-000000000022",
                "provider": "github",
                "owner": "acme",
                "name": "scan-retry",
                "branches": [{"branch": "main"}],
            },
        )
        repository_id = create_response.json()["repository"]["id"]
        skipped_response = client.post(
            f"/v1/repositories/{_TENANT_SLUG}/{repository_id}/scans",
            json={"branch": "main", "force": False},
        )
        forced_response = client.post(
            f"/v1/repositories/{_TENANT_SLUG}/{repository_id}/scans",
            json={"branch": "main", "force": True},
        )
    finally:
        app.dependency_overrides.pop(validate_authentication, None)

    assert skipped_response.status_code == 200
    skipped_scan = skipped_response.json()
    assert skipped_scan["status"] == "skipped_unchanged"
    assert skipped_scan["filesSeen"] == 0
    assert len(skipped_scan["eventLog"]) == 1
    assert skipped_scan["eventLog"][0]["type"] == "repository.scan.skipped_unchanged"

    assert forced_response.status_code == 200
    forced_scan = forced_response.json()
    assert forced_scan["status"] == "pending"
    assert forced_scan["eventLog"][0]["force"] is True


def test_list_scans_and_files_support_cursor_pagination_and_filters():
    app.dependency_overrides[validate_authentication] = _override_auth
    try:
        create_response = client.post(
            f"/v1/repositories/{_TENANT_SLUG}",
            json={
                "linkedAccountId": "aaaaaaaa-bbbb-cccc-dddd-000000000023",
                "provider": "github",
                "owner": "acme",
                "name": "scan-pagination",
                "branches": [{"branch": "main"}],
                "manifest": "version: 2\nspecs:\n  - path: service.yaml\n",
            },
        )
        repository_id = create_response.json()["repository"]["id"]
        for _ in range(3):
            post_response = client.post(
                f"/v1/repositories/{_TENANT_SLUG}/{repository_id}/scans",
                json={"branch": "main", "force": True},
            )
            assert post_response.status_code == 200

        first_page = client.get(f"/v1/repositories/{_TENANT_SLUG}/{repository_id}/scans", params={"limit": 2})
        next_cursor = first_page.json()["nextCursor"]
        second_page = client.get(
            f"/v1/repositories/{_TENANT_SLUG}/{repository_id}/scans",
            params={"limit": 2, "cursor": next_cursor},
        )
        skipped_only = client.get(
            f"/v1/repositories/{_TENANT_SLUG}/{repository_id}/scans",
            params={"status": "skipped_unchanged"},
        )
        initial_scan_id = create_response.json()["initialScanJobId"]
        files_response = client.get(
            f"/v1/repositories/{_TENANT_SLUG}/{repository_id}/scans/{initial_scan_id}/files",
            params={"status": "manifest_error"},
        )
    finally:
        app.dependency_overrides.pop(validate_authentication, None)

    assert first_page.status_code == 200
    assert len(first_page.json()["items"]) == 2
    assert next_cursor is not None
    assert second_page.status_code == 200
    assert len(second_page.json()["items"]) >= 1
    assert skipped_only.status_code == 200
    assert skipped_only.json()["items"] == []

    assert files_response.status_code == 200
    file_rows = files_response.json()["items"]
    assert len(file_rows) == 1
    assert file_rows[0]["status"] == "manifest_error"


def test_complete_scan_classifies_files_and_writes_diff_summary():
    app.dependency_overrides[validate_authentication] = _override_auth
    try:
        create_response = client.post(
            f"/v1/repositories/{_TENANT_SLUG}",
            json={
                "linkedAccountId": "aaaaaaaa-bbbb-cccc-dddd-000000000024",
                "provider": "github",
                "owner": "acme",
                "name": "scan-diff",
                "branches": [{"branch": "main"}],
            },
        )
        repository_id = create_response.json()["repository"]["id"]
        first_scan_id = create_response.json()["initialScanJobId"]
        first_completed = _complete_repository_scan_for_tests(
            repository_id,
            first_scan_id,
            commit_sha="commit-one",
            files=[
                {"path": "apis/openapi.yaml", "blobSha": "111", "tracked": True},
                {"path": "events/asyncapi.yaml", "blobSha": "222", "tracked": True},
            ],
        )

        next_scan_response = client.post(
            f"/v1/repositories/{_TENANT_SLUG}/{repository_id}/scans",
            json={"branch": "main", "force": True},
        )
        second_scan_id = next_scan_response.json()["id"]
        second_completed = _complete_repository_scan_for_tests(
            repository_id,
            second_scan_id,
            commit_sha="commit-two",
            files=[
                {"path": "apis/openapi.yaml", "blobSha": "333", "tracked": True},
                {"path": "docs/readme.md", "blobSha": "444", "tracked": False},
            ],
        )
        files_response = client.get(
            f"/v1/repositories/{_TENANT_SLUG}/{repository_id}/scans/{second_scan_id}/files",
        )
    finally:
        app.dependency_overrides.pop(validate_authentication, None)

    assert create_response.status_code == 201
    assert next_scan_response.status_code == 200

    assert first_completed.status == "complete"
    assert first_completed.diffSummary == {"added": 2, "modified": 0, "removed": 0, "unchanged": 0}

    assert second_completed.status == "complete"
    assert second_completed.diffSummary == {"added": 1, "modified": 1, "removed": 1, "unchanged": 0}

    assert files_response.status_code == 200
    by_path = {row["path"]: row for row in files_response.json()["items"]}
    assert by_path["apis/openapi.yaml"]["status"] == "modified"
    assert by_path["docs/readme.md"]["status"] == "new"
    assert by_path["events/asyncapi.yaml"]["status"] == "removed"
    assert by_path["events/asyncapi.yaml"]["blobSha"] == "222"


def test_complete_scan_dispatches_import_jobs_and_records_parse_errors():
    app.dependency_overrides[validate_authentication] = _override_auth
    try:
        create_response = client.post(
            f"/v1/repositories/{_TENANT_SLUG}",
            json={
                "linkedAccountId": "aaaaaaaa-bbbb-cccc-dddd-000000000025",
                "provider": "github",
                "owner": "acme",
                "name": "scan-import-binding",
                "branches": [{"branch": "main"}],
            },
        )
        repository_id = create_response.json()["repository"]["id"]
        first_scan_id = create_response.json()["initialScanJobId"]
        _complete_repository_scan_for_tests(
            repository_id,
            first_scan_id,
            commit_sha="commit-first",
            files=[
                {"path": "apis/stable.yaml", "blobSha": "111", "tracked": True, "promote": "auto"},
                {"path": "apis/error.yaml", "blobSha": "222", "tracked": True, "promote": "auto"},
                {"path": "apis/removed.yaml", "blobSha": "333", "tracked": True, "promote": "manual"},
            ],
        )
        baseline_job_count = len(_get_repository_import_jobs_for_tests(repository_id))
        baseline_audit_count = len(_get_repository_audit_rows_for_tests(repository_id))

        next_scan_response = client.post(
            f"/v1/repositories/{_TENANT_SLUG}/{repository_id}/scans",
            json={"branch": "main", "force": True},
        )
        second_scan_id = next_scan_response.json()["id"]
        _complete_repository_scan_for_tests(
            repository_id,
            second_scan_id,
            commit_sha="commit-second",
            files=[
                {"path": "apis/stable.yaml", "blobSha": "111", "tracked": True},
                {
                    "path": "apis/error.yaml",
                    "blobSha": "999",
                    "tracked": True,
                    "promote": "auto",
                    "settingsJson": {"forceImportFailure": "parser exploded"},
                },
            ],
        )
        second_scan_files = client.get(
            f"/v1/repositories/{_TENANT_SLUG}/{repository_id}/scans/{second_scan_id}/files",
        )
        import_jobs = _get_repository_import_jobs_for_tests(repository_id)
        change_reports = _get_repository_change_reports_for_tests(repository_id)
        audit_rows = _get_repository_audit_rows_for_tests(repository_id)
    finally:
        app.dependency_overrides.pop(validate_authentication, None)

    assert create_response.status_code == 201
    assert next_scan_response.status_code == 200
    assert second_scan_files.status_code == 200

    # unchanged files do not dispatch new import jobs
    assert len(import_jobs) == baseline_job_count + 2
    second_scan_jobs = [job for job in import_jobs if job.scanId == second_scan_id]
    assert len(second_scan_jobs) == 2
    by_path = {job.diffSnapshot["path"]: job for job in second_scan_jobs}
    assert "apis/stable.yaml" not in by_path

    removed_job = by_path["apis/removed.yaml"]
    assert removed_job.operation == "removal"
    assert removed_job.state == "pending_review"
    assert removed_job.settingsJson["requiresExplicitApproval"] is True
    assert removed_job.sourceType == "git"
    assert removed_job.sourceUri == f"repo://{repository_id}/apis/removed.yaml@main/commit-second"
    assert removed_job.conflictRecords == []
    assert removed_job.eventLog[0]["type"] == "repository.sync.job_dispatched"

    failed_job = by_path["apis/error.yaml"]
    assert failed_job.operation == "import"
    assert failed_job.state == "failed"
    assert failed_job.errorDetail == "parser exploded"
    assert failed_job.diffSnapshot["status"] == "modified"
    assert failed_job.changeReportId is not None
    assert len(failed_job.conflictRecords) == 1
    assert failed_job.conflictRecords[0]["kinds"] == ["duplicate_schema"]
    assert failed_job.eventLog[0]["type"] == "repository.sync.job_dispatched"
    assert failed_job.eventLog[1]["type"] == "repository.sync.conflicts_detected"
    assert failed_job.eventLog[1]["taxonomy"] == "import_pipeline"
    assert failed_job.eventLog[1]["resolver"] == "import_conflict_resolver"
    assert failed_job.eventLog[1]["conflicts"][0]["kinds"] == ["duplicate_schema"]

    reports_by_job_id = {report.importJobId: report for report in change_reports}
    assert removed_job.id in reports_by_job_id
    assert failed_job.id in reports_by_job_id
    removed_report = reports_by_job_id[removed_job.id]
    failed_report = reports_by_job_id[failed_job.id]
    assert removed_report.sourceKind == "repository_sync"
    assert removed_report.changeModelJson["schemas"]["removed"] != []
    assert failed_report.changeModelJson["schemas"]["modified"] != []

    files_by_path = {row["path"]: row for row in second_scan_files.json()["items"]}
    assert files_by_path["apis/stable.yaml"]["status"] == "unchanged"
    assert files_by_path["apis/stable.yaml"]["lastImportJobId"] is None
    assert files_by_path["apis/removed.yaml"]["status"] == "removed"
    assert files_by_path["apis/error.yaml"]["status"] == "parse_error"
    assert files_by_path["apis/error.yaml"]["discriminator"] == "parser exploded"

    new_audit_rows = audit_rows[baseline_audit_count:]
    assert [row["eventType"] for row in new_audit_rows] == [
        "repository.sync_pending_review",
        "repository.sync_pending_review",
    ]


def test_sync_history_routes_persist_conflict_resolution_on_import_job_event_log() -> None:
    app.dependency_overrides[validate_authentication] = _override_auth
    try:
        create_response = client.post(
            f"/v1/repositories/{_TENANT_SLUG}",
            json={
                "linkedAccountId": "aaaaaaaa-bbbb-cccc-dddd-000000000030",
                "provider": "github",
                "owner": "acme",
                "name": "sync-history-conflicts",
                "branches": [{"branch": "main"}],
            },
        )
        repository_id = create_response.json()["repository"]["id"]
        first_scan_id = create_response.json()["initialScanJobId"]
        _complete_repository_scan_for_tests(
            repository_id,
            first_scan_id,
            commit_sha="commit-primer",
            files=[{"path": "apis/orders.yaml", "blobSha": "111", "tracked": True}],
        )
        second_scan_response = client.post(
            f"/v1/repositories/{_TENANT_SLUG}/{repository_id}/scans",
            json={"branch": "main", "force": True},
        )
        second_scan_id = second_scan_response.json()["id"]
        _complete_repository_scan_for_tests(
            repository_id,
            second_scan_id,
            commit_sha="commit-with-conflict",
            files=[
                {
                    "path": "apis/orders.yaml",
                    "blobSha": "999",
                    "tracked": True,
                    "settingsJson": {
                        "simulatedConflicts": [
                            {
                                "schemaName": "Order",
                                "kinds": ["duplicate_schema", "property_conflict"],
                                "message": "Schema differs from draft.",
                            }
                        ]
                    },
                }
            ],
        )
        sync_history_response = client.get(
            f"/v1/repositories/{_TENANT_SLUG}/{repository_id}/sync-history",
            params={"hasConflicts": "true"},
        )
        conflict_job_id = sync_history_response.json()["items"][0]["id"]
        resolve_response = client.post(
            f"/v1/repositories/{_TENANT_SLUG}/{repository_id}/sync-history/{conflict_job_id}/resolve-conflict",
            json={
                "schemaName": "Order",
                "choice": "merge",
                "conflictKinds": ["duplicate_schema", "property_conflict"],
                "note": "Use additive merge strategy from import resolver.",
            },
        )
        refreshed_sync_history_response = client.get(
            f"/v1/repositories/{_TENANT_SLUG}/{repository_id}/sync-history",
            params={"hasConflicts": "true"},
        )
    finally:
        app.dependency_overrides.pop(validate_authentication, None)

    assert create_response.status_code == 201
    assert second_scan_response.status_code == 200
    assert sync_history_response.status_code == 200
    sync_history_body = sync_history_response.json()
    assert sync_history_body["items"]
    assert sync_history_body["items"][0]["conflictRecords"][0]["schemaName"] == "Order"
    assert sync_history_body["items"][0]["conflictRecords"][0]["kinds"] == ["duplicate_schema", "property_conflict"]

    assert resolve_response.status_code == 200
    resolve_body = resolve_response.json()
    assert resolve_body["eventLog"][-1]["type"] == "repository.sync.conflict_resolved"
    assert resolve_body["eventLog"][-1]["schemaName"] == "Order"
    assert resolve_body["eventLog"][-1]["choice"] == "merge"
    assert resolve_body["eventLog"][-1]["conflictKinds"] == ["duplicate_schema", "property_conflict"]
    assert resolve_body["eventLog"][-1]["note"] == "Use additive merge strategy from import resolver."

    assert refreshed_sync_history_response.status_code == 200
    refreshed_job = refreshed_sync_history_response.json()["items"][0]
    assert refreshed_job["id"] == conflict_job_id
    assert refreshed_job["eventLog"][-1]["type"] == "repository.sync.conflict_resolved"


def test_complete_scan_applies_manifest_first_mapping_and_auto_fallback_rules():
    app.dependency_overrides[validate_authentication] = _override_auth
    try:
        create_response = client.post(
            f"/v1/repositories/{_TENANT_SLUG}",
            json={
                "linkedAccountId": "aaaaaaaa-bbbb-cccc-dddd-000000000026",
                "provider": "github",
                "owner": "acme",
                "name": "mapping-rules",
                "branches": [{"branch": "main"}],
                "manifest": (
                    "version: 1\n"
                    "specs:\n"
                    "  - path: services/orders/openapi.yaml\n"
                    "    project: checkout-core\n"
                    "    versionStrategy: branch\n"
                ),
            },
        )
        repository_id = create_response.json()["repository"]["id"]
        scan_id = create_response.json()["initialScanJobId"]
        _complete_repository_scan_for_tests(
            repository_id,
            scan_id,
            commit_sha="commit-mapping-rules",
            files=[
                {
                    "path": "services/orders/openapi.yaml",
                    "blobSha": "111",
                    "tracked": False,
                    "projectSlug": "should-not-win",
                    "versionStrategy": "commit-sha",
                },
                {
                    "path": "billing/openapi.yaml",
                    "blobSha": "222",
                },
                {
                    "path": "root-openapi.yaml",
                    "blobSha": "333",
                },
            ],
        )
        files_response = client.get(
            f"/v1/repositories/{_TENANT_SLUG}/{repository_id}/scans/{scan_id}/files",
        )
    finally:
        app.dependency_overrides.pop(validate_authentication, None)

    assert create_response.status_code == 201
    assert files_response.status_code == 200
    by_path = {row["path"]: row for row in files_response.json()["items"]}

    assert by_path["services/orders/openapi.yaml"]["tracked"] is True
    assert by_path["services/orders/openapi.yaml"]["projectSlug"] == "checkout-core"
    assert by_path["services/orders/openapi.yaml"]["versionStrategy"] == "branch"

    assert by_path["billing/openapi.yaml"]["tracked"] is True
    assert by_path["billing/openapi.yaml"]["projectSlug"] == "billing"
    assert by_path["billing/openapi.yaml"]["versionStrategy"] == "commit-sha"

    assert by_path["root-openapi.yaml"]["tracked"] is False
    assert by_path["root-openapi.yaml"]["projectSlug"] is None
    assert by_path["root-openapi.yaml"]["versionStrategy"] == "commit-sha"
    assert by_path["root-openapi.yaml"]["settingsJson"] == {
        "mappingRequired": True,
        "mappingReason": "project_slug_not_resolved",
    }


def test_commit_sha_jobs_bind_to_idempotent_auto_created_versions() -> None:
    expected_date_prefix = datetime.now(timezone.utc).strftime('%Y%m%d')
    app.dependency_overrides[validate_authentication] = _override_auth_tenant_admin_with_repo_project_autocreate
    try:
        create_response = client.post(
            f"/v1/repositories/{_TENANT_SLUG}",
            json={
                "linkedAccountId": "aaaaaaaa-bbbb-cccc-dddd-000000000027",
                "provider": "github",
                "owner": "acme",
                "name": "version-binding",
                "branches": [{"branch": "main"}],
                "manifest": (
                    "version: 1\n"
                    "specs:\n"
                    "  - path: services/orders/openapi.yaml\n"
                    "    project: checkout-core\n"
                    "    versionStrategy: commit-sha\n"
                ),
            },
        )
        repository_id = create_response.json()["repository"]["id"]
        first_scan_id = create_response.json()["initialScanJobId"]
        _complete_repository_scan_for_tests(
            repository_id,
            first_scan_id,
            commit_sha="abc123def4567890",
            files=[
                {
                    "path": "services/orders/openapi.yaml",
                    "blobSha": "111",
                }
            ],
        )
        first_jobs = [job for job in _get_repository_import_jobs_for_tests(repository_id) if job.scanId == first_scan_id]
        first_versions = _get_repository_resolved_versions_for_tests(_MOCK_AUTH["tenant_id"])

        second_scan_response = client.post(
            f"/v1/repositories/{_TENANT_SLUG}/{repository_id}/scans",
            json={"branch": "main", "force": True},
        )
        second_scan_id = second_scan_response.json()["id"]
        _complete_repository_scan_for_tests(
            repository_id,
            second_scan_id,
            commit_sha="abc123def4567890",
            files=[
                {
                    "path": "services/orders/openapi.yaml",
                    "blobSha": "222",
                }
            ],
        )
        second_jobs = [job for job in _get_repository_import_jobs_for_tests(repository_id) if job.scanId == second_scan_id]
        second_versions = _get_repository_resolved_versions_for_tests(_MOCK_AUTH["tenant_id"])
    finally:
        app.dependency_overrides.pop(validate_authentication, None)

    assert create_response.status_code == 201
    assert second_scan_response.status_code == 200
    assert len(first_jobs) == 1
    assert len(second_jobs) == 1
    assert first_versions == []
    assert second_versions == []

    first_job = first_jobs[0]
    second_job = second_jobs[0]
    assert first_job.targetProjectSlug == "checkout-core"
    assert first_job.targetVersionId == f"{expected_date_prefix}-abc123def456"
    assert second_job.targetVersionId == f"{expected_date_prefix}-abc123def456"


def test_manifest_project_does_not_autocreate_without_flag_or_tenant_admin() -> None:
    app.dependency_overrides[validate_authentication] = _override_auth
    try:
        create_response = client.post(
            f"/v1/repositories/{_TENANT_SLUG}",
            json={
                "linkedAccountId": "aaaaaaaa-bbbb-cccc-dddd-000000000028",
                "provider": "github",
                "owner": "acme",
                "name": "version-binding-guard",
                "branches": [{"branch": "main"}],
                "manifest": (
                    "version: 1\n"
                    "specs:\n"
                    "  - path: services/orders/openapi.yaml\n"
                    "    project: checkout-core\n"
                    "    versionStrategy: commit-sha\n"
                ),
            },
        )
        repository_id = create_response.json()["repository"]["id"]
        scan_id = create_response.json()["initialScanJobId"]
        _complete_repository_scan_for_tests(
            repository_id,
            scan_id,
            commit_sha="abc123def4567890",
            files=[{"path": "services/orders/openapi.yaml", "blobSha": "111"}],
        )
        jobs = [job for job in _get_repository_import_jobs_for_tests(repository_id) if job.scanId == scan_id]
        versions = _get_repository_resolved_versions_for_tests(_MOCK_AUTH["tenant_id"])
    finally:
        app.dependency_overrides.pop(validate_authentication, None)

    assert create_response.status_code == 201
    assert len(jobs) == 1
    assert jobs[0].targetProjectSlug is None
    assert jobs[0].targetVersionId is None
    assert versions == []


def test_noop_dry_run_change_report_is_zero_diff_for_unchanged_file() -> None:
    app.dependency_overrides[validate_authentication] = _override_auth
    try:
        create_response = client.post(
            f"/v1/repositories/{_TENANT_SLUG}",
            json={
                "linkedAccountId": "aaaaaaaa-bbbb-cccc-dddd-000000000029",
                "provider": "github",
                "owner": "acme",
                "name": "zero-diff",
                "branches": [{"branch": "main"}],
            },
        )
        repository_id = create_response.json()["repository"]["id"]
        first_scan_id = create_response.json()["initialScanJobId"]
        _complete_repository_scan_for_tests(
            repository_id,
            first_scan_id,
            commit_sha="unchanged-seed",
            files=[
                {"path": "apis/stable.yaml", "blobSha": "same", "tracked": True},
            ],
        )

        second_scan_response = client.post(
            f"/v1/repositories/{_TENANT_SLUG}/{repository_id}/scans",
            json={"branch": "main", "force": True},
        )
        second_scan_id = second_scan_response.json()["id"]
        _complete_repository_scan_for_tests(
            repository_id,
            second_scan_id,
            commit_sha="unchanged-seed",
            files=[
                {"path": "apis/stable.yaml", "blobSha": "same", "tracked": True},
            ],
        )
        second_scan_jobs = [job for job in _get_repository_import_jobs_for_tests(repository_id) if job.scanId == second_scan_id]
    finally:
        app.dependency_overrides.pop(validate_authentication, None)

    assert create_response.status_code == 201
    assert second_scan_response.status_code == 200
    assert second_scan_jobs == []

    unchanged_report = _build_repository_sync_change_report_for_test_status("unchanged")
    assert unchanged_report["schemas"]["added"] == []
    assert unchanged_report["schemas"]["removed"] == []
    assert unchanged_report["schemas"]["modified"] == []


def test_default_promotion_mode_is_manual_for_new_repositories() -> None:
    app.dependency_overrides[validate_authentication] = _override_auth
    try:
        create_response = client.post(
            f"/v1/repositories/{_TENANT_SLUG}",
            json={
                "linkedAccountId": "aaaaaaaa-bbbb-cccc-dddd-000000000041",
                "provider": "github",
                "owner": "acme",
                "name": "manual-by-default",
                "branches": [{"branch": "main"}],
            },
        )
        repository_id = create_response.json()["repository"]["id"]
        scan_id = create_response.json()["initialScanJobId"]
        _complete_repository_scan_for_tests(
            repository_id,
            scan_id,
            commit_sha="default-manual-sha",
            files=[{"path": "apis/default.yaml", "blobSha": "111", "tracked": True}],
        )
        files_response = client.get(f"/v1/repositories/{_TENANT_SLUG}/{repository_id}/scans/{scan_id}/files")
        jobs = [job for job in _get_repository_import_jobs_for_tests(repository_id) if job.scanId == scan_id]
    finally:
        app.dependency_overrides.pop(validate_authentication, None)

    assert create_response.status_code == 201
    assert files_response.status_code == 200
    assert len(jobs) == 1
    assert jobs[0].state == "pending_review"
    assert files_response.json()["items"][0]["promote"] == "manual"


def test_auto_promotion_records_change_report_and_sync_committed_audit() -> None:
    app.dependency_overrides[validate_authentication] = _override_auth
    try:
        create_response = client.post(
            f"/v1/repositories/{_TENANT_SLUG}",
            json={
                "linkedAccountId": "aaaaaaaa-bbbb-cccc-dddd-000000000042",
                "provider": "github",
                "owner": "acme",
                "name": "auto-commit-audit",
                "branches": [{"branch": "main"}],
                "manifest": (
                    "version: 1\n"
                    "specs:\n"
                    "  - path: apis/auto.yaml\n"
                    "    project: payments\n"
                    "    promote: auto\n"
                    "    onBreakingChange: warn\n"
                ),
            },
        )
        repository_id = create_response.json()["repository"]["id"]
        scan_id = create_response.json()["initialScanJobId"]
        _complete_repository_scan_for_tests(
            repository_id,
            scan_id,
            commit_sha="auto-commit-sha",
            files=[{"path": "apis/auto.yaml", "blobSha": "111"}],
        )
        jobs = [job for job in _get_repository_import_jobs_for_tests(repository_id) if job.scanId == scan_id]
        change_reports = _get_repository_change_reports_for_tests(repository_id)
        audit_rows = _get_repository_audit_rows_for_tests(repository_id)
    finally:
        app.dependency_overrides.pop(validate_authentication, None)

    assert create_response.status_code == 201
    assert len(jobs) == 1
    assert jobs[0].state == "committed"
    assert jobs[0].changeReportId is not None
    assert any(report.importJobId == jobs[0].id for report in change_reports)
    assert [row["eventType"] for row in audit_rows] == ["repository.sync_committed"]


def test_on_breaking_change_block_forces_manual_even_when_promote_is_auto() -> None:
    app.dependency_overrides[validate_authentication] = _override_auth
    try:
        create_response = client.post(
            f"/v1/repositories/{_TENANT_SLUG}",
            json={
                "linkedAccountId": "aaaaaaaa-bbbb-cccc-dddd-000000000043",
                "provider": "github",
                "owner": "acme",
                "name": "blocking-change-gate",
                "branches": [{"branch": "main"}],
                "manifest": (
                    "version: 1\n"
                    "specs:\n"
                    "  - path: apis/blocked.yaml\n"
                    "    project: payments\n"
                    "    promote: auto\n"
                    "    onBreakingChange: block\n"
                ),
            },
        )
        repository_id = create_response.json()["repository"]["id"]
        scan_id = create_response.json()["initialScanJobId"]
        _complete_repository_scan_for_tests(
            repository_id,
            scan_id,
            commit_sha="blocked-commit-sha",
            files=[{"path": "apis/blocked.yaml", "blobSha": "111"}],
        )
        jobs = [job for job in _get_repository_import_jobs_for_tests(repository_id) if job.scanId == scan_id]
        audit_rows = _get_repository_audit_rows_for_tests(repository_id)
    finally:
        app.dependency_overrides.pop(validate_authentication, None)

    assert create_response.status_code == 201
    assert len(jobs) == 1
    assert jobs[0].state == "pending_review"
    assert jobs[0].settingsJson["onBreakingChange"] == "block"
    assert jobs[0].settingsJson["requiresExplicitApproval"] is True
    assert [row["eventType"] for row in audit_rows] == ["repository.sync_pending_review"]
