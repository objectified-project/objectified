from app.repositories.manifest import (
    RepositoryDiscoveryCandidate,
    build_repository_file_rows,
    parse_repo_manifest,
)


def test_parse_repo_manifest_validates_against_schema() -> None:
    outcome = parse_repo_manifest(
        """
version: 1
defaults:
  pollIntervalSec: 86400
  branches: [main]
specs:
  - path: services/orders/openapi.yaml
    format: openapi_3_1
    project: checkout
    versionStrategy: branch
    promote: auto
    onBreakingChange: autoCreateNewMajor
    pollIntervalSec: 300
ignore:
  - "**/node_modules/**"
"""
    )

    assert outcome.manifest_error_row is None
    assert outcome.manifest is not None
    assert outcome.manifest.defaults.poll_interval_sec == 86400
    assert outcome.manifest.specs[0].format == "openapi_3_1"
    assert outcome.manifest.specs[0].project == "checkout"
    assert outcome.manifest.specs[0].version_strategy == "branch"
    assert outcome.manifest.specs[0].promote == "auto"
    assert outcome.manifest.specs[0].on_breaking_change == "autoCreateNewMajor"


def test_parse_repo_manifest_returns_manifest_error_row_but_allows_scan_to_continue() -> None:
    outcome = parse_repo_manifest(
        """
version: 2
specs:
  - path: service.yaml
"""
    )

    assert outcome.manifest is None
    assert outcome.manifest_error_row is not None
    assert outcome.manifest_error_row.path == ".objectified/repo.yaml"
    assert outcome.manifest_error_row.status == "manifest_error"
    assert outcome.manifest_error_row.metadata is not None
    assert "schema validation failed" in outcome.manifest_error_row.metadata["error"]

    rows = build_repository_file_rows(
        discoveries=[RepositoryDiscoveryCandidate(path="service.yaml", detected_format="openapi_3_0")],
        manifest=None,
        branch_poll_interval_sec=120,
        manifest_error_row=outcome.manifest_error_row,
    )
    assert [row.status for row in rows] == ["manifest_error", "discovered"]
    assert rows[1].path == "service.yaml"


def test_manifest_spec_format_and_poll_interval_override_detection_and_branch_defaults() -> None:
    outcome = parse_repo_manifest(
        """
version: 1
defaults:
  pollIntervalSec: 600
specs:
  - path: apis/openapi.yaml
    format: asyncapi_3
    project: Orders API
    versionStrategy: file-version
    promote: auto
    onBreakingChange: warn
    pollIntervalSec: 30
  - path: apis/events.yaml
"""
    )
    assert outcome.manifest is not None

    rows = build_repository_file_rows(
        discoveries=[
            RepositoryDiscoveryCandidate(path="apis/openapi.yaml", detected_format="openapi_3_0"),
            RepositoryDiscoveryCandidate(path="apis/events.yaml", detected_format="asyncapi_2"),
            RepositoryDiscoveryCandidate(path="apis/unlisted.yaml", detected_format="json_schema"),
        ],
        manifest=outcome.manifest,
        branch_poll_interval_sec=120,
    )
    by_path = {row.path: row for row in rows}

    # Per-spec format override wins over scanner phase-B detection.
    assert by_path["apis/openapi.yaml"].format == "asyncapi_3"
    # Per-spec pollIntervalSec wins over branch-level interval.
    assert by_path["apis/openapi.yaml"].poll_interval_sec == 30
    # Manifest mapping values win over auto rules.
    assert by_path["apis/openapi.yaml"].project_slug == "orders-api"
    assert by_path["apis/openapi.yaml"].version_strategy == "file-version"
    assert by_path["apis/openapi.yaml"].promote == "auto"
    assert by_path["apis/openapi.yaml"].settings_json == {"onBreakingChange": "warn"}

    # Missing per-spec pollIntervalSec falls back to branch-level interval.
    assert by_path["apis/events.yaml"].poll_interval_sec == 120
    # Auto mapping derives project slug from path + commit-sha strategy.
    assert by_path["apis/events.yaml"].project_slug == "apis"
    assert by_path["apis/events.yaml"].version_strategy == "commit-sha"
    assert by_path["apis/events.yaml"].promote == "manual"
    # Files omitted from manifest can still be auto-mapped.
    assert by_path["apis/unlisted.yaml"].tracked is True
    assert by_path["apis/unlisted.yaml"].format == "json_schema"


def test_unmapped_root_file_gets_mapping_affordance() -> None:
    rows = build_repository_file_rows(
        discoveries=[RepositoryDiscoveryCandidate(path="openapi.yaml", detected_format="openapi_3_0")],
        manifest=None,
        branch_poll_interval_sec=120,
    )
    assert len(rows) == 1
    assert rows[0].tracked is False
    assert rows[0].project_slug is None
    assert rows[0].version_strategy == "commit-sha"
    assert rows[0].settings_json == {
        "mappingRequired": True,
        "mappingReason": "project_slug_not_resolved",
    }
